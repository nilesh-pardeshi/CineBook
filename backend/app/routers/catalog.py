from datetime import date as Date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, contains_eager

from ..config import now_local, settings
from ..database import get_db
from ..layout import ROW_LETTERS, row_category
from ..models import Booking, BookingSeat, Coupon, FoodItem, Movie, Screen, Show, Theatre
from ..schemas import FoodOut, MovieOut
from ..services import release_expired
from ..cinema_directory import CITIES as DIRECTORY_CITIES, THEATRES as DIRECTORY_THEATRES

router = APIRouter(tags=["catalog"])


@router.get("/cities")
def cities(db: Session = Depends(get_db)):
    rows = db.scalars(select(Theatre.city).where(Theatre.is_active == True).distinct().order_by(Theatre.city))  # noqa: E712
    existing = set(rows)
    return sorted(existing | {item["name"] for item in DIRECTORY_CITIES})


@router.get("/cinema-directory/cities")
def cinema_directory_cities():
    return DIRECTORY_CITIES


@router.get("/cinema-directory/theatres")
def cinema_directory_theatres(city: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    """Return curated public listings plus CineBook's own demo/bookable venues.

    Database venues are included even when a city has no curated directory
    records, so seeded demo multiplexes appear in the city directory too.
    """
    selected = city.strip().casefold()
    curated = [dict(item) for item in DIRECTORY_THEATRES if item["city"].casefold() == selected]
    known = {(item["name"].casefold(), item["city"].casefold()) for item in curated}
    db_venues = db.scalars(
        select(Theatre).where(
            func.lower(Theatre.city) == selected,
            Theatre.is_active == True,  # noqa: E712
        ).order_by(Theatre.name)
    ).all()
    for venue in db_venues:
        key = (venue.name.casefold(), venue.city.casefold())
        if key in known:
            continue
        curated.append({
            "name": venue.name,
            "city": venue.city,
            "state": venue.state or "",
            "address": venue.address,
            "source_url": None,
            "listing_type": "Sample booking venue" if "Grand Screen Cinemas" in venue.name else "CineBook booking venue",
            "is_bookable": bool(venue.screens),
        })
        known.add(key)
    return curated


@router.get("/meta")
def meta(db: Session = Depends(get_db)):
    movies = db.scalars(select(Movie).where(Movie.is_active == True)).all()  # noqa: E712
    genres = sorted({g.strip() for m in movies for g in m.genres.split(",") if g.strip()})
    languages = sorted({m.language for m in movies if m.language})
    return {"genres": genres, "languages": languages}


@router.get("/movies", response_model=list[MovieOut])
def list_movies(
    status: Optional[str] = None,
    q: Optional[str] = None,
    genre: Optional[str] = None,
    language: Optional[str] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    stmt = select(Movie).where(Movie.is_active == True)  # noqa: E712
    if status:
        stmt = stmt.where(Movie.status == status)
    if q:
        stmt = stmt.where(Movie.title.ilike(f"%{q}%"))
    if genre:
        stmt = stmt.where(Movie.genres.ilike(f"%{genre}%"))
    if language:
        stmt = stmt.where(Movie.language == language)
    if featured is not None:
        stmt = stmt.where(Movie.is_featured == featured)
    stmt = stmt.order_by(Movie.release_date.asc() if status == "upcoming" else Movie.rating.desc(), Movie.id)
    return db.scalars(stmt).all()


@router.get("/movies/{movie_id}", response_model=MovieOut)
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.get(Movie, movie_id)
    if not movie or not movie.is_active:
        raise HTTPException(404, "Movie not found")
    return movie


@router.get("/movies/{movie_id}/shows")
def movie_shows(
    movie_id: int,
    city: str,
    on_date: Optional[Date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    if not db.get(Movie, movie_id):
        raise HTTPException(404, "Movie not found")
    release_expired(db)
    now = now_local()
    stmt = (
        select(Show)
        .join(Show.screen)
        .join(Screen.theatre)
        .options(contains_eager(Show.screen).contains_eager(Screen.theatre))
        .where(
            Show.movie_id == movie_id,
            Show.is_active == True,  # noqa: E712
            Screen.is_active == True,  # noqa: E712
            Theatre.is_active == True,  # noqa: E712
            Theatre.city == city,
            Show.start_time > now,
        )
        .order_by(Show.start_time)
    )
    all_shows = db.scalars(stmt).unique().all()
    dates = sorted({s.start_time.date() for s in all_shows})
    target = on_date or (dates[0] if dates else now.date())
    day_shows = [s for s in all_shows if s.start_time.date() == target]

    ids = [s.id for s in day_shows]
    booked = {}
    if ids:
        booked = dict(
            db.execute(
                select(BookingSeat.show_id, func.count()).where(BookingSeat.show_id.in_(ids)).group_by(BookingSeat.show_id)
            ).all()
        )

    grouped: dict[int, dict] = {}
    for s in day_shows:
        th = s.screen.theatre
        g = grouped.setdefault(
            th.id, {"id": th.id, "name": th.name, "address": th.address, "amenities": th.amenities, "shows": []}
        )
        total = s.screen.rows * s.screen.cols
        available = total - booked.get(s.id, 0)
        g["shows"].append(
            {
                "id": s.id,
                "start_time": s.start_time.isoformat(),
                "screen": s.screen.name,
                "screen_type": s.screen.screen_type,
                "format": s.format,
                "projection_format": s.screen.projection_format,
                "sound_system": s.screen.sound_system,
                "price_from": min(
                    p
                    for p, n in (
                        (s.price_regular, s.screen.rows - s.screen.premium_rows - s.screen.recliner_rows),
                        (s.price_premium, s.screen.premium_rows),
                        (s.price_recliner, s.screen.recliner_rows),
                    )
                    if n > 0
                ),
                "available": available,
                "total": total,
                "state": "sold_out" if available <= 0 else ("filling_fast" if available / total < 0.25 else "available"),
            }
        )
    return {
        "date": target.isoformat(),
        "dates": [d.isoformat() for d in dates],
        "theatres": list(grouped.values()),
    }


@router.get("/shows/{show_id}")
def show_detail(show_id: int, db: Session = Depends(get_db)):
    release_expired(db, show_id)
    show = db.get(Show, show_id)
    if not show or not show.is_active:
        raise HTTPException(404, "Show not found")
    screen, movie, theatre = show.screen, show.movie, show.screen.theatre

    status_by_label = {}
    for label, bstatus in db.execute(
        select(BookingSeat.label, Booking.status)
        .join(Booking, Booking.id == BookingSeat.booking_id)
        .where(BookingSeat.show_id == show_id)
    ).all():
        status_by_label[label] = "booked" if bstatus == "CONFIRMED" else "held"

    rows = []
    for i in range(screen.rows):
        letter = ROW_LETTERS[i]
        cat = row_category(screen, i)
        rows.append(
            {
                "row": letter,
                "category": cat,
                "price": show.price_for(cat),
                "seats": [
                    {"label": f"{letter}{n}", "number": n, "status": status_by_label.get(f"{letter}{n}", "available")}
                    for n in range(1, screen.cols + 1)
                ],
            }
        )
    return {
        "id": show.id,
        "start_time": show.start_time.isoformat(),
        "is_past": show.start_time <= now_local(),
        "max_seats": settings.MAX_SEATS,
        "hold_minutes": settings.SEAT_HOLD_MINUTES,
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
        "screen": {"name": screen.name, "type": screen.screen_type,
                   "projection_format": screen.projection_format, "sound_system": screen.sound_system},
        "format": show.format,
        "prices": {"regular": show.price_regular, "premium": show.price_premium, "recliner": show.price_recliner},
        "rows": rows,
    }


@router.get("/food", response_model=list[FoodOut])
def list_food(db: Session = Depends(get_db)):
    return db.scalars(select(FoodItem).where(FoodItem.is_active == True).order_by(FoodItem.category, FoodItem.id)).all()  # noqa: E712


@router.get("/coupons")
def list_coupons(db: Session = Depends(get_db)):
    today = now_local().date()
    out = []
    for c in db.scalars(select(Coupon).where(Coupon.is_active == True).order_by(Coupon.id)):  # noqa: E712
        if (c.valid_from and today < c.valid_from) or (c.valid_to and today > c.valid_to):
            continue
        if c.usage_limit is not None and c.used_count >= c.usage_limit:
            continue
        out.append(
            {
                "code": c.code,
                "description": c.description,
                "discount_type": c.discount_type,
                "value": c.value,
                "max_discount": c.max_discount,
                "min_amount": c.min_amount,
                "one_per_user": c.one_per_user,
            }
        )
    return out
