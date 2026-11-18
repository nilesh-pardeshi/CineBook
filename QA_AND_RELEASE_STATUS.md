# CineBook QA and release status

This report distinguishes checks executed in the packaging workspace from checks that require the developer's PostgreSQL database, installed frontend dependencies, browser, API credentials, or hosted services.

## Verified in the packaging workspace

- Backend Python compilation: `python -m compileall -q backend/app backend/collect_occupancy.py backend/train_crowd_model.py` — passed.
- Backend Python AST parsing for every `.py` module under `backend/app` — passed.
- AI unit tests: from `backend/`, `python -m pytest -q tests` — **3 passed**.
- Source inspection confirms `main.py` registers authentication, catalogue, booking, admin, cinema, AI, movie discovery, and concierge routers.
- Added backend and frontend `.env.example` files; no real credentials are included.
- Renamed the database-mutating API smoke runner to `backend/tests/run_api_smoke.py` so ordinary pytest collection does not execute it.

## Not verified in the packaging workspace

- Full API smoke suite: `backend/tests/run_api_smoke.py` requires a running, seeded PostgreSQL database and exercises destructive test-data creation/cleanup. Run only against a dedicated development/test database, never production.
- Frontend `npm ci` and `npm run build`: dependency installation could not complete because package registry network access was unavailable; Vite was therefore unavailable for the build. Run locally with Node.js 18+.
- Full FastAPI import/startup and database-backed endpoint tests: this workspace lacks required runtime packages (including the PostgreSQL driver and bcrypt) and has no user database configured.
- End-to-end browser workflows, TMDB token calls, scheduled hourly collection, trained crowd model quality, and deployment health checks require the user's environment and credentials.

## Local verification sequence (Windows PowerShell)

1. Start PostgreSQL (or `docker compose up -d db` if Docker Desktop is available).
2. In `backend`, create/activate a virtual environment, install `requirements.txt`, copy `.env.example` to `.env`, and set `DATABASE_URL` and a development `SECRET_KEY`.
3. Run `python migrate_bootstrap.py`. Existing databases already stamped at `20261117_02` should simply report that they are current; do not stamp again or reset the database.
4. Run `python seed.py` only if you intend to add the demo catalogue to this database.
5. Run `python -m pytest -q tests` from `backend`.
6. Run `python tests/run_api_smoke.py` only against a dedicated disposable test database. The smoke runner creates users, bookings, movies, theatres, screens, shows, food items and coupons, then cleans up test data where possible.
7. Start the API with `uvicorn app.main:app --reload --port 8000` and inspect `/api/health` and `/docs`.
8. In `frontend`, run `npm ci`, then `npm run build`, then `npm run dev`.
9. Test customer and admin journeys manually, including booking conflicts, expired holds, payment sandbox behaviour, QR ticket, cancellation, and all AI endpoints.

## AI occupancy data requirements

The previously collected 840 snapshots were collected in one batch and are not 840 independent temporal training examples. Keep the hourly collector running so each show accumulates observations at least 30 minutes apart. The trainer currently requires at least 30 paired temporal rows across 10 distinct shows, with the terminal observation within six hours of showtime. This is a minimum technical gate, not evidence of production-grade accuracy. Report held-out metrics honestly.

## Release blockers before production

- Configure production PostgreSQL, a strong `SECRET_KEY`, exact `CORS_ORIGINS`, and TMDB token if desired.
- Run migrations and smoke tests against a staging database before release.
- Integrate and verify a real payment provider before accepting money. Current payment and refund handling is sandbox/demo only.
- Review privacy, security, logging, rate limiting, backups, monitoring, and TMDB attribution/licensing requirements.
- Verify deployed frontend and backend together with real browser tests.
