# 🎬 CineBook — Online Movie Ticket Booking & Theatre Management

**Discover movies. Compare showtimes. Choose your seats. Enjoy the show.**

CineBook is a full-stack movie discovery and online ticket-booking project built around the Indian cinema experience. Users can explore movies, browse cities and cinemas, view show schedules, select seats, complete a sandbox checkout, and access a QR-based ticket. The project also includes theatre administration, booking management, cinema metadata, and AI-assisted movie-going features.

> **Project status:** Ready for deployment preparation and staging validation. This is an academic/demo project. Demo schedules and sandbox payments must not be represented as live cinema inventory or real payment processing.

---

## Table of contents

- [Project highlights](#-project-highlights)
- [Technology stack](#-technology-stack)
- [Application modules](#-application-modules)
- [Booking workflow](#-booking-workflow)
- [AI features](#-ai-features)
- [Movie discovery and TMDB](#-movie-discovery-and-tmdb)
- [Cinema directory and demo schedules](#-cinema-directory-and-demo-schedules)
- [Project structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Run locally on Windows](#-run-locally-on-windows)
- [Environment variables](#-environment-variables)
- [Database setup and migrations](#-database-setup-and-migrations)
- [Demo accounts](#-demo-accounts)
- [Testing and verification](#-testing-and-verification)
- [Deployment plan](#-deployment-plan)
- [Production-readiness checklist](#-production-readiness-checklist)
- [Known limitations](#-known-limitations)
- [Future enhancements](#-future-enhancements)
- [Acknowledgements](#-acknowledgements)

---

## ✨ Project highlights

### Customer experience

- User registration, login, JWT-based authentication, and role-aware navigation.
- Movie catalogue with now-showing and coming-soon views.
- Movie search, language and genre filters, posters, descriptions, ratings, and movie details.
- Indian city selector and cinema directory.
- Movie-specific theatre and showtime discovery.
- Seat map with seat categories and availability indicators.
- Temporary seat holds to reduce booking conflicts.
- Snack and food add-ons, coupon support, and checkout summary.
- Sandbox payment flow for demonstrating successful and failed transactions.
- Booking confirmation with booking reference and QR ticket.
- My Bookings, booking details, cancellation rules, and profile management.
- Printable two-page ticket: admission details on page one and a CineBook movie-night companion on page two.
- Responsive dark cinematic interface with a floating AI Concierge.

### Theatre and administration

- Role-protected admin area.
- Dashboard with booking and sales summaries.
- Movie, theatre, screen, food-item, and coupon management.
- Show scheduling and bulk scheduling.
- Screen seat-layout configuration and theatre metadata.
- Booking search and QR ticket check-in support.
- Show cancellation and booking/refund status handling within the demo application.

### Indian cinema support

- Indian cities and regional-language catalogue support.
- CBFC-style certification labels such as U, U/A, and A (legacy values may also be displayed).
- Cinema information such as location, amenities, screen details, projection and sound formats.
- Show formats including 2D, 3D, IMAX 2D, 4DX, Dolby Atmos and other configured formats.
- INR pricing and Asia/Kolkata showtime handling.

---

## 🧰 Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router, JavaScript, CSS |
| UI icons | lucide-react |
| QR tickets | qrcode.react |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL |
| ORM and migrations | SQLAlchemy 2, Alembic |
| Authentication | JWT, bcrypt |
| Validation/configuration | Pydantic, python-dotenv |
| HTTP integration | httpx |
| AI/ML | Python, scikit-learn, joblib |
| Movie metadata | The Movie Database (TMDB) API (optional) |
| Local database option | Docker Compose |
| Deployment configuration | Render blueprint, Vercel/Netlify SPA configuration |

---

## 🧩 Application modules

| Module | Purpose |
|---|---|
| Home and movie catalogue | Discover movies, browse categories, search and filter titles. |
| Movie details | Review synopsis, movie information, available metadata, and showtimes. |
| Cinema directory | Explore supported Indian cities and cinema listings. |
| Cinema details | View theatre amenities, screens, formats, and configured seating information. |
| Seat selection | View seat availability and select seats for a show. |
| Checkout | Review ticket and food costs, apply eligible coupons, and complete sandbox checkout. |
| Ticket | View booking confirmation, QR code, payment summary, and print the two-page ticket. |
| My Bookings | Access booking history and available booking actions. |
| Profile | Update profile information and password. |
| Admin | Manage catalogue, theatres, screens, shows, food, coupons, and bookings. |
| AI Concierge | Find upcoming CineBook shows using supported city, language, group-size, and budget preferences. |
| AI intelligence | Seat recommendations, crowd estimates, and show insights. |

---

## 🎟️ Booking workflow

1. **Discover a movie** — browse the catalogue or search by title, language, or genre.
2. **Choose a city and show** — select the city, theatre, date, screen, and available showtime.
3. **Select seats** — review the seat map and choose up to the configured seat limit.
4. **Hold seats** — the backend creates a time-limited hold while the customer proceeds to checkout.
5. **Review checkout** — confirm ticket tier, food add-ons, coupon, fees, and total.
6. **Complete sandbox payment** — use the project's demo payment flow.
7. **Receive the ticket** — the booking is confirmed in the application and a QR ticket is made available.
8. **Manage the booking** — view it in My Bookings and use the supported cancellation flow where eligible.

The database is the source of truth for CineBook show inventory and seat availability. AI seat suggestions are advisory; the booking transaction performs the authoritative availability checks.

---

## 🤖 AI features

### AI seat recommendations

`POST /api/ai/seat-recommendations`

Ranks possible seat groups using configured criteria such as group size, contiguous seating, seat tier, budget, aisle proximity, and configured accessibility labels. Recommendations do not reserve seats; the normal booking flow rechecks availability.

### Crowd estimate

`GET /api/ai/shows/{show_id}/crowd`

Returns an occupancy/rush estimate based on the show and current booking occupancy. The deterministic fallback is a heuristic baseline, not proof of a trained predictive model.

### Show insights

`GET /api/ai/shows/{show_id}/insights`

Provides show availability, pricing/value cues, and crowd-related information for supported upcoming shows.

### AI Concierge

`POST /api/assistant/concierge`

Accepts a natural-language request and supported preferences such as city, language, group size, and budget. It searches CineBook's own upcoming show inventory and returns relevant options where available. It is a project concierge, not an unrestricted general-purpose chatbot.

### Occupancy data collection and model training

The backend includes `collect_occupancy.py` to capture timestamped occupancy snapshots and `train_crowd_model.py` to train/evaluate a Random Forest model when enough repeated observations exist.

**Important:** one large snapshot collection at a single point in time is not a time series. Collect observations repeatedly, ensure they are separated in time, and evaluate on held-out shows before describing the model as accurate. Until a valid trained artifact is produced, the deterministic fallback remains available.

Commands (from `backend`):

```powershell
python collect_occupancy.py
python train_crowd_model.py
```

The collector should be scheduled periodically (for example, hourly) only after verifying the database and collection window. Do not claim production-grade prediction accuracy without a measured evaluation.

---

## 🎞️ Movie discovery and TMDB

CineBook can use TMDB to display additional movie discovery information such as posters, descriptions, release dates, language labels, and ratings. The Hindi/India discovery feed is served by the backend route:

`GET /api/discovery/india/hindi`

TMDB is optional. If no valid backend token is configured or TMDB is unreachable, local CineBook catalogue and booking functionality should remain the primary application data source.

Configure `TMDB_READ_ACCESS_TOKEN` only in `backend/.env` or the backend hosting provider's secret environment settings. **Never expose the TMDB read access token in frontend code or a `VITE_` variable.**

Required attribution notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

TMDB data is for discovery/metadata. A TMDB movie result is not automatically a CineBook-bookable movie. A local CineBook movie and scheduled CineBook show must exist for the normal booking workflow.

---

## 🏙️ Cinema directory and demo schedules

The included cinema directory contains **26 Indian city entries and 57 named venue records** in the curated directory dataset. Venue/address records and city counts are reference information and can change; verify them before relying on them operationally.

The all-city/all-movie demo seeder can create database-backed demo theatres, screens, and schedules for active catalogue movies. This allows the complete project flow to be demonstrated across cities and titles using the existing seat selection, hold, checkout, and ticket generation pages.

Run from `backend` after the catalogue and database are ready:

```powershell
python seed_demo_showtimes.py
```

The generated schedule is **simulated CineBook project inventory**, not a live schedule supplied by a cinema operator. Theatre display names may look realistic, but this does not mean CineBook has a partnership with that theatre. Prices and times are illustrative. Label this clearly in project demonstrations and do not use this demo inventory to sell real tickets.

See [`BOOKABLE_DEMO_SHOWTIMES_SETUP.md`](BOOKABLE_DEMO_SHOWTIMES_SETUP.md), [`CINEMA_DIRECTORY_EXPANSION.md`](CINEMA_DIRECTORY_EXPANSION.md), and [`ALL_CITY_ALL_MOVIE_BOOKING_FIX.md`](ALL_CITY_ALL_MOVIE_BOOKING_FIX.md) for details.

---

## 📁 Project structure

```text
CineBook/
├── README.md
├── render.yaml
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── deps.py
│   │   ├── services.py
│   │   ├── layout.py
│   │   ├── cinema_directory.py
│   │   ├── ai/
│   │   └── routers/
│   ├── migrations/
│   ├── tests/
│   ├── seed.py
│   ├── seed_demo_showtimes.py
│   ├── migrate_bootstrap.py
│   ├── collect_occupancy.py
│   ├── train_crowd_model.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Procfile
│   └── start.sh
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── context/
    │   ├── pages/
    │   │   └── admin/
    │   ├── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── utils.js
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    ├── vercel.json
    └── netlify.toml
```

---

## 💻 Prerequisites

For local development:

- Python 3.12 recommended (Python 3.10+ may work depending on installed package versions).
- Node.js 18 or newer and npm.
- PostgreSQL 14+ **or** Docker Desktop with Docker Compose.
- Git and a code editor such as Visual Studio Code.

---

## 🚀 Run locally on Windows

Open **three PowerShell terminals** from the project root when running the database, backend, and frontend separately.

### 1. Get the project

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd CineBook
```

If you already have the project locally, open its root folder instead.

### 2. Start PostgreSQL

Option A — Docker Compose:

```powershell
docker compose up -d db
```

Option B — local PostgreSQL installation:

Create a database named `cinebook` in pgAdmin or with `psql`. Update the backend `DATABASE_URL` to match your PostgreSQL username, password, host, port, and database name.

If the password contains special URL characters such as `@`, URL-encode those characters in the connection string (for example, `@` becomes `%40`). Do not share your database password in screenshots or chat.

### 3. Configure and start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```env
DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/cinebook
SECRET_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET
CORS_ORIGINS=http://localhost:5173
APP_TIMEZONE=Asia/Kolkata
TMDB_READ_ACCESS_TOKEN=
```

Then run the migration bootstrap and seed the local catalogue:

```powershell
python migrate_bootstrap.py
python seed.py
```

If you want the all-city/all-movie demo inventory, run:

```powershell
python seed_demo_showtimes.py
```

Start FastAPI using the module path below (do not use `uvicorn main:app`):

```powershell
uvicorn app.main:app --reload --port 8000
```

Useful backend URLs:

- API health: `http://127.0.0.1:8000/api/health`
- Swagger API docs: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

### 4. Configure and start the frontend

Open a new PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. During local development, Vite proxies `/api` requests to `http://localhost:8000`.

### 5. Build the frontend

Before deployment, run:

```powershell
npm run build
```

Vite writes the production build to `frontend/dist/`.

---

## 🔐 Environment variables

### Backend — `backend/.env`

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. URL-encode special characters in credentials. |
| `SECRET_KEY` | Yes for deployment | Long, unique random key used to sign JWTs. Never use the development default in production. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT lifetime in minutes. |
| `CORS_ORIGINS` | Yes for deployment | Comma-separated exact frontend origins allowed to call the API. |
| `APP_TIMEZONE` | No | Theatre/showtime timezone; defaults to `Asia/Kolkata`. |
| `TMDB_READ_ACCESS_TOKEN` | No | TMDB API Read Access Token for movie discovery. Keep backend-only. |
| `SEAT_HOLD_MINUTES` | No | Seat hold duration; defaults to 7 minutes. |
| `CONVENIENCE_FEE_PER_TICKET` | No | Configured convenience fee per ticket. |
| `SEED_BOOKINGS` | No | Controls demo booking history during seed initialization. |

### Frontend — `frontend/.env`

| Variable | Required | Description |
|---|---:|---|
| `VITE_API_URL` | For separate deployed frontend/backend | Full backend API base URL ending in `/api`, e.g. `https://your-api.onrender.com/api`. Leave unset locally to use the Vite proxy. |

Only variables prefixed with `VITE_` are exposed to browser code. Never place database credentials, JWT signing secrets, payment secrets, or TMDB access tokens in frontend variables.

---

## 🗄️ Database setup and migrations

- PostgreSQL stores users, movies, theatres, screens, shows, seat/booking records, payment records, food items, coupons, and occupancy snapshots.
- SQLAlchemy models are under `backend/app/models.py`.
- Alembic migration files are under `backend/migrations/versions/`.
- Use `python migrate_bootstrap.py` when applying the project's migration bootstrap.
- The seed script adds the local demo catalogue and is intended to be safe to rerun for its supported seed records.

**Protect your data:** back up the database before schema changes. Do not run `python seed.py --reset` against a database containing user data or bookings. Do not run the destructive API smoke suite against production.

If your existing database is already at migration revision `20261117_02`, it is at the current head for the included occupancy-snapshot migrations. Do not manually stamp or reset it again unless you have inspected the actual migration state and have a backup.

---

## 👤 Demo accounts

The seed script defines these local demonstration accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cinebook.com` | `Admin@123` |
| Customer | `user@cinebook.com` | `User@123` |

These are **development-only credentials**. Change the admin password immediately, do not deploy with known demo credentials, and disable or replace seeded accounts before any public release. Do not publish real user credentials in this README.

---

## 🧪 Testing and verification

Run the isolated AI algorithm tests from `backend`:

```powershell
pip install -r requirements-dev.txt
python -m pytest -q tests
```

The packaging workspace previously verified Python compilation and the isolated AI tests (3 passed). This does not mean every browser journey or hosted deployment has been tested.

The API smoke runner is separate and can create/modify test records:

```powershell
python tests/run_api_smoke.py
```

Run it **only against a dedicated disposable development/test database**, never production.

Before release, manually test:

- Sign-up, login, logout, and protected admin routes.
- Movie search, filters, city selection, cinema directory, and movie details.
- Show selection and date changes for multiple cities and movies.
- Seat selection, simultaneous booking attempts, hold countdown, and hold expiry.
- Coupons, food add-ons, totals, and successful/failed sandbox payments.
- QR ticket display, two-page print preview, My Bookings, and cancellation eligibility.
- Admin CRUD, show scheduling, booking search, and check-in.
- AI Concierge, seat recommendations, crowd estimates, and fallback behavior when TMDB is unavailable.
- Mobile/responsive layouts and direct navigation to nested frontend URLs.

---

## ☁️ Deployment plan

Recommended architecture:

- **Frontend:** Vercel (or Netlify) hosting the React/Vite static build.
- **Backend:** Render Web Service (or Railway) running FastAPI.
- **Database:** Managed PostgreSQL (Render PostgreSQL or Railway PostgreSQL).

Deploy in this order: **database → backend → frontend → CORS verification → end-to-end testing**.

### A. Push the project to GitHub

1. Create a new private or public GitHub repository.
2. Add the project source code.
3. Ensure `.env`, `.venv`, `node_modules`, local database dumps, tokens, and secrets are excluded by `.gitignore`.
4. Push the code to the repository.

Never commit `.env` files or real credentials.

### B. Deploy PostgreSQL and backend on Render

The repository includes a `render.yaml` Blueprint for a PostgreSQL database and FastAPI service.

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the GitHub repository containing `render.yaml`.
3. Review the database and web-service configuration before creating resources.
4. Set `CORS_ORIGINS` to the exact Vercel/Netlify frontend origin after it exists. Do not leave the placeholder URL.
5. Add `TMDB_READ_ACCESS_TOKEN` in Render environment settings if TMDB discovery is required.
6. Confirm `SECRET_KEY` is generated securely and is not a known/default value.
7. Deploy and inspect the backend logs.
8. Verify `https://YOUR-BACKEND.onrender.com/api/health` returns a healthy response and `/docs` loads.

The included backend start script runs the migration bootstrap and seed before starting Uvicorn. Review this behavior and seed configuration before deploying to a database with existing data. Avoid destructive seed/reset commands on production.

### C. Deploy the frontend on Vercel

1. In Vercel choose **Add New → Project** and import the GitHub repository.
2. Set the **Root Directory** to `frontend`.
3. Select the Vite framework preset.
4. Add the build environment variable:

```env
VITE_API_URL=https://YOUR-BACKEND.onrender.com/api
```

5. Deploy the frontend.
6. Copy the deployed frontend origin, e.g. `https://your-cinebook.vercel.app`.
7. Add that exact origin to backend `CORS_ORIGINS` on Render, then redeploy/restart the backend.
8. Test login, catalogue, movie detail, showtimes, booking, and ticket flows on the deployed domains.

For Netlify, the project also includes a Netlify configuration. Set the same `VITE_API_URL` build environment variable and verify SPA route rewrites.

### D. Post-deployment checks

- Open the backend health endpoint.
- Confirm browser Network requests call the deployed API, not localhost.
- Confirm CORS allows the production frontend origin.
- Verify database persistence after backend restarts.
- Test nested routes such as `/movies`, `/movies/1`, `/shows/{id}/seats`, `/bookings`, and `/profile`.
- Test a complete sandbox booking and QR ticket generation.
- Check logs for missing environment variables, migration errors, and external TMDB failures.

Free hosting tiers may sleep when idle and may have storage, connection, or usage limits. Review current provider limits before choosing a plan for a public demo.

---

## 🚦 Production-readiness checklist

CineBook can be deployed as an academic demonstration with clearly labelled simulated schedules and sandbox payments. It is **not ready to process real customer payments or represent simulated theatre schedules as real inventory** until the following are completed:

- [ ] Integrate a real payment provider (for example, Razorpay) with server-side order creation and signature verification.
- [ ] Implement real payment capture, refund API calls, webhook verification, idempotency, and reconciliation.
- [ ] Replace simulated showtimes and sample theatre inventory with verified operator/partner inventory and accurate seat maps.
- [ ] Remove/rotate seeded demo credentials and verify admin account provisioning.
- [ ] Set strong production secrets and exact CORS origins.
- [ ] Add rate limiting, security headers, input validation review, and abuse protection.
- [ ] Configure database backups and test restoration.
- [ ] Add structured logging, monitoring, alerting, and error tracking.
- [ ] Review privacy policy, terms, data retention, and secure handling of personal information.
- [ ] Review TMDB attribution, API terms, image usage, and any required commercial licensing.
- [ ] Run full staging tests and independent security review.

---

## ⚠️ Known limitations

1. **Payments:** current checkout is a sandbox/demo flow. No real money is collected. Refund status in the application is not equivalent to a gateway refund.
2. **Showtimes and cinemas:** all-city/all-movie generated schedules are simulated CineBook inventory for demonstrating the complete booking journey. They are not live cinema schedules, partner listings, or verified seat inventory.
3. **TMDB:** TMDB enriches discovery metadata; it does not provide CineBook's local booking inventory. The integration depends on network access and a valid backend token.
4. **Crowd prediction:** the deterministic fallback is heuristic. A trained model requires repeated timestamped data and honest held-out evaluation.
5. **AI recommendations:** seat and show recommendations are advisory. The database booking transaction remains authoritative.
6. **Operational scale:** production-grade monitoring, payment reconciliation, high-availability scheduling, and operator integrations require further work.

---

## 🛣️ Future enhancements

- Real cinema/operator integrations and live showtime inventory.
- Razorpay payment gateway, verified webhooks, and automated refunds.
- Email/SMS booking confirmations and reminders.
- Advanced seat recommendation evaluation and personalized preferences.
- More robust occupancy forecasting with time-series features and production monitoring.
- Enhanced admin analytics and theatre-level performance reporting.
- Multilingual UI and accessibility improvements.
- CI/CD pipeline, automated integration tests, and deployment monitoring.

---

## 🙌 Acknowledgements

- **The Movie Database (TMDB)** for optional movie metadata and discovery data. This product uses the TMDB API but is not endorsed or certified by TMDB.
- **Cinema directory references** used to build the sample Indian city and venue directory. Venue details should be independently reconfirmed before use.
- Open-source technologies used across the React, FastAPI, PostgreSQL, and Python ecosystem.

---

## 📌 Project note

CineBook demonstrates a connected movie discovery and booking experience: from finding a film and comparing showtimes to selecting seats, checking out, and receiving a QR ticket. The project's core principle is **clear booking information, transparent demo data, and helpful AI assistance while keeping the customer in control.**

**CineBook — Your cinema, one place. Every story deserves a great seat.**
