"""Collect one occupancy snapshot for each eligible active show.

Run from backend/: python collect_occupancy.py
Use Windows Task Scheduler / cron to run hourly. This local scheduled job uses
DATABASE_URL from backend/.env and does not need an admin JWT.
"""
from datetime import timedelta
from sqlalchemy import func, select

from app.config import now_local
from app.database import SessionLocal
from app.models import Booking, BookingSeat, Show, ShowOccupancySnapshot
from app.services import release_expired


def collect() -> dict:
    db = SessionLocal()
    try:
        now = now_local()
        shows = db.scalars(
            select(Show).where(
                Show.start_time >= now - timedelta(days=7),
                Show.start_time <= now + timedelta(days=30),
                Show.is_active.is_(True),
            )
        ).all()
        inserted = skipped = 0
        for show in shows:
            release_expired(db, show.id)
            capacity = max(1, show.screen.rows * show.screen.cols)
            occupied = db.scalar(
                select(func.count(BookingSeat.id))
                .join(Booking, Booking.id == BookingSeat.booking_id)
                .where(
                    BookingSeat.show_id == show.id,
                    Booking.status.in_(["PENDING", "CONFIRMED"]),
                )
            ) or 0
            last = db.scalar(
                select(ShowOccupancySnapshot)
                .where(ShowOccupancySnapshot.show_id == show.id)
                .order_by(ShowOccupancySnapshot.captured_at.desc())
                .limit(1)
            )
            if last and (now - last.captured_at).total_seconds() < 30 * 60:
                skipped += 1
                continue
            theatre = show.screen.theatre
            db.add(ShowOccupancySnapshot(
                show_id=show.id,
                captured_at=now,
                capacity=capacity,
                occupied_seats=min(occupied, capacity),
                fill_rate=round(min(occupied, capacity) / capacity * 100, 3),
                hours_to_start=round((show.start_time - now).total_seconds() / 3600, 3),
                weekday=show.start_time.weekday(),
                start_hour=show.start_time.hour,
                is_weekend=show.start_time.weekday() >= 5,
                show_format=show.format or "2D",
                language=show.movie.language or "English",
                city=theatre.city or "Unknown",
            ))
            inserted += 1
        db.commit()
        result = {
            "captured": inserted,
            "skipped_recent": skipped,
            "shows_considered": len(shows),
            "captured_at": now.isoformat(),
        }
        print(result)
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    collect()
