"""Booking business logic shared by the public, booking and admin routers."""
import secrets
from datetime import timedelta
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import now_local, settings
from .layout import seat_key
from .models import Booking, BookingSeat, Coupon, Movie, Show


def new_ref() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion
    return "CB" + "".join(secrets.choice(alphabet) for _ in range(8))


def release_expired(db: Session, show_id: Optional[int] = None) -> None:
    """Free seats held by PENDING bookings whose hold timer ran out."""
    stmt = select(Booking).where(Booking.status == "PENDING", Booking.expires_at < now_local())
    if show_id:
        stmt = stmt.where(Booking.show_id == show_id)
    expired = db.scalars(stmt).all()
    for b in expired:
        b.status = "EXPIRED"
        db.execute(delete(BookingSeat).where(BookingSeat.booking_id == b.id))
    if expired:
        db.commit()


def release_booking_seats(db: Session, booking: Booking) -> None:
    db.execute(delete(BookingSeat).where(BookingSeat.booking_id == booking.id))


# ---------- Coupons ----------
def coupon_check(db: Session, code: str, subtotal: int, user_id: int):
    """Returns ((coupon, discount), None) when valid, else (None, error message)."""
    c = db.scalar(select(Coupon).where(func.upper(Coupon.code) == code.strip().upper()))
    if not c or not c.is_active:
        return None, "Invalid coupon code"
    today = now_local().date()
    if c.valid_from and today < c.valid_from:
        return None, "This coupon is not active yet"
    if c.valid_to and today > c.valid_to:
        return None, "This coupon has expired"
    if c.usage_limit is not None and c.used_count >= c.usage_limit:
        return None, "This coupon has reached its usage limit"
    if subtotal < c.min_amount:
        return None, f"Add ₹{c.min_amount - subtotal} more to use this coupon (min ₹{c.min_amount})"
    if c.one_per_user:
        used = db.scalar(
            select(func.count(Booking.id)).where(
                Booking.user_id == user_id, Booking.coupon_code == c.code, Booking.status == "CONFIRMED"
            )
        )
        if used:
            return None, "You have already used this coupon"
    discount = subtotal * c.value // 100 if c.discount_type == "percent" else c.value
    if c.max_discount:
        discount = min(discount, c.max_discount)
    return (c, min(discount, subtotal)), None


def recalc_booking(db: Session, b: Booking) -> Optional[str]:
    """Recompute totals from seat/food rows. Returns a notice if a coupon had to be dropped."""
    seat_total = sum(s.price for s in b.seat_rows)
    food_total = sum(f.qty * f.unit_price for f in b.food_rows)
    notice = None
    discount = 0
    if b.coupon_code:
        res, err = coupon_check(db, b.coupon_code, seat_total + food_total, b.user_id)
        if err:
            notice = f"Coupon {b.coupon_code} was removed: {err}"
            b.coupon_code = None
        else:
            discount = res[1]
    b.seat_total = seat_total
    b.food_total = food_total
    b.discount = discount
    b.fee = settings.CONVENIENCE_FEE * len(b.seat_rows)
    b.total = max(0, seat_total + food_total - discount + b.fee)
    return notice


# ---------- Scheduling ----------
def has_overlap(db: Session, screen_id: int, start, duration_min: int, exclude_id: Optional[int] = None) -> bool:
    end = start + timedelta(minutes=duration_min + settings.TURNAROUND_MINUTES)
    stmt = (
        select(Show, Movie.duration_min)
        .join(Movie, Movie.id == Show.movie_id)
        .where(
            Show.screen_id == screen_id,
            Show.is_active == True,  # noqa: E712
            Show.start_time > start - timedelta(hours=12),
            Show.start_time < end,
        )
    )
    if exclude_id:
        stmt = stmt.where(Show.id != exclude_id)
    for other, dur in db.execute(stmt).all():
        other_end = other.start_time + timedelta(minutes=dur + settings.TURNAROUND_MINUTES)
        if other.start_time < end and other_end > start:
            return True
    return False


def cancel_booking_with_refund(db: Session, b: Booking, reason: str, full_refund: bool = False) -> None:
    """Cancel a booking and release its seats. Refund is total minus convenience fee (or full)."""
    was_paid = b.status == "CONFIRMED"
    b.status = "CANCELLED"
    b.cancel_reason = reason
    if was_paid:
        b.refund_amount = b.total if full_refund else max(0, b.total - b.fee)
    release_booking_seats(db, b)


# ---------- Serialisation ----------
def _iso(d):
    return d.isoformat() if d else None


def booking_dict(b: Booking, include_user: bool = False) -> dict:
    show = b.show
    movie, screen = show.movie, show.screen
    theatre = screen.theatre
    now = now_local()
    seats = [s for s in b.seats.split(",") if s]
    seconds_left = 0
    if b.status == "PENDING" and b.expires_at:
        seconds_left = max(0, int((b.expires_at - now).total_seconds()))
    hours_left = (show.start_time - now).total_seconds() / 3600
    data = {
        "ref": b.ref,
        "status": b.status,
        "seats": sorted(seats, key=seat_key),
        "seat_details": [
            {"label": s.label, "category": s.category, "price": s.price}
            for s in sorted(b.seat_rows, key=lambda x: seat_key(x.label))
        ],
        "food": [{"name": f.name, "qty": f.qty, "unit_price": f.unit_price, "food_id": f.food_id} for f in b.food_rows],
        "seat_total": b.seat_total,
        "food_total": b.food_total,
        "discount": b.discount,
        "fee": b.fee,
        "total": b.total,
        "coupon_code": b.coupon_code,
        "payment_method": b.payment_method,
        "payment_ref": b.payment_ref,
        "payment_detail": b.payment_detail,
        "paid_at": _iso(b.paid_at),
        "refund_amount": b.refund_amount,
        "cancel_reason": b.cancel_reason,
        "checked_in": b.checked_in,
        "created_at": _iso(b.created_at),
        "expires_at": _iso(b.expires_at),
        "seconds_left": seconds_left,
        "can_cancel": b.status == "CONFIRMED" and not b.checked_in and hours_left >= settings.CANCEL_CUTOFF_HOURS,
        "show": {
            "id": show.id,
            "start_time": _iso(show.start_time),
            "is_past": show.start_time <= now,
            "movie": {
                "id": movie.id,
                "title": movie.title,
                "poster_url": movie.poster_url,
                "certificate": movie.certificate,
                "language": movie.language,
                "genres": movie.genres,
                "duration_min": movie.duration_min,
            },
            "theatre": {"name": theatre.name, "city": theatre.city, "address": theatre.address},
            "screen": {"name": screen.name, "type": screen.screen_type},
        },
    }
    if include_user:
        data["user"] = {"name": b.user.name, "email": b.user.email, "phone": b.user.phone}
    return data
