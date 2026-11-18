
#!/bin/sh
set -e

echo "Running database migrations..."
python migrate_bootstrap.py

echo "Seeding CineBook catalogue..."
python seed.py

echo "Generating all-city, all-movie bookable demo showtimes..."
python seed_demo_showtimes.py

echo "Starting CineBook API..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
