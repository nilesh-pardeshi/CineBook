# CineBook TMDB-inspired movie detail page update

## What changed
- Reworked the shared React movie detail page so every local catalogue movie uses the same responsive cinematic layout.
- Added a backdrop-led hero, poster, movie metadata, rating, tagline, overview, director/writer credits, trailer action and watchlist toggle.
- Added Overview, Cast & Crew, Media, Reviews and Details tabs.
- Added TMDB metadata enrichment by searching the local movie title in its configured language, then requesting detailed metadata only when the title match is exact. If TMDB is unavailable or no exact match exists, the page keeps the CineBook catalogue details and booking flow visible.
- Expanded the backend TMDB metadata response with cast/crew profile paths, videos, image galleries, reviews, keywords and production companies.
- Kept the existing CineBook showtime, city, theatre, seat-selection and checkout links unchanged.

## Important data behaviour
- TMDB is a metadata source, not the booking inventory. Only local CineBook movies and scheduled shows are bookable.
- Existing seed/demo titles that do not exactly match a TMDB title will not be assigned a potentially incorrect poster or cast. Add/import the correct TMDB metadata for those titles through the admin catalogue workflow.
- The watchlist control in this update is a local page-state toggle, not persistent account watchlist storage.
- Reviews are TMDB community reviews, not reviews submitted to CineBook.
- Budget and revenue are returned by the backend but not displayed because TMDB reports these values in USD and they may be unavailable/inaccurate for some regional films.

## Files changed
- `frontend/src/pages/MovieDetail.jsx`
- `frontend/src/index.css`
- `backend/app/routers/discovery.py`

## Verification
- Backend `python -m compileall -q app`: passed.
- `python -m pytest -q tests/test_ai_algorithms.py`: 3 passed.
- Frontend production build: not run in this workspace because `frontend/node_modules` is not installed. Run `npm ci` then `npm run build` locally.
- Live TMDB request and browser end-to-end checks require the user's local `.env`, network and PostgreSQL environment.

## Apply safely
Keep your existing `.env`, `.venv`, database and other local configuration. Merge the project update; do not reset the database or rerun migration stamping for this UI/metadata change. Restart FastAPI and Vite after applying.
