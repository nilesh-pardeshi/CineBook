from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

url = settings.DATABASE_URL
# Render/Heroku/Railway hand out postgres:// or postgresql:// URLs. Pin the psycopg2 driver explicitly,
# because newer SQLAlchemy versions default plain "postgresql://" to psycopg3.
if url.startswith("postgres://"):
    url = "postgresql+psycopg2://" + url[len("postgres://"):]
elif url.startswith("postgresql://"):
    url = "postgresql+psycopg2://" + url[len("postgresql://"):]

is_sqlite = url.startswith("sqlite")
engine = create_engine(
    url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)

if is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_fk(conn, _record):
        conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
