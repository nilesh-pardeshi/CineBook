"""Seed CineBook with realistic sample data.

    python seed.py            # idempotent: creates data once, then only tops up upcoming showtimes
    python seed.py --reset    # DROP everything and start fresh
    SEED_BOOKINGS=0 python seed.py   # catalogue only, no demo booking history

Safe to run on every deploy: showtimes for the next 7 days are topped up each time, so the demo
never runs out of future shows.
"""
import os
import random
import sys
from datetime import date, datetime, timedelta

from sqlalchemy import select

from app import models  # noqa: F401
from app.config import now_local
from app.database import Base, SessionLocal, engine
from app.layout import ROW_LETTERS, seat_key, seat_map
from app.models import (
    Booking, BookingFood, BookingSeat, Coupon, FoodItem, Movie, Screen, Show, Theatre, User,
)
from app.security import hash_password
from app.services import has_overlap, new_ref, recalc_booking

SLOTS = ["10:00", "13:30", "17:00", "20:30"]
DAYS_AHEAD = 7
DAYS_BACK = 14

# ---------------------------------------------------------------- data
MOVIES = [
    dict(title="Kesari Rising", genres="Action, Drama", language="Hindi", duration_min=158, certificate="UA", rating=8.4,
         director="Rohan Mehra", cast_members="Vikrant Sood, Anaya Kapoor, Dev Malhotra", is_featured=True, release_offset=-12,
         description="A disgraced army officer returns to his mountain village and finds it under the grip of a ruthless smuggling syndicate. To save the people who once rejected him, he must rebuild the legend he left behind."),
    dict(title="Starfall: The Last Frontier", genres="Sci-Fi, Adventure", language="English", duration_min=148, certificate="UA", rating=8.7,
         director="Elena Brandt", cast_members="Mark Hollis, Priya Nair, Jonas Weber", is_featured=True, release_offset=-9,
         description="When a dying star threatens the last human colony, a crew of misfit explorers races across the galaxy to find a new home - and discovers they are not the first to try."),
    dict(title="Whispers of the Ghats", genres="Drama, Romance", language="Marathi", duration_min=132, certificate="U", rating=8.1,
         director="Sanjay Kulkarni", cast_members="Mrunal Joshi, Aditya Patwardhan, Sulabha Rane", is_featured=True, release_offset=-20,
         description="Set against the misty Sahyadri monsoon, a young photographer and a village schoolteacher find an unlikely love story hidden in letters from the past."),
    dict(title="Midnight Heist", genres="Thriller, Crime", language="English", duration_min=124, certificate="UA", rating=7.9,
         director="Daniel Ruiz", cast_members="Sarah Whitlock, Omar Haddad, Liam Cole", is_featured=False, release_offset=-6,
         description="Five strangers, one vault, and ninety minutes before sunrise. A razor-sharp heist thriller where nobody is who they claim to be."),
    dict(title="Love in Lonavala", genres="Romance, Comedy", language="Hindi", duration_min=141, certificate="UA", rating=7.2,
         director="Kabir Anand", cast_members="Tara Sethi, Rishi Bhatt, Neena Gill", is_featured=False, release_offset=-14,
         description="Two rival wedding planners are forced to co-run the biggest destination wedding of the season. Chaos, chai and chemistry follow."),
    dict(title="The Haunting of Haveli", genres="Horror, Mystery", language="Hindi", duration_min=119, certificate="A", rating=7.0,
         director="Aarti Bose", cast_members="Zoya Khan, Karan Oberoi, Meera Pillai", is_featured=False, release_offset=-4,
         description="A paranormal investigator checks into a crumbling royal haveli to debunk its legend - and learns why no guest has ever stayed past the third night."),
    dict(title="Pixel Pals", genres="Animation, Family", language="English", duration_min=96, certificate="U", rating=8.0,
         director="Hannah Lowe", cast_members="Voices of Ethan Park, Lily Ford, Samir Das", is_featured=False, release_offset=-18,
         description="When a forgotten video game character wanders into the real world, three kids must help him find his way home before the power runs out."),
    dict(title="Vettai: The Hunt", genres="Action, Thriller", language="Tamil", duration_min=162, certificate="UA", rating=8.2,
         director="Karthik Raghavan", cast_members="Surya Pandian, Nandini Iyer, Raghu Varma", is_featured=False, release_offset=-8,
         description="A relentless cop chases a master criminal across three cities in 72 hours, in a high-octane thriller with a final twist you won't see coming."),
    dict(title="Cricket Fever", genres="Sports, Drama", language="Hindi", duration_min=146, certificate="U", rating=7.8,
         director="Manoj Tiwari", cast_members="Arjun Rawat, Simran Kohli, Bharat Gupta", is_featured=False, release_offset=-11,
         description="The true-spirit story of a small-town coach who takes a team of street cricketers all the way to the national finals."),
    dict(title="Kaalchakra", genres="Fantasy, Mythology", language="Telugu", duration_min=169, certificate="UA", rating=8.5,
         director="Srinivas Rao", cast_members="Ram Teja, Divya Reddy, Naga Prasad", is_featured=False, release_offset=-7,
         description="An epic fantasy spanning four ages, where a young warrior must unite scattered kingdoms to stop a cosmic cycle from collapsing."),
    dict(title="Neon Ronin", genres="Sci-Fi, Action", language="English", duration_min=134, certificate="UA", rating=0,
         director="Kenji Aoki", cast_members="Yuki Tanaka, Chris Maddox, Isla Moreno", is_featured=False, release_offset=18, status="upcoming",
         description="In a rain-soaked cyberpunk metropolis, a masterless swordsman takes one last contract that could free - or doom - the entire city."),
    dict(title="Monsoon Melodies", genres="Musical, Romance", language="Marathi", duration_min=128, certificate="U", rating=0,
         director="Sneha Deshpande", cast_members="Ketaki Sathe, Omkar Bhosale, Vandana Gupte", is_featured=False, release_offset=25, status="upcoming",
         description="A struggling folk singer and a classical prodigy collide on a reality show and find the rhythm of a lifetime."),
    dict(title="Dark Orbit 2", genres="Sci-Fi, Thriller", language="English", duration_min=141, certificate="UA", rating=0,
         director="Elena Brandt", cast_members="Nora Faulkner, Dev Khanna, Marcus Bell", is_featured=False, release_offset=32, status="upcoming",
         description="The survivors of the Orbit station signal return - but the voice on the radio isn't one of theirs."),
]

THEATRES = [
    ("Pune", "CineBook Premiere - Koregaon Park", "Lane 7, Koregaon Park, Pune 411001", "Dolby Atmos, Recliners, Food Court, Valet Parking", 1.0),
    ("Pune", "Starplex - Viman Nagar", "Phoenix Mall Road, Viman Nagar, Pune 411014", "4K Laser, Parking, Food Court, Wheelchair Access", 1.0),
    ("Pune", "Galaxy Cinemas - Hinjewadi", "Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057", "Dolby Atmos, Parking, Cafe", 0.95),
    ("Mumbai", "Marine Screens - Andheri West", "Link Road, Andheri West, Mumbai 400053", "IMAX, Dolby Atmos, Recliners, Parking", 1.25),
    ("Mumbai", "Orion Multiplex - Lower Parel", "High Street Phoenix, Lower Parel, Mumbai 400013", "4K Laser, Food Court, Parking", 1.2),
    ("Bengaluru", "Garden City Cinemas - Indiranagar", "100 Feet Road, Indiranagar, Bengaluru 560038", "Dolby Atmos, Recliners, Cafe", 1.1),
    ("Bengaluru", "Tech Park Screens - Whitefield", "ITPL Main Road, Whitefield, Bengaluru 560066", "4K Laser, Parking, Food Court", 1.05),
]

# (name, type, rows, cols, premium_rows, recliner_rows, regular, premium, recliner)
SCREEN_TYPES = [
    ("Audi 1", "Standard 2D", 10, 14, 4, 0, 180, 260, 0),
    ("Audi 2", "Dolby Atmos", 9, 12, 3, 2, 230, 320, 520),
]
IMAX = ("IMAX Screen", "IMAX", 12, 16, 4, 2, 320, 420, 680)

FOOD = [
    ("Salted Popcorn (Regular)", "Freshly popped, lightly salted", 180, "Popcorn", "🍿", True),
    ("Salted Popcorn (Large)", "Big tub for sharing", 260, "Popcorn", "🍿", True),
    ("Caramel Popcorn", "Sweet, crunchy caramel coating", 230, "Popcorn", "🍯", True),
    ("Cheese Popcorn", "Loaded with cheddar dust", 240, "Popcorn", "🧀", True),
    ("Nachos with Salsa", "Crispy nachos, tangy salsa dip", 200, "Snacks", "🌮", True),
    ("Veg Burger", "Crispy patty, lettuce, cheese slice", 160, "Snacks", "🍔", True),
    ("Chicken Burger", "Juicy grilled chicken patty", 190, "Snacks", "🍔", False),
    ("Samosa (2 pcs)", "Hot, spicy potato samosas with chutney", 90, "Snacks", "🥟", True),
    ("French Fries", "Golden fries with peri-peri seasoning", 140, "Snacks", "🍟", True),
    ("Coke (500 ml)", "Chilled soft drink", 120, "Beverages", "🥤", True),
    ("Iced Tea", "Lemon iced tea", 130, "Beverages", "🧋", True),
    ("Cold Coffee", "Thick and creamy cold coffee", 150, "Beverages", "☕", True),
    ("Mineral Water", "500 ml bottle", 40, "Beverages", "💧", True),
    ("Movie Combo", "Large popcorn + 2 Cokes", 420, "Combos", "🎬", True),
    ("Couple Combo", "2 regular popcorn + 2 drinks + nachos", 620, "Combos", "💑", True),
]

COUPONS = [
    dict(code="WELCOME50", description="50% off on your first booking (up to Rs.150)", discount_type="percent", value=50, max_discount=150, min_amount=300, one_per_user=True),
    dict(code="FLAT100", description="Flat Rs.100 off on orders above Rs.600", discount_type="flat", value=100, min_amount=600),
    dict(code="WEEKEND20", description="20% off up to Rs.200 on orders above Rs.400", discount_type="percent", value=20, max_discount=200, min_amount=400),
    dict(code="FOODIE15", description="15% off up to Rs.100 when you add snacks (orders above Rs.250)", discount_type="percent", value=15, max_discount=100, min_amount=250),
    dict(code="CINEBOOK25", description="25% off up to Rs.250 on big bookings above Rs.800 (first 500 uses)", discount_type="percent", value=25, max_discount=250, min_amount=800, usage_limit=500),
]

CUSTOMERS = [
    ("Aarav Sharma", "aarav@example.com"), ("Diya Patel", "diya@example.com"), ("Vihaan Joshi", "vihaan@example.com"),
    ("Ananya Iyer", "ananya@example.com"), ("Rohan Kulkarni", "rohan@example.com"), ("Ishita Verma", "ishita@example.com"),
    ("Kabir Singh", "kabir@example.com"), ("Meera Nair", "meera@example.com"),
]


# ---------------------------------------------------------------- helpers
def get_or_create_user(db, name, email, password, role="user", phone=None):
    u = db.scalar(select(User).where(User.email == email))
    if not u:
        u = User(name=name, email=email, password_hash=hash_password(password), role=role, phone=phone)
        db.add(u)
        db.flush()
    return u


def ensure_shows(db, start_offset=-DAYS_BACK, end_offset=DAYS_AHEAD):
    """Create (idempotently) a daily timetable on every active screen."""
    # Only manage the sample catalogue, never movies/theatres an admin added by hand.
    seed_titles = {m["title"] for m in MOVIES}
    seed_theatres = {t[1] for t in THEATRES}
    movies = db.scalars(
        select(Movie).where(Movie.status == "now_showing", Movie.is_active == True, Movie.title.in_(seed_titles)).order_by(Movie.id)  # noqa: E712
    ).all()
    if not movies:
        return 0
    screens = db.scalars(
        select(Screen).join(Theatre).where(Screen.is_active == True, Theatre.is_active == True, Theatre.name.in_(seed_theatres)).order_by(Screen.id)  # noqa: E712
    ).all()
    today = now_local().date()
    created = 0
    for si, screen in enumerate(screens):
        mult = {"Mumbai": 1.25, "Bengaluru": 1.1, "Pune": 1.0}.get(screen.theatre.city, 1.0)
        base = (180, 260, 520) if screen.screen_type != "IMAX" else (320, 420, 680)
        if screen.screen_type == "Dolby Atmos":
            base = (230, 320, 520)
        existing = {
            s.start_time
            for s in db.scalars(select(Show).where(Show.screen_id == screen.id, Show.start_time >= datetime.combine(today + timedelta(days=start_offset), datetime.min.time())))
        }
        for d in range(start_offset, end_offset + 1):
            day = today + timedelta(days=d)
            for k, slot in enumerate(SLOTS):
                hh, mm = map(int, slot.split(":"))
                start = datetime(day.year, day.month, day.day, hh, mm)
                if start in existing:
                    continue
                movie = movies[(si * 3 + (d + 10) * 2 + k) % len(movies)]
                if has_overlap(db, screen.id, start, movie.duration_min):
                    continue
                weekend = 1.1 if day.weekday() >= 5 else 1.0
                evening = 1.1 if hh >= 17 else 1.0
                f = mult * weekend * evening
                db.add(Show(
                    movie_id=movie.id, screen_id=screen.id, start_time=start,
                    price_regular=round(base[0] * f / 10) * 10,
                    price_premium=round(base[1] * f / 10) * 10,
                    price_recliner=round(base[2] * f / 10) * 10,
                ))
                created += 1
        db.flush()
    return created


def make_booking(db, user, show, labels, when, foods):
    smap = seat_map(show.screen)
    b = Booking(
        ref=new_ref(), user_id=user.id, show_id=show.id, status="CONFIRMED",
        seats=",".join(sorted(labels, key=seat_key)), created_at=when, paid_at=when,
        payment_method=random.choice(["card", "upi", "upi", "netbanking", "wallet"]),
    )
    b.payment_ref = "PAY" + "".join(random.choices("0123456789ABCDEF", k=10))
    b.payment_detail = "Sample payment"
    for label in labels:
        b.seat_rows.append(BookingSeat(show_id=show.id, label=label, category=smap[label], price=show.price_for(smap[label])))
    for f in foods:
        b.food_rows.append(BookingFood(food_id=f.id, name=f.name, qty=random.randint(1, 2), unit_price=f.price))
    recalc_booking(db, b)
    db.add(b)
    return b


def seed_sample_bookings(db, users):
    """History for the dashboard + partially filled seat maps for the next few days."""
    random.seed(42)
    foods = db.scalars(select(FoodItem)).all()
    now = now_local()
    taken = {}
    count = 0

    def try_book(show, fill_booking_when):
        nonlocal count
        screen = show.screen
        n = random.choice([1, 2, 2, 3, 4])
        used = taken.setdefault(show.id, set())
        for _ in range(6):
            row = random.randrange(screen.rows)
            start = random.randrange(screen.cols - n + 1)
            labels = [f"{ROW_LETTERS[row]}{start + i + 1}" for i in range(n)]
            if not used.intersection(labels):
                used.update(labels)
                make_booking(db, random.choice(users), show, labels, fill_booking_when,
                             random.sample(foods, random.choice([0, 0, 1, 2])))
                count += 1
                return

    for show in db.scalars(select(Show).where(Show.start_time < now)):
        if random.random() < 0.55:
            for _ in range(random.randint(2, 6)):
                try_book(show, show.start_time - timedelta(hours=random.randint(2, 40)))
    for show in db.scalars(select(Show).where(Show.start_time >= now, Show.start_time < now + timedelta(days=3))):
        for _ in range(random.randint(1, 8)):
            try_book(show, now - timedelta(hours=random.randint(1, 240)))
    db.flush()
    return count


def main():
    reset = "--reset" in sys.argv
    if reset:
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        fresh = db.scalar(select(Movie.id).limit(1)) is None
        if fresh:
            print("Seeding users, movies, theatres, food and coupons...")
            get_or_create_user(db, "CineBook Admin", "admin@cinebook.com", "Admin@123", role="admin", phone="9800000000")
            demo = get_or_create_user(db, "Demo User", "user@cinebook.com", "User@123", phone="9811111111")
            customers = [get_or_create_user(db, n, e, "User@123") for n, e in CUSTOMERS]

            today = now_local().date()
            for m in MOVIES:
                m = dict(m)
                offset = m.pop("release_offset")
                m.setdefault("status", "now_showing")
                db.add(Movie(release_date=today + timedelta(days=offset), **m))

            for city, name, address, amenities, _ in THEATRES:
                t = Theatre(name=name, city=city, address=address, amenities=amenities)
                db.add(t)
                db.flush()
                configs = list(SCREEN_TYPES)
                if "IMAX" in amenities:
                    configs.append(IMAX)
                for cfg in configs:
                    db.add(Screen(theatre_id=t.id, name=cfg[0], screen_type=cfg[1], rows=cfg[2], cols=cfg[3],
                                  premium_rows=cfg[4], recliner_rows=cfg[5]))
            for n, desc, price, cat, emoji, veg in FOOD:
                db.add(FoodItem(name=n, description=desc, price=price, category=cat, emoji=emoji, is_veg=veg))
            far = today + timedelta(days=365)
            for c in COUPONS:
                db.add(Coupon(valid_from=today - timedelta(days=30), valid_to=far, **c))
            db.flush()

        n = ensure_shows(db)
        print(f"Created {n} showtimes")
        if fresh and os.getenv("SEED_BOOKINGS", "1") != "0":  # set SEED_BOOKINGS=0 for an empty production start
            print("Creating sample bookings (this takes a few seconds)...")
            users = db.scalars(select(User).where(User.role == "user", User.email != "user@cinebook.com")).all()
            print(f"Created {seed_sample_bookings(db, users)} sample bookings")
        db.commit()

    print("\nDone.\n  Admin: admin@cinebook.com / Admin@123\n  User : user@cinebook.com  / User@123")


if __name__ == "__main__":
    main()
