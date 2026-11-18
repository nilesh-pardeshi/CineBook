from fastapi import APIRouter, Depends, HTTPException
from datetime import timedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..ai.crowd_predictor import predict_crowd
from ..ai.schemas import SeatRecommendationRequest, SeatRecommendationResponse, CrowdPredictionResponse
from ..ai.seat_recommender import recommend_seat_clusters
from ..config import now_local
from ..database import get_db
from ..deps import require_admin
from ..models import Booking, BookingSeat, Screen, Show, ShowOccupancySnapshot
from ..services import release_expired

router = APIRouter(prefix="/ai", tags=["AI intelligence"])


def _show_or_404(db: Session, show_id: int) -> Show:
    show = db.get(Show, show_id)
    if not show or not show.is_active or show.start_time <= now_local():
        raise HTTPException(status_code=404, detail="Upcoming active show not found")
    return show


def _occupied_labels(db: Session, show_id: int) -> set[str]:
    rows = db.execute(
        select(BookingSeat.label).join(Booking, Booking.id == BookingSeat.booking_id).where(
            BookingSeat.show_id == show_id, Booking.status.in_(["PENDING", "CONFIRMED"])
        )
    ).scalars().all()
    return set(rows)


@router.post("/seat-recommendations", response_model=SeatRecommendationResponse)
def seat_recommendations(payload: SeatRecommendationRequest, db: Session = Depends(get_db)):
    show = _show_or_404(db, payload.show_id)
    release_expired(db, show.id)
    occupied = _occupied_labels(db, show.id)
    recommendations = recommend_seat_clusters(
        screen=show.screen, show=show, occupied=occupied, group_size=payload.group_size,
        max_budget_per_seat=payload.max_budget_per_seat,
        preferred_tier=payload.preferred_tier, prefer_aisle=payload.prefer_aisle,
        accessibility_required=payload.accessibility_required,
    )
    if payload.accessibility_required and not (show.screen.accessible_seat_labels or "").strip():
        explanation = "This screen has no accessible-seat labels configured. Ask the theatre to configure its accessible seating map; no accessibility claim has been made."
    elif not recommendations:
        explanation = "No contiguous available seat cluster matches all selected preferences. Try a different tier, budget or group size."
    else:
        explanation = "Ranked using seat geometry, contiguous availability, tier preference, budget and aisle proximity. Recommendations are advisory; availability is revalidated during booking."
    return {"show_id": show.id, "group_size": payload.group_size,
            "recommendations": recommendations, "explanation": explanation}


@router.get("/shows/{show_id}/crowd", response_model=CrowdPredictionResponse)
def show_crowd_prediction(show_id: int, db: Session = Depends(get_db)):
    show = _show_or_404(db, show_id)
    release_expired(db, show.id)
    capacity = show.screen.rows * show.screen.cols
    occupied = db.scalar(
        select(func.count(BookingSeat.id)).join(Booking, Booking.id == BookingSeat.booking_id).where(
            BookingSeat.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"])
        )
    ) or 0
    result = predict_crowd(show, capacity, occupied)
    return {"show_id": show.id, **result}


@router.get("/shows/{show_id}/insights")
def show_insights(show_id: int, db: Session = Depends(get_db)):
    show = _show_or_404(db, show_id)
    release_expired(db, show.id)
    capacity = show.screen.rows * show.screen.cols
    occupied = db.scalar(
        select(func.count(BookingSeat.id)).join(Booking, Booking.id == BookingSeat.booking_id).where(
            BookingSeat.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"])
        )
    ) or 0
    crowd = predict_crowd(show, capacity, occupied)
    available = max(0, capacity - occupied)
    price_values = [show.price_regular, show.price_premium, show.price_recliner]
    return {
        "show_id": show.id, "format": show.format,
        "available_seats": available,
        "lowest_price": min(price_values),
        "crowd": crowd,
        "value_signal": "More seats currently available" if crowd["current_fill_rate"] < 35 else "Compare nearby showtimes for better availability",
    }


@router.post("/admin/snapshots/collect")
def collect_occupancy_snapshots(_admin=Depends(require_admin), db: Session = Depends(get_db)):
    """Admin-triggered snapshot collection. Call periodically (e.g. hourly) to build training history."""
    now = now_local()
    shows = db.scalars(select(Show).where(
        Show.start_time >= now - timedelta(days=7),
        Show.start_time <= now + timedelta(days=30),
        Show.is_active.is_(True),
    )).all()
    inserted = 0
    skipped = 0
    for show in shows:
        release_expired(db, show.id)
        capacity = max(1, show.screen.rows * show.screen.cols)
        occupied = db.scalar(
            select(func.count(BookingSeat.id)).join(Booking, Booking.id == BookingSeat.booking_id).where(
                BookingSeat.show_id == show.id, Booking.status.in_(["PENDING", "CONFIRMED"])
            )
        ) or 0
        last = db.scalar(select(ShowOccupancySnapshot).where(
            ShowOccupancySnapshot.show_id == show.id
        ).order_by(ShowOccupancySnapshot.captured_at.desc()).limit(1))
        if last and (now - last.captured_at).total_seconds() < 30 * 60:
            skipped += 1
            continue
        start = show.start_time
        screen = show.screen
        theatre = screen.theatre
        db.add(ShowOccupancySnapshot(
            show_id=show.id, captured_at=now, capacity=capacity,
            occupied_seats=min(occupied, capacity), fill_rate=round(min(occupied, capacity) / capacity * 100, 3),
            hours_to_start=round((start - now).total_seconds() / 3600, 3),
            weekday=start.weekday(), start_hour=start.hour, is_weekend=start.weekday() >= 5,
            show_format=show.format or "2D", language=show.movie.language or "English",
            city=theatre.city or "Unknown",
        ))
        inserted += 1
    db.commit()
    return {"captured": inserted, "skipped_recent": skipped, "shows_considered": len(shows),
            "message": "Snapshots recorded. Run train_crowd_model.py after enough observations have accumulated."}
