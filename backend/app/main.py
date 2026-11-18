from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import models  # noqa: F401  (registers tables)
from .config import settings
from .database import Base, engine
from .routers import admin, auth, bookings, catalog, cinema, ai, discovery, assistant


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)  # lean MVP: no migrations tool, tables are created on boot
    yield


app = FastAPI(title="CineBook API", version="1.0.0", lifespan=lifespan)

allow_all = "*" in settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else settings.CORS_ORIGINS,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, catalog.router, bookings.router, admin.router, cinema.router, ai.router, discovery.router, assistant.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")
