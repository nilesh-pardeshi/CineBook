# CineBook Frontend Expansion – Batch 2

This patch is built against the CineBook source ZIP and Backend Expansion Batch 1.

## Files to merge

Copy these files into the matching paths in your existing CineBook project, allowing overwrite only for these exact files:

- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `frontend/src/pages/MovieDetail.jsx`
- `frontend/src/pages/SeatSelection.jsx`
- `frontend/src/pages/CinemaDetails.jsx` (new)
- `frontend/src/components/TrailerModal.jsx` (new)

No backend files, database, migration files, local `.env` files, authentication context, checkout, booking, payment, ticket, cancellation, or admin source files are changed by this frontend patch.

## What is included

1. Movie details now launch an embedded trailer modal for YouTube/Vimeo URLs and support direct MP4/WebM/OGG video URLs. Unsupported external providers get a working external-open link.
2. Movie showtime cards display the show format and link to the dedicated cinema detail page.
3. Cinema details consume `GET /api/cinemas/{theatre_id}` and display amenities, screen specifications, projection, sound, dimensions, seat-tier breakdown, accessibility configuration and upcoming schedules.
4. Seat selection consumes `POST /api/ai/seat-recommendations`. Group size, budget, tier, aisle and accessibility preferences are sent to the real FastAPI endpoint.
5. AI recommendations are visually highlighted on the existing seat map. Users can apply a recommended cluster or continue selecting seats manually.
6. Seat selection displays `GET /api/ai/shows/{show_id}/crowd` and clearly identifies the current deterministic baseline and its limitation.
7. The existing booking `POST /api/bookings` flow remains the only route used to hold selected seats and continue checkout. AI output is advisory; backend booking transactions still validate availability.

## Setup

No new npm package was added. From `frontend`:

```bash
npm install
npm run dev
```

Keep the existing frontend `.env` configuration and `VITE_API_URL` unchanged.

## Browser verification

- Open a movie detail page with a `trailer_url` and click **Watch trailer**.
- Open **Cinema details** from a theatre in the showtime list.
- Verify screen, amenity, pricing-tier and upcoming-show data against the backend response.
- Open an upcoming show's seat page.
- Request AI seats with group size 2 or 3 and a realistic per-seat budget.
- Verify recommended seats receive the purple AI highlight.
- Click **Select these seats** and verify the same seats become selected in the existing map.
- Change preferences and request another recommendation.
- Manually select and deselect seats without using AI.
- Verify crowd percentage and rush-level panel.
- Continue to checkout and complete the existing sandbox booking flow.
- Confirm refresh/availability polling still removes seats that have become unavailable.

## Validation performed for this batch

- TypeScript parser successfully parsed all 30 JS/JSX source files.
- Relative import resolution check passed.
- CSS parser found no stylesheet parse errors.
- A full Vite production build was not run in this environment because npm dependencies were not available in the local npm cache. Run `npm install` and `npm run build` in your development environment before deployment.
