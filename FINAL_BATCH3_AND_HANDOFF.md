# CineBook – Final Batch 3 handoff

This bundle is the integrated CineBook source (original project + Indian cinema/backend expansion + frontend expansion + TMDB discovery + combined search + AI concierge/occupancy pipeline), with the final data-collection and model-evaluation improvements.

## What is complete in the codebase

- Existing React/Vite + FastAPI + PostgreSQL application and its existing auth, seat-hold/booking, payment sandbox, QR ticket, cancellation, admin and seed flows.
- Indian cinema metadata, cinema/screen details, seat recommendation and crowd-insight endpoints from the prior batches.
- TMDB-backed discovery via FastAPI (keep the Read Access Token only in `backend/.env`); local bookable catalogue results remain distinct from external discovery results.
- AI concierge that searches real CineBook show and food data using deterministic preference extraction. It is not represented as a generative LLM.
- Occupancy snapshot schema, admin endpoint and deterministic fallback predictor.
- New `backend/collect_occupancy.py` local scheduled collector. It uses the existing database configuration and the same 30-minute per-show collection guard as the API endpoint; it does not need a copied admin JWT.
- Improved `backend/train_crowd_model.py`: trains only on repeated time-series observations, holds out entire shows using `GroupShuffleSplit` to reduce show-level leakage, and reports MAE/RMSE/R² on held-out shows.

## Important: what cannot honestly be marked complete yet

The current database has 840 snapshots from one collection time. Those are useful baseline records, but they are not 840 independent historical training examples. A supervised forecast needs repeated observations of the same shows over time, with a later observation near showtime. Therefore no trained model artifact or accuracy claim is included. The deterministic predictor remains the safe fallback until enough genuine time-series data exists.

## Apply this integrated bundle

1. Back up your current project folder and PostgreSQL database.
2. Extract this ZIP. It contains the complete `CineBook/` project directory.
3. For the safest migration from your current working folder, copy the updated files into your existing project, but do not overwrite `backend/.env`, `frontend/.env`, your local virtual environment, or any user-specific secrets.
4. Keep your database at Alembic revision `20261117_02` (already confirmed in your local run). Do not stamp or rerun old migrations unnecessarily.
5. Backend:

   ```powershell
   cd CineBook\backend
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python migrate_bootstrap.py
   python -m compileall app collect_occupancy.py train_crowd_model.py
   python -m pytest -q tests
   uvicorn app.main:app --reload --port 8000
   ```

6. Frontend, in a second terminal:

   ```powershell
   cd CineBook\frontend
   npm install
   npm run build
   npm run dev
   ```

7. Verify login, movie search, TMDB import, movie detail/trailer, cinema details, seat recommendation, seat hold, checkout, payment sandbox, ticket, cancellation and admin operations before deployment.

## Build real occupancy history

### Manual collection

Log in as an admin in Swagger and call `POST /api/ai/admin/snapshots/collect` no more often than once every 30 minutes per show. The endpoint already skips a show if a snapshot was captured within the previous 30 minutes.

### Automated local collection (recommended for development)

Run from `backend/`:

```powershell
python collect_occupancy.py
```

Create a Windows Task Scheduler task:

- Trigger: Daily, repeat every 1 hour, indefinitely.
- Action: Start a program.
- Program: the full path to your backend virtualenv Python, e.g. `C:\Users\<you>\...\CineBook\backend\.venv\Scripts\python.exe`.
- Arguments: `collect_occupancy.py`.
- Start in: the full path to `CineBook\backend`.
- Run only when the machine is available and connected to the database.

The script loads `backend/.env` via the existing settings module. Do not put JWTs or database passwords in Task Scheduler arguments.

### Dataset readiness and training

Run this SQL in pgAdmin to inspect collection history:

```sql
SELECT
    COUNT(*) AS snapshots,
    COUNT(DISTINCT show_id) AS shows,
    COUNT(DISTINCT captured_at) AS capture_times,
    MIN(captured_at) AS first_capture,
    MAX(captured_at) AS latest_capture
FROM show_occupancy_snapshots;
```

Train from `backend/` only after the script reports enough paired observations:

```powershell
python train_crowd_model.py
```

The trainer requires at least 30 paired rows across 10 distinct shows, and a terminal observation within six hours of showtime. It then uses a show-level holdout split. The minimum threshold is a technical gate, not proof of robust generalization; collect substantially more varied shows and inspect metrics before making academic accuracy claims.

The trained artifact is written to `backend/app/ai/artifacts/crowd_model.joblib`. It is a local generated artifact and should not be committed to Git unless you intentionally manage model artifacts. If the artifact is absent, the API uses the deterministic fallback.

## Deployment checklist

- Set `DATABASE_URL`, a strong `SECRET_KEY`, `APP_TIMEZONE=Asia/Kolkata`, `CORS_ORIGINS`, and `TMDB_READ_ACCESS_TOKEN` in the backend hosting provider's environment settings.
- Set frontend `VITE_API_URL` to the deployed backend URL and rebuild the frontend.
- Never commit `.env`, JWTs, passwords, or TMDB tokens.
- Run Alembic migrations as part of deployment startup using the project's configured start command; do not use `create_all()` as a substitute for migrations in production.
- Use a managed PostgreSQL database with backups.
- The sandbox payment flow is a demonstration, not live payment processing. Integrate and verify a real payment gateway before accepting real money.
- TMDB free developer access has usage/licensing conditions and requires attribution. Confirm the applicable terms before any commercial operation.
- Configure a scheduled collection job in a reliable always-on environment if production occupancy history is required. Do not rely on a developer laptop for production data collection.

## AI project report claims

Accurately describe the current system as:
- Explainable rule-based seat-cluster recommender.
- Deterministic occupancy baseline with an optional Random Forest model trained from CineBook's own time-series observations.
- Catalogue-grounded deterministic concierge (not an LLM unless a separately configured model integration is added).

Report Random Forest performance only after a successful training run and include the held-out split strategy, dataset size, distinct show count, MAE, RMSE and R². Never fabricate historical observations or model metrics.

## Profile and optional movie-metadata UI refinement

The latest UI refinement improves the signed-in profile page with responsive account shortcuts, editable name/phone fields, password confirmation and visibility toggles. The profile save and password update continue to use the existing `/auth/me` and `/auth/change-password` endpoints. The movie detail page now omits Cast & Crew, Media and Reviews tabs when the corresponding TMDB data is absent, removes the TMDB warning text, and only displays available movie facts. If local catalogue cast names exist, they are shown as simple names rather than fabricated TMDB profiles. Optional TMDB enrichment failures do not interrupt local movie details or CineBook showtime booking.

Frontend production build was not run in this packaging environment because frontend dependencies were not installed. Run `npm install` and `npm run build` in `frontend` on the development machine, then test profile save/password change and movie showtime booking locally.
