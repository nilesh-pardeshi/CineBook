# Hindi movie feed – 18 November 2026

## Changes
- Added `GET /api/discovery/india/hindi` to fetch TMDB India `now_playing` and `upcoming` collections, filtered to original Hindi-language titles.
- Added Hindi theatrical releases on both the home page (`/`) and movie catalogue page (`/movies`), with posters, synopsis, release date, rating and TMDB source links.
- Added a separate upcoming Hindi releases row.
- Cards only expose a CineBook booking link when a matching local `now_showing` movie exists. External discovery results are not falsely represented as bookable.
- Added responsive styling and TMDB attribution.

## Required configuration
- `TMDB_READ_ACCESS_TOKEN` must be set in `backend/.env` and FastAPI restarted.
- TMDB poster images and metadata are live API results, so they require internet access at runtime.

## Booking workflow
For a newly discovered title, an admin must add it to CineBook's Movies catalogue and create actual showtimes using the Admin → Shows workflow. Until showtimes exist, the home page correctly labels the film as not bookable. This avoids fake inventory, fake seat availability, or fabricated showtimes.

## Verification performed in this workspace
- `python -m py_compile backend/app/routers/discovery.py`: passed.
- `python -m compileall -q app collect_occupancy.py train_crowd_model.py`: passed.
- `python -m pytest -q tests/test_ai_algorithms.py`: 3 passed.
- Frontend build not run: frontend `node_modules` was absent and `npm ci --ignore-scripts --no-audit --no-fund` timed out in this workspace.
- PostgreSQL-backed API and browser tests not run: no project database, TMDB secret or running browser app is attached to this workspace.


## Catalogue-page visibility fix
- The previous integration rendered the Hindi feed on `/` only. The screenshot was from `/movies`, where no Hindi section was mounted. The catalogue page now independently loads and renders the same feed when no title search is active.
