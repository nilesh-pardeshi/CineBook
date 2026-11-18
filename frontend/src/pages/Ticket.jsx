import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Printer, Clapperboard, MapPin, Sparkles, ShieldCheck, Ticket as TicketIcon, Popcorn, Heart, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import Poster from '../components/Poster';
import { ErrorBox, Spinner, StatusBadge } from '../components/Common';
import { useUI } from '../context/UIContext';
import { duration, fmtDateTime, money } from '../utils';

export default function Ticket() {
  const { ref } = useParams();
  const loc = useLocation();
  const { toast, confirm } = useUI();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get(`/bookings/${ref}`).then(setB).catch((e) => setError(e.message));
  }, [ref]);
  useEffect(load, [load]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={load} /></div>;
  if (!b) return <Spinner />;

  const cancel = async () => {
    const refund = Math.max(0, b.total - b.fee);
    const ok = await confirm(
      `Cancel this booking? ${money(refund)} will be refunded (the ${money(b.fee)} convenience fee is non-refundable). This can't be undone.`,
      { title: 'Cancel booking', confirmText: 'Yes, cancel', danger: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      setB(await api.post(`/bookings/${ref}/cancel`));
      toast.success('Booking cancelled. Your refund is on its way.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const { show } = b;
  const confirmed = b.status === 'CONFIRMED';

  return (
    <div className="container page ticket-page">
      {loc.state?.fresh && confirmed && (
        <div className="notice notice-success no-print">
          <CheckCircle2 size={20} /> Payment successful! Your booking is confirmed. Present the QR code at the cinema entrance.
        </div>
      )}

      <div className={`ticket-print-area ${confirmed ? '' : 'ticket-dim'}`}>
        <section className="ticket ticket-professional">
          <header className="ticket-brandbar">
            <div className="ticket-brand-lockup">
              <span className="ticket-brand-mark">▶</span>
              <span className="ticket-brand-name">Cine<span>Book</span></span>
            </div>
            <div className={`ticket-status ${confirmed ? 'is-confirmed' : 'is-cancelled'}`}>
              <span className="ticket-status-dot" />{b.status}
            </div>
          </header>

          <div className="ticket-content">
            <div className="ticket-heading">
              <div>
                <p className="ticket-eyebrow">ADMISSION TICKET</p>
                <h1>{show.movie.title}</h1>
                <p className="ticket-subtitle">{show.movie.language} <span>•</span> {show.movie.certificate} <span>•</span> {duration(show.movie.duration_min)}</p>
              </div>
              <div className="ticket-booking-ref">
                <span>BOOKING ID</span>
                <strong className="mono">{b.ref}</strong>
              </div>
            </div>

            <div className="ticket-event-grid">
              <div className="ticket-event-cell ticket-event-primary">
                <span className="ticket-label">DATE &amp; TIME</span>
                <strong>{fmtDateTime(show.start_time)}</strong>
              </div>
              <div className="ticket-event-cell">
                <span className="ticket-label">THEATRE</span>
                <strong>{show.theatre.name}</strong>
                <small>{show.theatre.city || ''}</small>
              </div>
              <div className="ticket-event-cell">
                <span className="ticket-label">SCREEN &amp; FORMAT</span>
                <strong>{show.screen.name}</strong>
                <small>{show.screen.type}</small>
              </div>
              <div className="ticket-event-cell ticket-seat-cell">
                <span className="ticket-label">YOUR SEATS</span>
                <strong>{b.seats.join('  ·  ')}</strong>
                <small>{b.seats.length} {b.seats.length === 1 ? 'ticket' : 'tickets'}</small>
              </div>
            </div>

            <div className="ticket-lower-grid">
              <div className="ticket-venue-block">
                <span className="ticket-label">CINEMA ADDRESS</span>
                <strong>{show.theatre.name}</strong>
                <p>{show.theatre.address}</p>
                <div className="ticket-entry-note">Please keep this ticket ready and present the QR code at the cinema entrance.</div>
              </div>
              <aside className="ticket-qr-panel">
                {confirmed ? (
                  <>
                    <div className="ticket-qr-frame"><QRCodeSVG value={b.ref} size={132} level="H" includeMargin /></div>
                    <strong className="mono">{b.ref}</strong>
                    <span>SCAN AT CINEMA ENTRY</span>
                  </>
                ) : (
                  <div className="center">
                    <p className="muted">{b.status === 'CANCELLED' ? 'This ticket was cancelled.' : 'Payment not completed.'}</p>
                    {b.refund_amount > 0 && <p><strong>{money(b.refund_amount)}</strong> refunded</p>}
                    {b.cancel_reason && <p className="muted small">{b.cancel_reason}</p>}
                  </div>
                )}
              </aside>
            </div>

            <section className="ticket-payment-block">
              <div className="ticket-section-heading">
                <h2>PAYMENT SUMMARY</h2>
                <span>{confirmed ? 'PAYMENT CONFIRMED' : b.status}</span>
              </div>
              <div className="ticket-payment-lines">
                <div><span>Tickets ({b.seat_details.map((s) => s.label).join(', ')})</span><strong>{money(b.seat_total)}</strong></div>
                {b.food.map((f) => <div key={f.name}><span>{f.qty} × {f.name}</span><strong>{money(f.qty * f.unit_price)}</strong></div>)}
                <div><span>Convenience fee</span><strong>{money(b.fee)}</strong></div>
                {b.discount > 0 && <div className="ticket-discount"><span>Discount ({b.coupon_code})</span><strong>− {money(b.discount)}</strong></div>}
              </div>
              <div className="ticket-total-line"><span>TOTAL PAID</span><strong>{money(b.total)}</strong></div>
              {b.payment_ref && <p className="ticket-payment-meta">Paid via {b.payment_detail} <span>•</span> Payment reference: <strong className="mono">{b.payment_ref}</strong></p>}
              {b.food.length > 0 && <p className="ticket-food-note">Food order included. Show this ticket at the cinema food counter for collection.</p>}
            </section>
          </div>

          <footer className="ticket-footer">
            <div>
              <strong>CineBook</strong>
              <span>Your cinema, one place.</span>
            </div>
            <p>Thank you for booking with CineBook. Enjoy the show!</p>
          </footer>
        </section>

        {confirmed && (
          <section className="ticket-companion-page">
            <header className="companion-topbar">
              <div className="ticket-brand-lockup">
                <span className="ticket-brand-mark">▶</span>
                <span className="ticket-brand-name">Cine<span>Book</span></span>
              </div>
              <span className="companion-kicker">YOUR CINEMA · YOUR MOMENT</span>
            </header>

            <div className="companion-hero">
              <div className="companion-hero-copy">
                <span className="companion-overline">THE MOVIE NIGHT EDITION</span>
                <h2>Make room for<br /><em>movie magic.</em></h2>
                <p>Your booking is ready. Here is a little more about the cinema experience you have planned with CineBook.</p>
              </div>
              <div className="companion-poster-wrap">
                {show.movie.poster_url ? <img src={show.movie.poster_url} alt={`${show.movie.title} poster`} /> : <div className="companion-poster-placeholder"><Clapperboard size={38} /><strong>{show.movie.title}</strong><span>{show.movie.language}</span></div>}
              </div>
            </div>

            <div className="companion-film-strip">
              <div><span>YOUR FILM</span><strong>{show.movie.title}</strong><small>{show.movie.language} · {show.movie.certificate} · {duration(show.movie.duration_min)}</small></div>
              <div><span>YOUR CINEMA</span><strong>{show.theatre.name}</strong><small>{show.screen.name} · {show.screen.type}</small></div>
              <div><span>YOUR SEATS</span><strong>{b.seats.join(' · ')}</strong><small>{b.seats.length} {b.seats.length === 1 ? 'seat' : 'seats'} reserved</small></div>
            </div>

            <div className="companion-section-title"><span>THE CINEBOOK DIFFERENCE</span><h3>More than a ticket. A smoother movie night.</h3></div>
            <div className="companion-feature-grid">
              <article><span className="companion-icon coral"><TicketIcon size={19} /></span><strong>Clear booking, all in one place</strong><p>Your showtime, theatre, screen, seats and payment summary stay together in one easy-to-check ticket.</p></article>
              <article><span className="companion-icon violet"><Sparkles size={19} /></span><strong>AI Concierge assistance</strong><p>Get help exploring movies and planning a visit. You stay in control of the final show and seat selection.</p></article>
              <article><span className="companion-icon blue"><MapPin size={19} /></span><strong>Local cinema discovery</strong><p>Explore cinema options by city and compare available show information before you book.</p></article>
              <article><span className="companion-icon green"><ShieldCheck size={19} /></span><strong>Booking details you can trust</strong><p>Your confirmed ticket carries the booking reference and QR code used for cinema entry.</p></article>
            </div>

            <div className="companion-visit-card">
              <div><span className="companion-overline">A QUICK REMINDER</span><h3>Arrive a little early.<br />Settle in. Enjoy the show.</h3><p>Keep your QR ticket ready at the entrance. Please check your showtime and theatre address on page one before travelling.</p></div>
              <div className="companion-thanks-mark"><Heart size={25} /><strong>Thank you<br />for choosing<br />CineBook.</strong></div>
            </div>

            <footer className="companion-footer">
              <div><strong>Cine<span>Book</span></strong><small>Your cinema, one place.</small></div>
              <p>Discover. Choose. Book. Enjoy.</p>
              <span>We look forward to welcoming you again.</span>
            </footer>
          </section>
        )}
      </div>

      <div className="row gap wrap no-print ticket-actions">
        {confirmed && <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Download / print ticket</button>}
        {b.can_cancel && <button className="btn btn-danger" onClick={cancel} disabled={busy}>Cancel booking</button>}
        {b.status === 'PENDING' && b.seconds_left > 0 && <Link className="btn btn-ghost" to={`/checkout/${b.ref}`}>Continue to payment</Link>}
        <Link className="btn btn-ghost" to="/bookings">All bookings</Link>
      </div>
      {confirmed && !b.can_cancel && !b.checked_in && !show.is_past && (
        <p className="muted small no-print">Cancellation window has closed (tickets can be cancelled up to 2 hours before the show).</p>
      )}
    </div>
  );
}
