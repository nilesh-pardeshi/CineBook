# NOTE: no `from __future__ import annotations` here - the CRUD factory relies on real annotations.
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import now_local, settings
from ..database import get_db
from ..deps import require_admin
from ..models import (
    Booking, BookingFood, BookingSeat, Coupon, FoodItem, Movie, Screen, Show, Theatre, User,
)
from ..schemas import (
    BulkShowIn, CouponIn, CouponOut, FoodIn, FoodOut, MovieIn, MovieOut, ScreenIn, ScreenOut,
    ShowIn, TheatreIn, TheatreOut,
)
from ..services import booking_dict, cancel_booking_with_refund, has_overlap, release_expired

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------------------------------------------------------------- generic CRUD
def _count(db: Session, model, *conds) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*conds)) or 0


def add_crud(path, Model, In, Out, order_by, in_use=None, on_save=None):
    """Registers GET/POST/PUT/DELETE for a simple table. `in_use(db, obj)` returns a message when
    the row can't be deleted because other data depends on it."""

    def list_items(db: Session = Depends(get_db)):
        return db.scalars(select(Model).order_by(*order_by)).all()

    def create_item(data: In, db: Session = Depends(get_db)):
        if on_save:
            on_save(db, data, None)
        obj = Model(**data.model_dump())
        db.add(obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "A record with the same unique value already exists")
        return obj

    def update_item(item_id: int, data: In, db: Session = Depends(get_db)):
        obj = db.get(Model, item_id)
        if not obj:
            raise HTTPException(404, "Not found")
        if on_save:
            on_save(db, data, obj)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "A record with the same unique value already exists")
        return obj

    def delete_item(item_id: int, db: Session = Depends(get_db)):
        obj = db.get(Model, item_id)
        if not obj:
            raise HTTPException(404, "Not found")
        if in_use:
            msg = in_use(db, obj)
            if msg:
                raise HTTPException(409, msg)
        db.delete(obj)
        db.commit()
        return {"ok": True}

    router.add_api_route(f"/{path}", list_items, methods=["GET"], response_model=list[Out], name=f"list_{path}")
    router.add_api_route(f"/{path}", create_item, methods=["POST"], response_model=Out, status_code=201, name=f"create_{path}")
    router.add_api_route(f"/{path}/{{item_id}}", update_item, methods=["PUT"], response_model=Out, name=f"update_{path}")
    router.add_api_route(f"/{path}/{{item_id}}", delete_item, methods=["DELETE"], name=f"delete_{path}")


def _screen_checks(db: Session, data: ScreenIn, obj):
    if not db.get(Theatre, data.theatre_id):
        raise HTTPException(400, "Theatre not found")
    if obj and (data.rows != obj.rows or data.cols != obj.cols or data.premium_rows != obj.premium_rows or data.recliner_rows != obj.recliner_rows):
        if _count(db, Show, Show.screen_id == obj.id, Show.start_time > now_local()):
            raise HTTPException(409, "Seat layout can't be changed while the screen has upcoming shows")


add_crud(
    "movies", Movie, MovieIn, MovieOut, [Movie.id.desc()],
    in_use=lambda db, m: "This movie has shows scheduled. Deactivate it instead of deleting."
    if _count(db, Show, Show.movie_id == m.id) else None,
)
add_crud(
    "theatres", Theatre, TheatreIn, TheatreOut, [Theatre.city, Theatre.name],
    in_use=lambda db, t: "Delete or move this theatre's screens first."
    if _count(db, Screen, Screen.theatre_id == t.id) else None,
)
add_crud(
    "screens", Screen, ScreenIn, ScreenOut, [Screen.theatre_id, Screen.name],
    in_use=lambda db, s: "This screen has shows. Deactivate it instead of deleting."
    if _count(db, Show, Show.screen_id == s.id) else None,
    on_save=_screen_checks,
)
add_crud("food", FoodItem, FoodIn, FoodOut, [FoodItem.category, FoodItem.id])
add_crud("coupons", Coupon, CouponIn, CouponOut, [Coupon.id.desc()])


# ---------------------------------------------------------------- shows
def _show_dict(db: Session, s: Show, booked: int = 0) -> dict:
    end = s.start_time + timedelta(minutes=s.movie.duration_min)
    return {
        "id": s.id,
        "movie_id": s.movie_id,
        "movie_title": s.movie.title,
        "screen_id": s.screen_id,
        "screen_name": s.screen.name,
        "theatre_name": s.screen.theatre.name,
        "city": s.screen.theatre.city,
        "start_time": s.start_time.isoformat(),
        "end_time": end.isoformat(),
        "price_regular": s.price_regular,
        "price_premium": s.price_premium,
        "price_recliner": s.price_recliner,
        "format": s.format,
        "is_active": s.is_active,
        "booked": booked,
        "total_seats": s.screen.rows * s.screen.cols,
    }


def _validate_show(db: Session, data: ShowIn, existing: Optional[Show] = None):
    movie = db.get(Movie, data.movie_id)
    screen = db.get(Screen, data.screen_id)
    if not movie or not screen:
        raise HTTPException(400, "Movie or screen not found")
    if data.is_active and has_overlap(db, screen.id, data.start_time, movie.duration_min, existing.id if existing else None):
        raise HTTPException(409, "This overlaps another show on the same screen (a 15 min cleaning gap is required)")
    if not existing and data.start_time <= now_local():
        raise HTTPException(400, "Show time must be in the future")


@router.get("/shows")
def list_shows(
    date: Optional[str] = None,
    movie_id: Optional[int] = None,
    screen_id: Optional[int] = None,
    upcoming_only: bool = False,
    db: Session = Depends(get_db),
):
    stmt = select(Show).join(Movie).join(Screen).join(Theatre)
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "date must be YYYY-MM-DD")
        stmt = stmt.where(Show.start_time >= d, Show.start_time < d + timedelta(days=1))
    if movie_id:
        stmt = stmt.where(Show.movie_id == movie_id)
    if screen_id:
        stmt = stmt.where(Show.screen_id == screen_id)
    if upcoming_only:
        stmt = stmt.where(Show.start_time > now_local())
    shows = db.scalars(stmt.order_by(Show.start_time, Theatre.name).limit(500)).all()
    ids = [s.id for s in shows]
    booked = dict(db.execute(select(BookingSeat.show_id, func.count()).where(BookingSeat.show_id.in_(ids)).group_by(BookingSeat.show_id)).all()) if ids else {}
    return [_show_dict(db, s, booked.get(s.id, 0)) for s in shows]


@router.post("/shows", status_code=201)
def create_show(data: ShowIn, db: Session = Depends(get_db)):
    _validate_show(db, data)
    s = Show(**data.model_dump())
    db.add(s)
    db.commit()
    return _show_dict(db, s)


@router.post("/shows/bulk")
def bulk_create_shows(data: BulkShowIn, db: Session = Depends(get_db)):
    movie, screen = db.get(Movie, data.movie_id), db.get(Screen, data.screen_id)
    if not movie or not screen:
        raise HTTPException(400, "Movie or screen not found")
    if data.end_date < data.start_date:
        raise HTTPException(400, "End date must be on or after start date")
    if (data.end_date - data.start_date).days > 30:
        raise HTTPException(400, "Bulk scheduling is limited to 31 days at a time")
    created, skipped = 0, []
    day = data.start_date
    while day <= data.end_date:
        for t in sorted(set(data.times)):
            hh, mm = map(int, t.split(":"))
            start = datetime(day.year, day.month, day.day, hh, mm)
            if start <= now_local():
                skipped.append(f"{start:%d %b %H:%M} (in the past)")
            elif has_overlap(db, screen.id, start, movie.duration_min):
                skipped.append(f"{start:%d %b %H:%M} (overlaps another show)")
            else:
                db.add(Show(movie_id=movie.id, screen_id=screen.id, start_time=start,
                            price_regular=data.price_regular, price_premium=data.price_premium,
                            price_recliner=data.price_recliner, format=data.format))
                db.flush()
                created += 1
        day += timedelta(days=1)
    db.commit()
    return {"created": created, "skipped": skipped}


def _cancel_show_bookings(db: Session, show: Show) -> int:
    n = 0
    for b in db.scalars(select(Booking).where(Booking.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"]))).all():
        if b.status == "CONFIRMED":
            cancel_booking_with_refund(db, b, "Show cancelled by the theatre", full_refund=True)
            n += 1
        else:
            b.status = "CANCELLED"
            b.cancel_reason = "Show cancelled by the theatre"
            db.query(BookingSeat).filter(BookingSeat.booking_id == b.id).delete()
    return n


@router.put("/shows/{show_id}")
def update_show(show_id: int, data: ShowIn, db: Session = Depends(get_db)):
    show = db.get(Show, show_id)
    if not show:
        raise HTTPException(404, "Show not found")
    has_bookings = _count(db, Booking, Booking.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"])) > 0
    moved = (data.movie_id, data.screen_id, data.start_time) != (show.movie_id, show.screen_id, show.start_time)
    if has_bookings and moved:
        raise HTTPException(409, "This show has bookings, so its movie, screen and time can't change. You can edit prices or cancel the show.")
    if moved:
        _validate_show(db, data, show)
    elif data.is_active and not show.is_active:
        _validate_show(db, data, show)
    refunded = 0
    if show.is_active and not data.is_active:  # cancelling the show refunds everyone
        refunded = _cancel_show_bookings(db, show)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(show, k, v)
    db.commit()
    return {**_show_dict(db, show), "refunded_bookings": refunded}


@router.delete("/shows/{show_id}")
def delete_show(show_id: int, db: Session = Depends(get_db)):
    show = db.get(Show, show_id)
    if not show:
        raise HTTPException(404, "Show not found")
    if _count(db, Booking, Booking.show_id == show.id):
        raise HTTPException(409, "This show has booking history. Deactivate it instead to cancel and refund customers.")
    db.delete(show)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- bookings
@router.get("/bookings")
def list_bookings(
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    release_expired(db)
    stmt = select(Booking).join(User, User.id == Booking.user_id).where(Booking.status.in_(["CONFIRMED", "CANCELLED"]))
    if status:
        stmt = stmt.where(Booking.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Booking.ref.ilike(like), User.email.ilike(like), User.name.ilike(like)))
    rows = db.scalars(stmt.order_by(Booking.created_at.desc()).limit(200)).all()
    return [booking_dict(b, include_user=True) for b in rows]


@router.post("/bookings/{ref}/checkin")
def check_in(ref: str, db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where(Booking.ref == ref.upper()))
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.status != "CONFIRMED":
        raise HTTPException(400, f"Ticket is {b.status.lower()}, not valid for entry")
    if b.checked_in:
        raise HTTPException(400, "Ticket already used")
    show_end = b.show.start_time + timedelta(minutes=b.show.movie.duration_min)
    if now_local() > show_end:
        raise HTTPException(400, "This show has already ended")
    b.checked_in = True
    db.commit()
    return booking_dict(b, include_user=True)


# ---------------------------------------------------------------- dashboard
@router.get("/stats")
def stats(days: int = 14, db: Session = Depends(get_db)):
    days = max(1, min(days, 90))
    now = now_local()
    confirmed = Booking.status == "CONFIRMED"

    revenue = db.scalar(select(func.coalesce(func.sum(Booking.total), 0)).where(confirmed))
    bookings = _count(db, Booking, confirmed)
    tickets = db.scalar(select(func.count(BookingSeat.id)).join(Booking, Booking.id == BookingSeat.booking_id).where(confirmed))
    food_rev = db.scalar(
        select(func.coalesce(func.sum(BookingFood.qty * BookingFood.unit_price), 0))
        .join(Booking, Booking.id == BookingFood.booking_id).where(confirmed)
    )
    refunds = db.scalar(select(func.coalesce(func.sum(Booking.refund_amount), 0)).where(Booking.status == "CANCELLED"))

    start_day = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    daily = {(start_day + timedelta(days=i)).date().isoformat(): {"bookings": 0, "revenue": 0} for i in range(days)}
    for paid_at, total in db.execute(select(Booking.paid_at, Booking.total).where(confirmed, Booking.paid_at >= start_day)).all():
        key = paid_at.date().isoformat()
        if key in daily:
            daily[key]["bookings"] += 1
            daily[key]["revenue"] += total

    top = db.execute(
        select(Movie.title, func.count(Booking.id), func.coalesce(func.sum(Booking.total), 0))
        .join(Show, Show.movie_id == Movie.id).join(Booking, Booking.show_id == Show.id)
        .where(confirmed).group_by(Movie.id, Movie.title).order_by(desc(func.sum(Booking.total))).limit(5)
    ).all()

    recent = db.scalars(
        select(Booking).where(Booking.status.in_(["CONFIRMED", "CANCELLED"])).order_by(Booking.created_at.desc()).limit(8)
    ).all()

    return {
        "totals": {
            "revenue": revenue, "bookings": bookings, "tickets": tickets, "food_revenue": food_rev, "refunds": refunds,
            "customers": _count(db, User, User.role == "user"),
            "movies": _count(db, Movie, Movie.is_active == True),  # noqa: E712
            "theatres": _count(db, Theatre, Theatre.is_active == True),  # noqa: E712
            "upcoming_shows": _count(db, Show, Show.is_active == True, Show.start_time > now),  # noqa: E712
        },
        "daily": [{"date": k, **v} for k, v in daily.items()],
        "top_movies": [{"title": t, "bookings": b, "revenue": r} for t, b, r in top],
        "recent": [booking_dict(b, include_user=True) for b in recent],
    }
