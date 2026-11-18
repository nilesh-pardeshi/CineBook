import { useCallback, useEffect, useState } from 'react';
import { Eye, ScanLine, Search } from 'lucide-react';
import { api, qs } from '../../api';
import Modal from '../../components/Modal';
import { Empty, ErrorBox, Spinner, StatusBadge } from '../../components/Common';
import { useUI } from '../../context/UIContext';
import { fmtDateTime, money } from '../../utils';

export default function AdminBookings() {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState(null);
  const [refInput, setRefInput] = useState('');
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get(`/admin/bookings${qs({ q: q.trim(), status })}`).then(setRows).catch((e) => setError(e.message));
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const checkIn = async (e) => {
    e.preventDefault();
    const ref = refInput.trim().toUpperCase();
    if (!ref) return;
    setChecking(true);
    try {
      const b = await api.post(`/admin/bookings/${ref}/checkin`);
      toast.success(`Checked in ${b.user.name}: ${b.seats.join(', ')} for ${b.show.movie.title}`);
      setRefInput('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  };

  const checkInRow = async (b) => {
    if (!(await confirm(`Mark ${b.ref} (${b.seats.join(', ')}) as used?`, { title: 'Check in', confirmText: 'Check in' }))) return;
    try {
      const res = await api.post(`/admin/bookings/${b.ref}/checkin`);
      toast.success('Checked in');
      setDetail(res);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-head"><h1>Bookings</h1></div>

      <form className="card checkin" onSubmit={checkIn}>
        <ScanLine size={22} />
        <div className="grow">
          <strong>Ticket check-in</strong>
          <span className="muted small"> Enter or scan the booking ID from the customer's QR code</span>
        </div>
        <input className="input mono" placeholder="CBXXXXXXXX" value={refInput} onChange={(e) => setRefInput(e.target.value.toUpperCase())} aria-label="Booking ID" />
        <button className="btn btn-primary" disabled={checking || !refInput.trim()}>{checking ? 'Checking…' : 'Check in'}</button>
      </form>

      <div className="filters">
        <div className="input-icon">
          <Search size={16} />
          <input className="input" placeholder="Search by booking ID, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error ? <ErrorBox message={error} onRetry={load} /> : !rows ? <Spinner /> : rows.length === 0 ? <Empty title="No bookings found" /> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Booking</th><th>Customer</th><th>Movie &amp; show</th><th>Seats</th><th>Total</th><th>Status</th><th className="right">View</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.ref}>
                    <td className="mono nowrap">{b.ref}</td>
                    <td>{b.user.name}<div className="muted small">{b.user.email}</div></td>
                    <td>{b.show.movie.title}<div className="muted small">{b.show.theatre.name} • {fmtDateTime(b.show.start_time)}</div></td>
                    <td>{b.seats.join(', ')}</td>
                    <td>{money(b.total)}</td>
                    <td><StatusBadge status={b.status} />{b.checked_in && <span className="status status-muted ml">Used</span>}</td>
                    <td className="right"><button className="icon-btn" onClick={() => setDetail(b)} aria-label="View booking"><Eye size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length >= 200 && <p className="muted small pad">Showing the latest 200 bookings. Use search to find older ones.</p>}
        </div>
      )}

      {detail && (
        <Modal
          title={`Booking ${detail.ref}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
              {detail.status === 'CONFIRMED' && !detail.checked_in && <button className="btn btn-primary" onClick={() => checkInRow(detail)}>Check in</button>}
            </>
          }
        >
          <dl className="ticket-grid">
            <div><dt>Status</dt><dd><StatusBadge status={detail.status} /> {detail.checked_in && 'Checked in'}</dd></div>
            <div><dt>Customer</dt><dd>{detail.user.name}<br />{detail.user.email}{detail.user.phone ? <><br />{detail.user.phone}</> : null}</dd></div>
            <div><dt>Movie</dt><dd>{detail.show.movie.title}</dd></div>
            <div><dt>Show</dt><dd>{detail.show.theatre.name}, {detail.show.screen.name}<br />{fmtDateTime(detail.show.start_time)}</dd></div>
            <div><dt>Seats</dt><dd>{detail.seat_details.length ? detail.seat_details.map((s) => `${s.label} (${money(s.price)})`).join(', ') : detail.seats.join(', ')}</dd></div>
            <div><dt>Snacks</dt><dd>{detail.food.length ? detail.food.map((f) => `${f.qty} × ${f.name}`).join(', ') : 'None'}</dd></div>
            <div><dt>Amount</dt><dd>{money(detail.total)}{detail.discount ? ` (after ${money(detail.discount)} off with ${detail.coupon_code})` : ''}</dd></div>
            <div><dt>Payment</dt><dd>{detail.payment_detail || '-'}{detail.payment_ref ? <><br /><span className="mono">{detail.payment_ref}</span></> : null}</dd></div>
            {detail.refund_amount > 0 && <div><dt>Refunded</dt><dd>{money(detail.refund_amount)}<br /><span className="muted small">{detail.cancel_reason}</span></dd></div>}
          </dl>
        </Modal>
      )}
    </div>
  );
}
