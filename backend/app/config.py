import os
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cinebook")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-change-me-in-production-0123456789")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
    TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
    TMDB_READ_ACCESS_TOKEN = os.getenv("TMDB_READ_ACCESS_TOKEN", "").strip()
    SEAT_HOLD_MINUTES = int(os.getenv("SEAT_HOLD_MINUTES", "7"))
    CONVENIENCE_FEE = int(os.getenv("CONVENIENCE_FEE_PER_TICKET", "20"))
    MAX_SEATS = 8
    CANCEL_CUTOFF_HOURS = 2
    TURNAROUND_MINUTES = 15  # cleaning buffer between shows on a screen


settings = Settings()


def now_local() -> datetime:
    """Naive 'wall clock' time in the theatre timezone. All show/booking times use this."""
    return datetime.now(ZoneInfo(settings.TIMEZONE)).replace(tzinfo=None)
