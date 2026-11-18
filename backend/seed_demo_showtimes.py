"""Create fully bookable CineBook demo inventory for every directory city,
listed demo theatre, and active catalogue movie (now-showing + upcoming).

Run from backend after PostgreSQL and the movie catalogue are ready:
    python seed_demo_showtimes.py

All generated theatre schedules are simulated CineBook project data, not live
operator schedules. The script is idempotent and never deletes existing shows,
bookings, or theatre records.
"""
from datetime import datetime, timedelta

from sqlalchemy import select

from app import models  # noqa: F401
from app.config import now_local
from app.database import Base, SessionLocal, engine
from app.models import Movie, Theatre, Screen, Show
from app.cinema_directory import CITIES, THEATRES as DIRECTORY_THEATRES

# Times are spaced to avoid overlapping screenings on a movie-specific screen.
TIME_SLOTS = [
    ((9, 45), (13, 45), (18, 15)),
    ((10, 15), (14, 30), (19, 0)),
    ((11, 0), (15, 15), (20, 0)),
    ((9, 30), (14, 0), (19, 30)),
    ((10, 30), (15, 0), (20, 15)),
]
DAYS_TO_SEED = 7


def _theatre_specs():
    """Return all directory venues plus one clearly labelled demo venue
    for any city that has no named venue in the directory.
    """
    specs = []
    covered = set()
    for item in DIRECTORY_THEATRES:
        city = item["city"]
        specs.append({
            "city": city,
            "state": item.get("state", ""),
            "name": item["name"],
            "address": item["address"],
        })
        covered.add(city.casefold())

    for city_info in CITIES:
        city = city_info["name"]
        if city.casefold() not in covered:
            specs.append({
                "city": city,
                "state": city_info.get("state", ""),
                "name": f"Grand Screen Cinemas - {city}",
                "address": f"Central entertainment district, {city}, {city_info.get('state', '')}, India",
            })
    return specs


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    created_theatres = created_screens = created_shows = 0
    try:
        # Include both current and upcoming active catalogue titles. Upcoming
        # movies receive schedules beginning on their configured release date.
        movies = db.scalars(
            select(Movie)
            .where(Movie.is_active.is_(True))
            .order_by(Movie.id)
        ).all()
        if not movies:
            print("No active catalogue movies found. Run the catalogue seed first.")
            return

        now = now_local()
        today = now.date()
        specs = _theatre_specs()
        if not specs:
            print("No cinema directory entries found; nothing to seed.")
            return

        for theatre_index, spec in enumerate(specs):
            theatre = db.scalar(select(Theatre).where(
                Theatre.city == spec["city"], Theatre.name == spec["name"]
            ))
            # Upgrade names created by earlier versions in-place. Keeping the
            # same theatre row preserves screen/show foreign keys and bookings.
            if not theatre:
                legacy_names = [
                    f"{spec['name']} (CineBook Demo)",
                    f"CineBook Demo Multiplex - {spec['city']}",
                ]
                theatre = db.scalar(select(Theatre).where(
                    Theatre.city == spec["city"], Theatre.name.in_(legacy_names)
                ))
                if theatre:
                    theatre.name = spec["name"]
                    theatre.address = spec["address"]
                    db.flush()
            if not theatre:
                theatre = Theatre(
                    name=spec["name"], city=spec["city"], state=spec["state"],
                    address=spec["address"],
                    amenities="Digital Projection, Dolby Digital, Parking, Food Court",
                    is_active=True,
                )
                db.add(theatre)
                db.flush()
                created_theatres += 1

            city_index = next(
                (i for i, c in enumerate(CITIES)
                 if c["name"].casefold() == spec["city"].casefold()),
                theatre_index,
            )
            slots = TIME_SLOTS[(city_index + theatre_index) % len(TIME_SLOTS)]

            for movie_index, movie in enumerate(movies):
                # Each movie gets a dedicated demo screen at this venue so
                # multiple titles can have concurrent schedules without
                # double-booking the same screen.
                screen_name = f"CineBook Screen - {movie.id}"
                screen = db.scalar(select(Screen).where(
                    Screen.theatre_id == theatre.id,
                    Screen.name == screen_name,
                ))
                if not screen:
                    screen = Screen(
                        theatre_id=theatre.id,
                        name=screen_name,
                        screen_type="Premium 2D",
                        rows=10,
                        cols=12,
                        premium_rows=3,
                        recliner_rows=1,
                        projection_format="2K Digital",
                        sound_system="Dolby Digital",
                        accessible_seat_labels="A1,A12",
                        is_active=True,
                    )
                    db.add(screen)
                    db.flush()
                    created_screens += 1

                # Project demo mode: every active catalogue title (including
                # upcoming titles) receives test screenings from today. This is
                # deliberately separate from the movie's real-world release
                # metadata and must be labelled as simulated demo inventory.
                first_day = today
                end_day = first_day + timedelta(days=DAYS_TO_SEED)
                existing = set(db.scalars(select(Show.start_time).where(
                    Show.screen_id == screen.id,
                    Show.movie_id == movie.id,
                    Show.start_time >= datetime.combine(first_day, datetime.min.time()),
                    Show.start_time < datetime.combine(end_day + timedelta(days=1), datetime.min.time()),
                )).all())

                for day_offset in range(DAYS_TO_SEED + 1):
                    day = first_day + timedelta(days=day_offset)
                    for slot_index, (hour, minute) in enumerate(slots):
                        start = datetime(day.year, day.month, day.day, hour, minute)
                        if start <= now or start in existing:
                            continue
                        # Mild city/theatre/movie variation keeps demo prices
                        # realistic-looking without implying real market rates.
                        base_price = 170 + (city_index % 5) * 10 + (theatre_index % 3) * 10
                        db.add(Show(
                            movie_id=movie.id,
                            screen_id=screen.id,
                            start_time=start,
                            price_regular=base_price,
                            price_premium=base_price + 80,
                            price_recliner=base_price + 190,
                            format="2D" if slot_index != 1 else "Premium 2D",
                            is_active=True,
                        ))
                        created_shows += 1

        db.commit()
        print("\nCineBook all-city / all-movie demo inventory created successfully.")
        print(f"Directory cities: {len(CITIES)}")
        print(f"Theatre listings processed: {len(specs)}")
        print(f"Active catalogue movies scheduled: {len(movies)}")
        print(f"  Now showing: {sum(1 for m in movies if m.status == 'now_showing')}")
        print(f"  Upcoming: {sum(1 for m in movies if m.status == 'upcoming')}")
        print(f"New theatres: {created_theatres}")
        print(f"New screens: {created_screens}")
        print(f"New bookable showtimes: {created_shows}")
        print("\nGenerated schedules are simulated CineBook demo data, not live theatre schedules.")
        print("They use the existing database-backed seat map, seat holds, sandbox checkout and QR ticket flow.")
        print("Demo schedules are generated for all active movies regardless of release date; they are not real cinema schedules.")
        print("Safe to rerun: existing shows and bookings are preserved.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
