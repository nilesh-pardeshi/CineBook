from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Movie

from ..config import settings

router = APIRouter(prefix="/discovery", tags=["movie discovery - TMDB"])
TMDB_BASE = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p"
CACHE_TTL_SECONDS = 15 * 60
_CACHE: dict[str, tuple[float, Any]] = {}

LANGUAGES = {
    "hi": "Hindi", "mr": "Marathi", "te": "Telugu", "ta": "Tamil",
    "kn": "Kannada", "ml": "Malayalam", "en": "English", "bn": "Bengali",
    "gu": "Gujarati", "pa": "Punjabi", "or": "Odia", "as": "Assamese",
}
LANGUAGE_LOCALES = [
    {"label": "Hindi", "value": "hi-IN"},
    {"label": "Marathi", "value": "mr-IN"},
    {"label": "Telugu", "value": "te-IN"},
    {"label": "Tamil", "value": "ta-IN"},
    {"label": "Kannada", "value": "kn-IN"},
    {"label": "Malayalam", "value": "ml-IN"},
    {"label": "English", "value": "en-US"},
    {"label": "Bengali", "value": "bn-IN"},
    {"label": "Gujarati", "value": "gu-IN"},
    {"label": "Punjabi", "value": "pa-IN"},
]


def _configured() -> bool:
    return bool(settings.TMDB_READ_ACCESS_TOKEN)


def _cached(key: str):
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires, value = entry
    if expires < time.monotonic():
        _CACHE.pop(key, None)
        return None
    return value


def _store(key: str, value: Any):
    if len(_CACHE) > 500:
        now = time.monotonic()
        for old_key, (expires, _) in list(_CACHE.items()):
            if expires < now:
                _CACHE.pop(old_key, None)
        if len(_CACHE) > 500:
            _CACHE.clear()
    _CACHE[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)
    return value


async def _tmdb(path: str, params: dict[str, Any] | None = None):
    if not _configured():
        raise HTTPException(
            status_code=503,
            detail="TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN to backend/.env and restart FastAPI.",
        )
    headers = {
        "Authorization": f"Bearer {settings.TMDB_READ_ACCESS_TOKEN}",
        "accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0)) as client:
            response = await client.get(f"{TMDB_BASE}{path}", params=params or {}, headers=headers)
        if response.status_code == 401:
            raise HTTPException(502, "TMDB rejected the configured token. Check TMDB_READ_ACCESS_TOKEN.")
        if response.status_code == 404:
            raise HTTPException(404, "Movie not found in TMDB.")
        response.raise_for_status()
        return response.json()
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(504, "TMDB request timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"TMDB returned HTTP {exc.response.status_code}.")
    except httpx.HTTPError:
        raise HTTPException(502, "Could not connect to TMDB. Please try again later.")


def _image(path: str | None, size: str) -> str | None:
    return f"{IMAGE_BASE}/{size}{path}" if path else None


def _language_name(code: str | None) -> str:
    if not code:
        return "English"
    return LANGUAGES.get(code.lower(), code.upper())


def _search_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "tmdb_id": item.get("id"),
        "title": item.get("title") or item.get("original_title") or "Untitled",
        "original_title": item.get("original_title"),
        "overview": item.get("overview") or "",
        "release_date": item.get("release_date") or None,
        "language": _language_name(item.get("original_language")),
        "original_language": item.get("original_language"),
        "rating": round(float(item.get("vote_average") or 0), 1),
        "poster_url": _image(item.get("poster_path"), "w500"),
        "backdrop_url": _image(item.get("backdrop_path"), "w1280"),
    }


@router.get("/status")
def discovery_status():
    return {
        "provider": "TMDB",
        "configured": _configured(),
        "languages": LANGUAGE_LOCALES,
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        "message": "TMDB is ready." if _configured() else "Add TMDB_READ_ACCESS_TOKEN to backend/.env to enable movie search and metadata import.",
    }


@router.get("/search")
async def search_movies(
    query: str = Query(..., min_length=2, max_length=100),
    language: str = Query("hi-IN", min_length=2, max_length=10),
    page: int = Query(1, ge=1, le=5),
):
    clean = " ".join(query.split())
    cache_key = f"search:{clean.casefold()}:{language}:{page}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached
    data = await _tmdb("/search/movie", {
        "query": clean,
        "language": language,
        "region": "IN",
        "include_adult": "false",
        "page": page,
    })
    results = [_search_item(x) for x in data.get("results", []) if x.get("id")]
    return _store(cache_key, {
        "page": data.get("page", page),
        "total_results": data.get("total_results", len(results)),
        "results": results,
        "provider": "TMDB",
    })


@router.get("/movie/{tmdb_id}")
async def movie_metadata(
    tmdb_id: int,
    language: str = Query("hi-IN", min_length=2, max_length=10),
):
    cache_key = f"movie:{tmdb_id}:{language}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached
    data = await _tmdb(f"/movie/{tmdb_id}", {
        "language": language,
        "append_to_response": "credits,videos,release_dates,images,reviews,keywords",
    })
    credits = data.get("credits") or {}
    crew = credits.get("crew") or []
    cast = credits.get("cast") or []
    director = next((x.get("name", "") for x in crew if x.get("job") == "Director"), "")
    trailer = None
    videos = (data.get("videos") or {}).get("results") or []
    youtube = [x for x in videos if x.get("site") == "YouTube" and x.get("key")]
    if youtube:
        chosen = next((x for x in youtube if x.get("type") == "Trailer" and x.get("official")), None)
        chosen = chosen or next((x for x in youtube if x.get("type") == "Trailer"), None) or youtube[0]
        trailer = f"https://www.youtube.com/watch?v={chosen['key']}"

    certificate = "U/A"
    release_dates = (data.get("release_dates") or {}).get("results") or []
    india = next((x for x in release_dates if x.get("iso_3166_1") == "IN"), None)
    if india:
        certs = [x.get("certification", "").strip().upper() for x in india.get("release_dates", []) if x.get("certification", "").strip()]
        if certs:
            raw = certs[0]
            certificate = "U/A" if raw in {"UA", "U/A", "UA 13+", "UA 16+", "UA 7+"} else (raw if raw in {"U", "A", "S"} else "U/A")

    release_date = data.get("release_date") or None
    payload = {
        "tmdb_id": data.get("id"),
        "title": data.get("title") or data.get("original_title") or "Untitled",
        "description": data.get("overview") or "",
        "genres": ", ".join(x.get("name", "") for x in data.get("genres", []) if x.get("name")),
        "language": _language_name(data.get("original_language")),
        "duration_min": int(data.get("runtime") or 120),
        "certificate": certificate,
        "rating": round(float(data.get("vote_average") or 0), 1),
        "poster_url": _image(data.get("poster_path"), "w500"),
        "backdrop_url": _image(data.get("backdrop_path"), "w1280"),
        "trailer_url": trailer,
        "release_date": release_date,
        "director": director,
        "cast_members": ", ".join(x.get("name", "") for x in cast[:8] if x.get("name")),
        "source": "TMDB",
        "source_url": f"https://www.themoviedb.org/movie/{tmdb_id}",
        "tagline": data.get("tagline") or "",
        "original_title": data.get("original_title") or data.get("title") or "",
        "status": data.get("status") or "",
        "budget": int(data.get("budget") or 0),
        "revenue": int(data.get("revenue") or 0),
        "homepage": data.get("homepage") or None,
        "production_companies": [
            {"id": x.get("id"), "name": x.get("name"), "logo_url": _image(x.get("logo_path"), "w185")}
            for x in (data.get("production_companies") or [])[:8]
        ],
        "cast": [
            {"id": x.get("id"), "name": x.get("name"), "character": x.get("character") or "",
             "profile_url": _image(x.get("profile_path"), "w185")}
            for x in cast[:16]
        ],
        "crew": [
            {"id": x.get("id"), "name": x.get("name"), "job": x.get("job") or "", "department": x.get("department") or "",
             "profile_url": _image(x.get("profile_path"), "w185")}
            for x in crew if x.get("job") in {"Director", "Screenplay", "Writer", "Producer", "Original Music Composer", "Director of Photography"}
        ][:16],
        "videos": [
            {"id": x.get("id"), "name": x.get("name"), "site": x.get("site"), "type": x.get("type"),
             "key": x.get("key"), "official": bool(x.get("official")),
             "url": f"https://www.youtube.com/watch?v={x.get('key')}" if x.get("site") == "YouTube" and x.get("key") else None}
            for x in youtube[:12]
        ],
        "posters": [_image(x.get("file_path"), "w500") for x in ((data.get("images") or {}).get("posters") or [])[:12] if x.get("file_path")],
        "backdrops": [_image(x.get("file_path"), "w1280") for x in ((data.get("images") or {}).get("backdrops") or [])[:12] if x.get("file_path")],
        "reviews": [
            {"id": x.get("id"), "author": x.get("author") or "TMDB user", "content": x.get("content") or "",
             "rating": (x.get("author_details") or {}).get("rating"), "created_at": x.get("created_at"), "url": x.get("url")}
            for x in ((data.get("reviews") or {}).get("results") or [])[:6]
        ],
        "keywords": [x.get("name") for x in ((data.get("keywords") or {}).get("keywords") or [])[:16] if x.get("name")],
    }
    return _store(cache_key, payload)




@router.get("/india/hindi")
async def india_hindi_movies(db: Session = Depends(get_db)):
    """Return TMDB's current Indian theatrical and upcoming Hindi-language films.

    External titles remain discovery-only unless a matching CineBook movie has
    been imported and has actual showtimes in the local catalogue.
    """
    cache_key = "india-hindi:now-playing+upcoming"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    now_data, upcoming_data = await _tmdb(
        "/movie/now_playing", {"language": "hi-IN", "region": "IN", "page": 1}
    ), await _tmdb(
        "/movie/upcoming", {"language": "hi-IN", "region": "IN", "page": 1}
    )

    local_movies = db.scalars(
        select(Movie).where(Movie.is_active == True)  # noqa: E712
    ).all()
    local_by_title = {" ".join(m.title.casefold().split()): m for m in local_movies}

    def pack(items: list[dict[str, Any]], section: str):
        packed = []
        seen = set()
        for item in items:
            if item.get("original_language") != "hi" or not item.get("id"):
                continue
            title = item.get("title") or item.get("original_title") or "Untitled"
            key = " ".join(title.casefold().split())
            if key in seen:
                continue
            seen.add(key)
            local = local_by_title.get(key)
            packed.append({
                "tmdb_id": item["id"], "title": title,
                "overview": item.get("overview") or "Synopsis not available.",
                "release_date": item.get("release_date") or None,
                "language": "Hindi",
                "rating": round(float(item.get("vote_average") or 0), 1),
                "poster_url": _image(item.get("poster_path"), "w500"),
                "backdrop_url": _image(item.get("backdrop_path"), "w1280"),
                "source_url": f"https://www.themoviedb.org/movie/{item['id']}",
                "section": section,
                "bookable": bool(local and local.status == "now_showing"),
                "cinebook_movie_id": local.id if local and local.status == "now_showing" else None,
            })
        return packed

    result = {
        "now_playing": pack(now_data.get("results", []), "now_playing"),
        "upcoming": pack(upcoming_data.get("results", []), "upcoming"),
        "provider": "TMDB",
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        "booking_note": "A film can be booked only after it is in CineBook's local catalogue and an active showtime has been scheduled.",
    }
    return _store(cache_key, result)


@router.get("/combined-search")
async def combined_movie_search(
    query: str = Query(..., min_length=2, max_length=100),
    language: str = Query("", max_length=40),
    status: str = Query("", max_length=20),
    genre: str = Query("", max_length=80),
    db: Session = Depends(get_db),
):
    """Search CineBook's bookable catalogue and TMDB discovery separately.

    TMDB failures never hide local catalogue results. External results are discovery-only
    and are not bookable until an admin imports the movie and schedules a show.
    """
    clean = " ".join(query.split())
    stmt = select(Movie).where(Movie.is_active == True, Movie.title.ilike(f"%{clean}%"))  # noqa: E712
    if status in {"now_showing", "upcoming"}:
        stmt = stmt.where(Movie.status == status)
    if language:
        stmt = stmt.where(Movie.language.ilike(language))
    if genre:
        stmt = stmt.where(Movie.genres.ilike(f"%{genre}%"))
    stmt = stmt.order_by(Movie.is_featured.desc(), Movie.rating.desc(), Movie.id).limit(30)
    local_rows = db.scalars(stmt).all()
    local_results = [
        {
            "id": m.id, "title": m.title, "description": m.description, "genres": m.genres,
            "language": m.language, "duration_min": m.duration_min, "certificate": m.certificate,
            "rating": float(m.rating or 0), "poster_url": m.poster_url,
            "backdrop_url": m.backdrop_url, "trailer_url": m.trailer_url,
            "release_date": m.release_date.isoformat() if m.release_date else None,
            "director": m.director, "cast_members": m.cast_members, "status": m.status,
            "is_featured": bool(m.is_featured), "source": "cinebook",
        } for m in local_rows
    ]

    tmdb_results = []
    tmdb_error = None
    if _configured():
        # TMDB's search language controls localized titles/overviews; original-language
        # matches are still included by TMDB where available.
        locale_by_language = {
            "Hindi": "hi-IN", "Marathi": "mr-IN", "Telugu": "te-IN",
            "Tamil": "ta-IN", "Kannada": "kn-IN", "Malayalam": "ml-IN",
            "English": "en-US", "Bengali": "bn-IN", "Gujarati": "gu-IN",
            "Punjabi": "pa-IN",
        }
        locale = locale_by_language.get(language, "en-US")
        try:
            data = await _tmdb("/search/movie", {
                "query": clean, "language": locale, "region": "IN",
                "include_adult": "false", "page": 1,
            })
            tmdb_results = [
                {**_search_item(item), "source": "tmdb",
                 "source_url": f"https://www.themoviedb.org/movie/{item.get('id')}"}
                for item in data.get("results", []) if item.get("id")
            ]
        except HTTPException as exc:
            tmdb_error = str(exc.detail)
    else:
        tmdb_error = "TMDB is not configured. Local CineBook results are still available."

    return {
        "query": clean, "local_results": local_results, "tmdb_results": tmdb_results,
        "tmdb_configured": _configured(), "tmdb_error": tmdb_error,
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    }
