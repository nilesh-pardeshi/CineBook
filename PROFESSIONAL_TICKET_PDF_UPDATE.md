# CineBook two-page professional ticket PDF

The ticket print flow is now intentionally limited to **two pages**.

## Page 1 — Admission ticket
- Booking status and booking reference
- Movie title, language, certification and runtime
- Show date/time, theatre, screen/format and selected seats
- Cinema address and QR code for entry
- Ticket/food charges, convenience fee, discount, total and payment reference

## Page 2 — Movie-night companion
- Movie poster when available, otherwise a branded poster placeholder
- Movie, theatre, screen and seat summary from the current booking
- CineBook's catalogue discovery, booking clarity, AI Concierge and account features
- Practical cinema-entry reminder and a branded thank-you / visit-again ending

Cast/crew details are deliberately not fabricated. The current booking response does not provide a reliable cast list for every CineBook catalogue title. The second page uses only booking data already available and general descriptions of CineBook features.

## Print isolation fix
The print stylesheet hides the entire application except `.ticket-print-area`. This prevents the website footer, homepage marketing sections, FAQ, navbar, floating AI Concierge and other route content from appearing in the PDF. Page 1 ends with a forced page break; the companion page begins on page 2. The normal website UI is unchanged.

## Apply
Replace these files in your existing project:
- `frontend/src/pages/Ticket.jsx`
- `frontend/src/index.css`

Do not overwrite `.env`, `.venv`, PostgreSQL data or other local configuration.

Restart the frontend, open a confirmed booking, choose **Download / print ticket**, then select **Save as PDF**. In the print dialog choose A4, portrait, default scale and enable **Background graphics**. The output is designed as two pages.
