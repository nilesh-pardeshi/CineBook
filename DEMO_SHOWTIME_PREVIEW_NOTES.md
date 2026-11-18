# Demo showtime update

The preview-only, disabled sample time chips are superseded by `backend/seed_demo_showtimes.py`.

Run the seed script to create actual CineBook `Theatre`, `Screen`, and `Show` database records. The existing movie detail page then renders its normal theatre cards and links to the real seat-selection route. Those seats are held and booked through the existing booking APIs; successful sandbox checkout generates the normal QR ticket.

Setup and testing steps: see `BOOKABLE_DEMO_SHOWTIMES_SETUP.md`.

All generated schedules and venue inventory are simulated project data, not live operator schedules or a claim of theatre partnership.
