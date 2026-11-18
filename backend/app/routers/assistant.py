from __future__ import annotations
import re
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..config import now_local
from ..database import get_db
from ..models import Booking, BookingSeat, FoodItem, Movie, Screen, Show, Theatre
from ..ai.schemas import ConciergeRequest

router = APIRouter(prefix="/assistant", tags=["AI concierge"])
LANGUAGES = {
    "hindi": "Hindi", "marathi": "Marathi", "tamil": "Tamil", "telugu": "Telugu",
    "kannada": "Kannada", "malayalam": "Malayalam", "english": "English",
}
CITIES = ["Pune", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Delhi", "Nashik", "Kolhapur"]

def parse_prompt(prompt: str, city: str | None, language: str | None, budget: int | None):
    text = prompt.strip()
    lowered = text.casefold()
    found_city = city or next((c for c in CITIES if c.casefold() in lowered), None)
    found_language = language or next((v for k, v in LANGUAGES.items() if k in lowered), None)
    found_budget = budget
    if found_budget is None:
        matches = re.findall(r"(?:₹|rs\.?\s*)\s*(\d{2,6})|\b(\d{3,6})\s*(?:rupees|rs)\b", lowered)
        if matches:
            found_budget = int(next(x for x in matches[0] if x))
    return found_city, found_language, found_budget

@router.post("/concierge")
def concierge(payload: ConciergeRequest, db: Session = Depends(get_db)):
    city, language, budget = parse_prompt(payload.prompt, payload.city, payload.language, payload.budget)
    now = now_local()
    query = select(Show, Movie, Screen, Theatre).join(Movie, Show.movie_id == Movie.id).join(Screen, Show.screen_id == Screen.id).join(Theatre, Screen.theatre_id == Theatre.id).where(
        Show.is_active.is_(True), Show.start_time > now, Movie.is_active.is_(True), Theatre.is_active.is_(True)
    )
    if city:
        query = query.where(func.lower(Theatre.city) == city.lower())
    if language:
        query = query.where(func.lower(Movie.language) == language.lower())
    rows = db.execute(query.order_by(Show.start_time.asc()).limit(60)).all()
    candidates = []
    for show, movie, screen, theatre in rows:
        prices = [show.price_regular, show.price_premium, show.price_recliner]
        lowest = min(prices)
        if budget is not None and lowest * payload.group_size > budget:
            continue
        occupied = db.scalar(select(func.count(BookingSeat.id)).join(Booking, Booking.id == BookingSeat.booking_id).where(
            BookingSeat.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"])
        )) or 0
        capacity = max(1, screen.rows * screen.cols)
        candidates.append({
            "show_id": show.id, "movie_id": movie.id, "movie_title": movie.title,
            "language": movie.language, "genres": movie.genres, "poster_url": movie.poster_url,
            "theatre_id": theatre.id, "theatre": theatre.name, "city": theatre.city,
            "screen": screen.name, "format": show.format, "start_time": show.start_time.isoformat(),
            "starting_price": lowest, "estimated_group_total": lowest * payload.group_size,
            "available_seats_estimate": max(0, capacity - occupied),
            "booking_path": f"/shows/{show.id}/seats",
        })
    candidates.sort(key=lambda x: (x["estimated_group_total"], x["start_time"]))
    foods = db.scalars(select(FoodItem).where(FoodItem.is_active.is_(True)).order_by(FoodItem.price.asc()).limit(8)).all()
    food_results = [{"id": f.id, "name": f.name, "description": f.description, "price": f.price,
                     "category": f.category, "emoji": f.emoji, "is_veg": f.is_veg} for f in foods]
    if candidates:
        explanation = "These options come from live upcoming CineBook shows. Prices use the lowest seat tier; final availability and price are checked again during booking."
    elif city or language or budget is not None:
        explanation = "No upcoming show matched every detected preference. Try another city, language or a higher budget."
    else:
        explanation = "No upcoming active shows are currently available in the catalogue."
    return {"assistant_mode": "deterministic_catalogue_concierge_v1", "message": explanation,
            "detected_preferences": {"city": city, "language": language, "budget": budget, "group_size": payload.group_size},
            "shows": candidates[:6], "snacks": food_results,
            "limitations": "This assistant uses deterministic preference extraction and live CineBook catalogue data. It does not use an external LLM and does not make bookings."}
