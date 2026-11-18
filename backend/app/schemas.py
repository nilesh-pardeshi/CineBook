import re
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .config import settings


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        v = _blank_to_none(v)
        if v and not re.fullmatch(r"[+]?[0-9 \-]{7,15}", v):
            raise ValueError("Enter a valid phone number")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        v = _blank_to_none(v)
        if v and not re.fullmatch(r"[+]?[0-9 \-]{7,15}", v):
            raise ValueError("Enter a valid phone number")
        return v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    role: str


# ---------- Catalog (admin in/out) ----------
class MovieIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    genres: str = ""
    language: str = "Hindi"
    duration_min: int = Field(120, ge=30, le=400)
    certificate: str = "UA"
    rating: float = Field(0, ge=0, le=10)
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    trailer_url: Optional[str] = None
    release_date: Optional[date] = None
    director: str = ""
    cast_members: str = ""
    status: Literal["now_showing", "upcoming"] = "now_showing"
    is_featured: bool = False
    is_active: bool = True

    _urls = field_validator("poster_url", "backdrop_url", "trailer_url", mode="before")(_blank_to_none)
    _rd = field_validator("release_date", mode="before")(_blank_to_none)


class MovieOut(MovieIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TheatreIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    city: str = Field(min_length=2, max_length=80)
    address: str = ""
    amenities: str = ""
    state: Optional[str] = Field(None, max_length=80)
    circuit: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    is_active: bool = True


class TheatreOut(TheatreIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ScreenIn(BaseModel):
    theatre_id: int
    name: str = Field(min_length=1, max_length=60)
    screen_type: str = "Standard"
    rows: int = Field(10, ge=3, le=26)
    cols: int = Field(14, ge=4, le=30)
    premium_rows: int = Field(3, ge=0, le=20)
    recliner_rows: int = Field(0, ge=0, le=10)
    projection_format: str = Field("Digital 2K", max_length=40)
    sound_system: str = Field("Dolby Digital", max_length=60)
    screen_width_ft: Optional[float] = Field(None, gt=0, le=200)
    screen_height_ft: Optional[float] = Field(None, gt=0, le=150)
    accessible_seat_labels: str = Field("", max_length=500)
    is_active: bool = True

    @model_validator(mode="after")
    def _check(self):
        if self.premium_rows + self.recliner_rows >= self.rows:
            raise ValueError("Premium + recliner rows must be fewer than total rows")
        return self


class ScreenOut(ScreenIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    theatre_name: str = ""


class ShowIn(BaseModel):
    movie_id: int
    screen_id: int
    start_time: datetime
    price_regular: int = Field(200, ge=0, le=5000)
    price_premium: int = Field(300, ge=0, le=5000)
    price_recliner: int = Field(500, ge=0, le=10000)
    format: Literal["2D", "3D", "IMAX 2D", "4DX", "Dolby Atmos", "P[XL]"] = "2D"
    is_active: bool = True

    @field_validator("start_time")
    @classmethod
    def _naive(cls, v):
        if v.tzinfo:
            from zoneinfo import ZoneInfo

            v = v.astimezone(ZoneInfo(settings.TIMEZONE)).replace(tzinfo=None)
        return v.replace(second=0, microsecond=0)


class BulkShowIn(BaseModel):
    movie_id: int
    screen_id: int
    start_date: date
    end_date: date
    times: list[str] = Field(min_length=1, max_length=8)
    price_regular: int = Field(200, ge=0, le=5000)
    price_premium: int = Field(300, ge=0, le=5000)
    price_recliner: int = Field(500, ge=0, le=10000)
    format: Literal["2D", "3D", "IMAX 2D", "4DX", "Dolby Atmos", "P[XL]"] = "2D"

    @field_validator("times")
    @classmethod
    def _times(cls, v):
        for t in v:
            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", t):
                raise ValueError(f"Invalid time '{t}', use HH:MM")
        return v


class FoodIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    price: int = Field(ge=1, le=5000)
    category: str = "Snacks"
    emoji: str = "🍿"
    is_veg: bool = True
    is_active: bool = True


class FoodOut(FoodIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class CouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    description: str = ""
    discount_type: Literal["percent", "flat"] = "percent"
    value: int = Field(ge=1, le=100000)
    max_discount: Optional[int] = Field(None, ge=1)
    min_amount: int = Field(0, ge=0)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    usage_limit: Optional[int] = Field(None, ge=1)
    one_per_user: bool = False
    is_active: bool = True

    _dates = field_validator("valid_from", "valid_to", "max_discount", "usage_limit", mode="before")(_blank_to_none)

    @field_validator("code")
    @classmethod
    def _code(cls, v):
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]{3,30}", v):
            raise ValueError("Code may only contain letters, numbers, - and _")
        return v

    @model_validator(mode="after")
    def _check(self):
        if self.discount_type == "percent" and self.value > 100:
            raise ValueError("Percent discount cannot exceed 100")
        return self


class CouponOut(CouponIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    used_count: int = 0


# ---------- Booking ----------
class BookingCreate(BaseModel):
    show_id: int
    seats: list[str] = Field(min_length=1)


class FoodLine(BaseModel):
    food_id: int
    qty: int = Field(ge=0, le=10)


class FoodUpdate(BaseModel):
    items: list[FoodLine]


class CouponApply(BaseModel):
    code: str = Field(min_length=1, max_length=30)


class PayIn(BaseModel):
    method: Literal["card", "upi", "netbanking", "wallet"]
    card_number: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None
    card_name: Optional[str] = None
    upi_id: Optional[str] = None
    bank: Optional[str] = None
    wallet: Optional[str] = None
