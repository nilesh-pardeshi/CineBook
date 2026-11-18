# CineBook Combined Search Patch

This patch adds a combined movie search to the existing CineBook application. It was built from the integrated CineBook source archive.

## Files to merge
- `backend/app/routers/discovery.py` (adds `GET /api/discovery/combined-search`; retains existing TMDB status/search/detail routes)
- `frontend/src/pages/Movies.jsx` (searches local catalogue and TMDB together)
- `frontend/src/index.css` (styles TMDB discovery cards)

No model or database schema changes are required. The Movie model already has `director` and `cast_members`; it does not have a `cast` column.

## Apply
1. Back up your current project.
2. Merge the three files into the same paths.
3. Keep `backend/.env` unchanged; it must contain `TMDB_READ_ACCESS_TOKEN=...`.
4. Restart FastAPI and Vite.

Backend: `uvicorn app.main:app --reload --port 8000`
Frontend: `npm run dev`

## Test
- `GET /api/discovery/status` should return `configured: true`.
- Open `/movies?q=The%20Odyssey`.
- Results are separated into `CineBook catalogue` (bookable, local DB) and `Discover more movies` (TMDB, not bookable until imported and scheduled).
- Search `Sairat`, `Jawan`, `RRR`, `Leo`, or `The Odyssey`.
- Try Hindi, Marathi, Tamil, Telugu and English language filters.
- If TMDB is down or the token is rejected, local results still render and a discovery error is shown.

## Database column correction
The existing SQLAlchemy model uses `cast_members`, not `cast`. Use:

```sql
SELECT id, title, language, poster_url, backdrop_url, trailer_url, director, cast_members
FROM movies
WHERE title ILIKE '%Vettai%';
```

TMDB-discovered titles are intentionally not linked to local movie IDs and have no booking CTA. An admin must import a movie and create its shows before customers can book it.
