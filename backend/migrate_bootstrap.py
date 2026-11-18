"""Initialize fresh databases or upgrade existing CineBook MVP databases safely."""
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from app import models  # noqa: F401
from app.database import Base, engine


def main():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    cfg = Config("alembic.ini")
    if not tables or "users" not in tables:
        Base.metadata.create_all(bind=engine)
        command.stamp(cfg, "head")
        print("Fresh CineBook schema created and Alembic stamped at head.")
    else:
        with engine.connect() as conn:
            has_version = "alembic_version" in inspect(conn).get_table_names()
        if not has_version:
            # This is the pre-Alembic MVP. Apply the additive upgrade migration.
            command.upgrade(cfg, "head")
            print("Existing CineBook MVP schema upgraded.")
        else:
            command.upgrade(cfg, "head")
            print("CineBook database is at the latest migration.")

if __name__ == "__main__":
    main()
