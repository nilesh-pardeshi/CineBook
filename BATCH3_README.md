# CineBook Batch 3 – AIML, Concierge and Final Integration

This batch is additive to the integrated CineBook source from Batch 2 / TMDB combined search. It preserves existing auth, booking, seat-hold, payment, ticket, cancellation and admin flows.

## Included

- Historical occupancy snapshot table and Alembic migration `20261117_02`.
- Admin-only snapshot collection endpoint: `POST /api/ai/admin/snapshots/collect`.
- Random Forest training script with held-out MAE, RMSE and R²: `backend/train_crowd_model.py`.
- Trained model inference with deterministic baseline fallback if the artifact is absent or invalid.
- Deterministic, catalogue-grounded AI concierge: `POST /api/assistant/concierge`. It extracts city/language/budget preferences and returns real upcoming CineBook shows and configured food items. It does not book or claim to be an LLM.
- Floating React concierge component on the existing site layout. CSS is appended only; existing stylesheet is preserved.

## Apply

1. Back up your current project and PostgreSQL database.
2. Extract this ZIP and merge the `CineBook` directory into your existing project.
3. Do not replace `.env` files.
4. Backend: `pip install -r requirements.txt`.
5. Run database migration: `python migrate_bootstrap.py`. This upgrades existing Alembic databases and stamps fresh metadata-created databases.
6. Restart FastAPI: `uvicorn app.main:app --reload --port 8000`.
7. Frontend: `npm install` (no new npm packages), then `npm run dev`.

## Build a real ML dataset

The trained model is NOT bundled because a trained artifact must come from your actual booking data. The app uses the transparent deterministic baseline until enough real observations exist.

1. Log in as admin and call `POST /api/ai/admin/snapshots/collect` periodically (ideally hourly via a scheduled job).
2. Each show needs repeated snapshots and a final observation within six hours of showtime.
3. Once at least 30 paired training rows across 10 distinct shows exist, run from `backend/`: `python train_crowd_model.py`.
4. The script prints held-out MAE, RMSE and R² and writes `app/ai/artifacts/crowd_model.joblib`.
5. Restart FastAPI. `/api/ai/shows/{show_id}/crowd` will then report `trained_random_forest_v1`.

Do not claim model accuracy before training on representative data. Small datasets can overfit; review metrics and increase the dataset before presenting results academically.

## Test APIs

- `POST /api/assistant/concierge` body: `{"prompt":"Marathi movie in Pune under 700 rupees","group_size":2}`
- `POST /api/ai/admin/snapshots/collect` (admin JWT required)
- `GET /api/ai/shows/{show_id}/crowd` (existing endpoint; trained model or deterministic fallback)

The concierge returns only actual upcoming active shows. Its booking links route to the existing seat-selection page; the booking transaction remains the final authority for availability and price.
