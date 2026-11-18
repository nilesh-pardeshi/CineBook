# All-city / all-movie booking fix

This update addresses two gaps observed in local screenshots:

1. `/api/cinema-directory/theatres?city=...` previously returned only the curated static list. Cities without curated entries therefore displayed `0` venues even when the demo seeder had created a CineBook venue in PostgreSQL. The endpoint now merges active database theatres into the directory response and marks generated venues as CineBook demo inventory.
2. `MovieDetail.jsx` intentionally skipped the showtime API for movies whose catalogue status was `upcoming`. It now loads showtimes for every active movie. Upcoming titles display a short disclosure that their project screenings are simulated demo inventory.

The all-city seeder now schedules every active catalogue movie from today for its seven-day demo window, regardless of the movie's real release date. This allows the same database-backed seat selection, seat holds, sandbox checkout and QR ticket workflow to be demonstrated for every active title.

## Apply

1. Merge this ZIP into the existing project. Preserve `.env`, `.venv`, and the PostgreSQL database.
2. Ensure the active movie catalogue is populated.
3. From `backend`, run:

```powershell
python seed_demo_showtimes.py
```

4. Restart FastAPI and React.
5. Test a movie with status `upcoming` as well as `now_showing` in Patna, Delhi, Mumbai and Pune.

No database migration is required. The seeder adds missing inventory without deleting existing theatres, shows, seats, or bookings. Re-running it is intended to be idempotent for the generated theatre/screen/show combinations.

## Important project disclosure

Generated theatres, showtimes, formats and prices are simulated CineBook project inventory. They are not official theatre schedules, real-time availability, or operator prices. Payments remain sandbox-only. Do not present these as live external cinema data.

## Verification performed in this build environment

- Python `compileall` for backend application and seeder: passed.
- ZIP integrity: passed after packaging.
- Frontend production build: not verified; `npm ci` did not complete in the build environment.
- PostgreSQL seed run and end-to-end browser booking: must be verified against the user's local database.
