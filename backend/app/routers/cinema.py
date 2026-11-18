from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from ..config import now_local
from ..models import Show, Theatre, Screen

router = APIRouter(tags=["cinemas"])


@router.get("/cinemas/{theatre_id}")
def cinema_detail(theatre_id: int, db: Session = Depends(get_db)):
    theatre = db.scalar(select(Theatre).options(selectinload(Theatre.screens)).where(
        Theatre.id == theatre_id, Theatre.is_active == True  # noqa: E712
    ))
    if not theatre:
        raise HTTPException(status_code=404, detail="Cinema not found")
    screens = []
    for screen in theatre.screens:
        if not screen.is_active:
            continue
        total = screen.rows * screen.cols
        regular_rows = max(0, screen.rows - screen.premium_rows - screen.recliner_rows)
        screens.append({
            "id": screen.id, "name": screen.name, "screen_type": screen.screen_type,
            "rows": screen.rows, "columns": screen.cols, "capacity": total,
            "projection_format": screen.projection_format,
            "sound_system": screen.sound_system,
            "screen_dimensions_ft": {"width": screen.screen_width_ft, "height": screen.screen_height_ft},
            "seat_tiers": {
                "regular": {"rows": regular_rows, "seats": regular_rows * screen.cols},
                "premium": {"rows": screen.premium_rows, "seats": screen.premium_rows * screen.cols},
                "recliner": {"rows": screen.recliner_rows, "seats": screen.recliner_rows * screen.cols},
            },
            "accessible_seats_configured": len([x for x in (screen.accessible_seat_labels or "").split(",") if x.strip()]),
        })
    upcoming = db.scalars(
        select(Show).join(Screen, Show.screen_id == Screen.id)
        .options(joinedload(Show.movie), joinedload(Show.screen))
        .where(Screen.theatre_id == theatre.id, Show.is_active == True, Show.start_time >= now_local())  # noqa: E712
        .order_by(Show.start_time).limit(40)
    ).all()
    schedule = [{
        "show_id": show.id, "movie_id": show.movie_id, "movie_title": show.movie.title,
        "poster_url": show.movie.poster_url, "language": show.movie.language,
        "certificate": show.movie.certificate, "screen": show.screen.name,
        "format": show.format, "start_time": show.start_time.isoformat(),
        "price_from": min(show.price_regular, show.price_premium, show.price_recliner),
    } for show in upcoming]
    return {
        "id": theatre.id, "name": theatre.name, "city": theatre.city,
        "state": theatre.state, "circuit": theatre.circuit, "address": theatre.address,
        "amenities": [x.strip() for x in (theatre.amenities or "").split(",") if x.strip()],
        "location": {"latitude": theatre.latitude, "longitude": theatre.longitude},
        "screens": screens, "upcoming_shows": schedule,
    }


@router.get("/meta/indian-cinema")
def indian_cinema_metadata():
    return {
        "languages": ["Hindi", "Marathi", "Telugu", "Tamil", "Kannada", "Malayalam", "English"],
        "formats": ["2D", "3D", "IMAX 2D", "4DX", "Dolby Atmos", "P[XL]"],
        "cbfc_certificates": ["U", "U/A", "A"],
        "cities": ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Chennai", "Delhi NCR"],
        "regional_circuits": ["Mumbai Circuit", "Maharashtra Circuit", "Karnataka Circuit", "Nizam Circuit", "Tamil Nadu Circuit", "Kerala Circuit", "Delhi-UP Circuit"],
    }
