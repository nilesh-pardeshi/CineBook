# CineBook: all-city, all-movie bookable demo showtimes

This seeder creates database-backed demo inventory for **every city in the CineBook directory, every listed directory theatre, and every active movie in the catalogue** (both `now_showing` and `upcoming`). The generated schedules are simulated CineBook project data, not live operator schedules.

## One-time setup

1. Start PostgreSQL and confirm `backend/.env` has the correct `DATABASE_URL`.
2. Activate the backend virtual environment.
3. Ensure the movie catalogue contains active movies. Run the existing catalogue seed first if the catalogue is empty.
4. Run from the backend directory:

```powershell
python seed_demo_showtimes.py
```

## What it creates

- Demo theatre inventory for all 26 directory cities.
- Every named theatre in the cinema directory (57 directory entries in the included catalogue), plus a sample venue with a realistic display name for any city without a named directory venue.
- One screen per active catalogue movie at each demo theatre, allowing different movies to run at the same time without sharing a screen.
- Three showtimes per day for seven days per movie. For upcoming movies, the schedule starts on the movie's configured release date.
- Real `theatres`, `screens`, and `shows` rows consumed by existing CineBook APIs.

The seeder is idempotent for generated inventory. It does not delete existing shows, theatres, seats, or bookings. Rerun it to add the next seven-day schedule window. Existing real showtimes are left untouched.

## Complete booking journey

1. Open any active movie's detail page and select a directory city.
2. Select a date, theatre and showtime.
3. The showtime opens the existing seat-selection page and loads the database-backed seat map.
4. Select seats and continue; the existing booking endpoint creates a time-limited seat hold.
5. Checkout uses the existing sandbox payment flow.
6. Successful sandbox payment confirms the booking and generates the QR ticket, visible in the confirmation page and My Bookings.

## Demo boundaries

- Theatre display names are kept clean and do not include “Demo”. Sample venue status is communicated separately in the directory UI and project documentation.
- Times and prices are simulated. Label them as demo data in presentations.
- Upcoming titles receive schedules from their configured release date. If a release date is missing, schedules start today.
- Payments remain sandbox/demo only; do not accept real customer payments until a payment gateway is integrated and tested.
- Do not run against production inventory without reviewing the seed plan.

## Verify after seeding

In pgAdmin, check counts:

```sql
SELECT COUNT(*) AS active_movies FROM movies WHERE is_active = TRUE;
SELECT COUNT(*) AS sample_theatres FROM theatres WHERE name LIKE 'Grand Screen Cinemas - %';
SELECT COUNT(*) AS demo_screens FROM screens WHERE name LIKE 'CineBook Screen - %';
SELECT COUNT(*) AS future_shows FROM shows WHERE is_active = TRUE AND start_time > NOW();
```

Then restart FastAPI and React and test one booking through QR-ticket generation.
