from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import now_local
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # user | admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_local)


class Movie(Base):
    __tablename__ = "movies"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    genres: Mapped[str] = mapped_column(String(200), default="")  # comma separated
    language: Mapped[str] = mapped_column(String(40), default="Hindi")
    duration_min: Mapped[int] = mapped_column(Integer, default=120)
    certificate: Mapped[str] = mapped_column(String(5), default="UA")
    rating: Mapped[float] = mapped_column(default=0)
    poster_url: Mapped[Optional[str]] = mapped_column(String(500))
    backdrop_url: Mapped[Optional[str]] = mapped_column(String(500))
    trailer_url: Mapped[Optional[str]] = mapped_column(String(500))
    release_date: Mapped[Optional[date]] = mapped_column(Date)
    director: Mapped[str] = mapped_column(String(120), default="")
    cast_members: Mapped[str] = mapped_column(String(400), default="")
    status: Mapped[str] = mapped_column(String(20), default="now_showing")  # now_showing | upcoming
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Theatre(Base):
    __tablename__ = "theatres"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    city: Mapped[str] = mapped_column(String(80), index=True)
    address: Mapped[str] = mapped_column(String(300), default="")
    amenities: Mapped[str] = mapped_column(String(300), default="")
    state: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    circuit: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    screens: Mapped[list["Screen"]] = relationship(back_populates="theatre")


class Screen(Base):
    __tablename__ = "screens"
    id: Mapped[int] = mapped_column(primary_key=True)
    theatre_id: Mapped[int] = mapped_column(ForeignKey("theatres.id"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    screen_type: Mapped[str] = mapped_column(String(30), default="Standard")
    rows: Mapped[int] = mapped_column(Integer, default=10)
    cols: Mapped[int] = mapped_column(Integer, default=14)
    premium_rows: Mapped[int] = mapped_column(Integer, default=3)
    recliner_rows: Mapped[int] = mapped_column(Integer, default=0)
    projection_format: Mapped[str] = mapped_column(String(40), default="Digital 2K")
    sound_system: Mapped[str] = mapped_column(String(60), default="Dolby Digital")
    screen_width_ft: Mapped[Optional[float]] = mapped_column(nullable=True)
    screen_height_ft: Mapped[Optional[float]] = mapped_column(nullable=True)
    accessible_seat_labels: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    theatre: Mapped[Theatre] = relationship(back_populates="screens")

    @property
    def theatre_name(self) -> str:
        return f"{self.theatre.name} ({self.theatre.city})" if self.theatre else ""


class Show(Base):
    __tablename__ = "shows"
    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id"), index=True)
    screen_id: Mapped[int] = mapped_column(ForeignKey("screens.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    price_regular: Mapped[int] = mapped_column(Integer, default=200)
    price_premium: Mapped[int] = mapped_column(Integer, default=300)
    price_recliner: Mapped[int] = mapped_column(Integer, default=500)
    format: Mapped[str] = mapped_column(String(30), default="2D")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    movie: Mapped[Movie] = relationship()
    screen: Mapped[Screen] = relationship()

    __table_args__ = (Index("ix_shows_screen_start", "screen_id", "start_time"),)

    def price_for(self, category: str) -> int:
        return {"regular": self.price_regular, "premium": self.price_premium, "recliner": self.price_recliner}[category]


class FoodItem(Base):
    __tablename__ = "food_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300), default="")
    price: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(40), default="Snacks")
    emoji: Mapped[str] = mapped_column(String(8), default="🍿")
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Coupon(Base):
    __tablename__ = "coupons"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(200), default="")
    discount_type: Mapped[str] = mapped_column(String(10), default="percent")  # percent | flat
    value: Mapped[int] = mapped_column(Integer)
    max_discount: Mapped[Optional[int]] = mapped_column(Integer)
    min_amount: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[Optional[date]] = mapped_column(Date)
    valid_to: Mapped[Optional[date]] = mapped_column(Date)
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    one_per_user: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="PENDING")  # PENDING|CONFIRMED|CANCELLED|EXPIRED
    seats: Mapped[str] = mapped_column(String(200), default="")  # comma separated labels (kept for history)
    seat_total: Mapped[int] = mapped_column(Integer, default=0)
    food_total: Mapped[int] = mapped_column(Integer, default=0)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    fee: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    coupon_code: Mapped[Optional[str]] = mapped_column(String(30))
    payment_method: Mapped[Optional[str]] = mapped_column(String(20))
    payment_ref: Mapped[Optional[str]] = mapped_column(String(30))
    payment_detail: Mapped[Optional[str]] = mapped_column(String(60))
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    refund_amount: Mapped[int] = mapped_column(Integer, default=0)
    cancel_reason: Mapped[Optional[str]] = mapped_column(String(200))
    checked_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_local)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    user: Mapped[User] = relationship()
    show: Mapped[Show] = relationship()
    seat_rows: Mapped[list["BookingSeat"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    food_rows: Mapped[list["BookingFood"]] = relationship(back_populates="booking", cascade="all, delete-orphan")


class BookingSeat(Base):
    """One row per held/sold seat. The unique constraint is what prevents double booking."""
    __tablename__ = "booking_seats"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id"), index=True)
    label: Mapped[str] = mapped_column(String(6))
    category: Mapped[str] = mapped_column(String(10))
    price: Mapped[int] = mapped_column(Integer)
    booking: Mapped[Booking] = relationship(back_populates="seat_rows")

    __table_args__ = (UniqueConstraint("show_id", "label", name="uq_show_seat"),)


class BookingFood(Base):
    __tablename__ = "booking_food"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    food_id: Mapped[Optional[int]] = mapped_column(ForeignKey("food_items.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(120))
    qty: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)
    booking: Mapped[Booking] = relationship(back_populates="food_rows")


class ShowOccupancySnapshot(Base):
    """Time-series occupancy observations used to train and audit crowd forecasts."""
    __tablename__ = "show_occupancy_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=now_local, index=True)
    capacity: Mapped[int] = mapped_column(Integer)
    occupied_seats: Mapped[int] = mapped_column(Integer)
    fill_rate: Mapped[float] = mapped_column(Float)
    hours_to_start: Mapped[float] = mapped_column(Float)
    weekday: Mapped[int] = mapped_column(Integer)
    start_hour: Mapped[int] = mapped_column(Integer)
    is_weekend: Mapped[bool] = mapped_column(Boolean)
    show_format: Mapped[str] = mapped_column(String(30), default="2D")
    language: Mapped[str] = mapped_column(String(40), default="English")
    city: Mapped[str] = mapped_column(String(80), default="")
    show: Mapped[Show] = relationship()

    __table_args__ = (Index("ix_occupancy_show_captured", "show_id", "captured_at"),)
