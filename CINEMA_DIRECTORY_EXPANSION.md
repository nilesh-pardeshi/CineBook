# CineBook India Cinema Directory Expansion

## What changed
- Added a city directory page at `/cinemas`.
- Added 26 Indian cinema cities to the city selector.
- Added 57 named venue directory records with addresses across Pune, Mumbai, Bengaluru and Hyderabad.
- Added APIs: `GET /api/cinema-directory/cities` and `GET /api/cinema-directory/theatres?city=Pune`.
- `/api/cities` now merges cities with local active theatre inventory and the discovery directory.

## Important booking boundary
Directory listings are discovery-only. They are NOT inserted into `theatres`, `screens` or `shows`. They do not imply that a venue is partnered with CineBook, open today, or has available seats. To enable booking, an administrator must create the venue and screens in CineBook and schedule real shows.

## Sources and freshness
- City coverage/counts: CinemaHalls.in India directory, data pack/page reviewed 18 Nov 2026: https://cinemahalls.in/
- Named venue/address records: public BookMyShow cinema listings for Pune, Mumbai, Bengaluru and Hyderabad, reviewed 18 Nov 2026.
- Pune: https://in.bookmyshow.com/pune/cinemas
- Mumbai: https://in.bookmyshow.com/mumbai/cinemas
- Bengaluru: https://in.bookmyshow.com/bengaluru/cinemas
- Hyderabad: https://in.bookmyshow.com/hyderabad/cinemas

The source pages can change. Reconfirm venue status and addresses before creating bookable CineBook inventory. City counts are directory estimates, not CineBook theatre counts.
