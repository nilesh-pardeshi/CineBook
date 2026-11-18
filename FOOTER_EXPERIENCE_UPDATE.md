# CineBook Footer Experience Update

## What changed
- Replaced the minimal footer with a full-width editorial closing section that explains the CineBook vision and product experience.
- Added navigable cards for movie discovery, booking, AI-assisted discovery and account tools.
- Added a four-step explanation of the booking journey.
- Added interactive FAQ accordions covering booking, AI Concierge scope and the distinction between TMDB discovery data and CineBook showtimes.
- Added useful links to existing application routes: home, movies, upcoming movies, bookings, profile and login.
- Moved the TMDB attribution into an expandable Movie data credits disclosure rather than showing the long attribution sentence in the main footer layout.
- Replaced the old demo-project footer sentence with a concise demo/sandbox payment note.
- Added responsive layouts for tablet and mobile widths.

## Accuracy notes
- The footer describes only existing CineBook areas: movie catalogue, scheduled showtimes, seat selection, checkout/tickets, account/booking pages, AI Concierge and AI recommendation capabilities.
- It does not claim that TMDB supplies CineBook showtimes or seat inventory.
- It does not claim that payment processing is production/live; the sandbox note remains visible.
- No non-functional contact form, newsletter signup, fake social links, or unsupported product metrics were added.

## Verification
- Source and CSS were updated in the project package.
- ZIP integrity is checked after packaging.
- Frontend production build was not verified in this workspace because `npm ci` timed out while fetching dependencies. Run `npm ci` and `npm run build` locally to complete that check.
