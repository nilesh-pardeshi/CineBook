# CineBook TMDB + Trailer Fix

## Why trailers were blank
The seeded sample catalogue does not include trailer URLs. The previous modal also treated some non-video YouTube URLs as if the last URL path segment were a video ID. This patch adds robust YouTube URL parsing, opens the modal through a React portal, and gives users a working external fallback.

## 1. Get a free TMDB developer token
1. Create/sign in to a TMDB account: https://www.themoviedb.org/signup
2. Open account Settings → API and request an API application/key: https://www.themoviedb.org/settings/api
3. Copy the **API Read Access Token** (v4 Bearer token), not the short API key.
4. Put it in `backend/.env`:

    TMDB_READ_ACCESS_TOKEN=YOUR_V4_READ_ACCESS_TOKEN

5. Restart FastAPI. Never put this token in frontend `.env`, `VITE_` variables, GitHub, or browser code.

## 2. Start the app

Backend:

    cd CineBook/backend
    .\venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --port 8000

Frontend:

    cd CineBook/frontend
    npm install
    npm run dev

## 3. Import real movie data

1. Log in as the CineBook admin.
2. Open Admin → Movies → Add movie (or edit a movie).
3. Use the new **Import movie details from TMDB** panel.
4. Search a title and select the relevant language: Hindi, Marathi, Telugu, Tamil, Kannada, Malayalam, English, Bengali, Gujarati or Punjabi.
5. Click Use on the correct result. CineBook fetches full metadata and fills the form: title, synopsis, genres, language, runtime, CBFC certificate where TMDB lists an Indian certification, rating, poster, backdrop, trailer, release date, director and cast.
6. Review the values and click Save. Then schedule shows for that movie in Admin → Shows.

The TMDB import does not create shows or alter existing bookings. It only fills the movie form.

## 4. New endpoints

- `GET /api/discovery/status`
- `GET /api/discovery/search?query=Jawan&language=hi-IN`
- `GET /api/discovery/movie/{tmdb_id}?language=hi-IN`

Responses are cached in process memory for 15 minutes. If TMDB is unavailable, existing CineBook catalogue and booking APIs continue to work.

## 5. Trailer URL support

The trailer player accepts YouTube watch, youtu.be, embed, shorts and live links, Vimeo links, and direct MP4/WebM/OGG URLs. YouTube/Vimeo playback can still be blocked by the video owner (for example, age-restricted or embedding-disabled videos); in that case the modal provides an **Open on YouTube** link. This is a provider restriction, not a CineBook booking failure.

## 6. TMDB attribution and usage

TMDB's developer API is free for non-commercial use with attribution. TMDB requires its approved logo and the following notice in an About/Credits area:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

This patch includes the notice and a TMDB wordmark text treatment in the footer. Before public release, replace that text treatment with one of TMDB's approved logo assets from its official logos & attribution page. Commercial use requires contacting TMDB for a separate licence. Check current TMDB terms before deployment.

## 7. Files changed

Backend:
- `backend/app/config.py`
- `backend/app/main.py`
- `backend/app/routers/discovery.py` (new)
- `backend/.env.example`

Frontend:
- `frontend/src/pages/admin/AdminCatalog.jsx`
- `frontend/src/components/TrailerModal.jsx`
- `frontend/src/pages/MovieDetail.jsx`
- `frontend/src/components/Footer.jsx`
- `frontend/src/index.css`

No database schema migration is required. Existing movies, shows, bookings, seat holds, payments, cancellations, tickets and admin CRUD endpoints are not rewritten.
