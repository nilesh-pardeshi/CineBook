import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Poster from '../components/Poster';
import { Empty, ErrorBox, Spinner, StatusBadge } from '../components/Common';
import { fmtDateTime, money } from '../utils';

const TABS = [
  { id: 'upcoming', label: 'Upcoming', test: (b) => b.status === 'CONFIRMED' && !b.show.is_past },
  { id: 'past', label: 'Past', test: (b) => b.status === 'CONFIRMED' && b.show.is_past },
  { id: 'cancelled', label: 'Cancelled', test: (b) => b.status === 'CANCELLED' },
];

export default function MyBookings() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(() => {
    setError('');
    api.get('/bookings/mine').then(setList).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={load} /></div>;
  if (!list) return <Spinner />;

  const current = TABS.find((t) => t.id === tab);
  const rows = list.filter(current.test);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>My bookings</h1>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label} ({list.filter(t.test).length})
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty
          title={`No ${current.label.toLowerCase()} bookings`}
          text={tab === 'upcoming' ? 'Time for a movie night?' : undefined}
          action={tab === 'upcoming' ? <Link className="btn btn-primary" to="/movies">Browse movies</Link> : null}
        />
      ) : (
        <div className="booking-list">
          {rows.map((b) => (
            <Link to={`/booking/${b.ref}`} className="booking-card" key={b.ref}>
              <div className="booking-poster"><Poster movie={b.show.movie} /></div>
              <div className="booking-body">
                <div className="row between gap-sm wrap">
                  <h3>{b.show.movie.title}</h3>
                  <StatusBadge status={b.status} />
                </div>
                <p className="muted small">{b.show.theatre.name}, {b.show.theatre.city}</p>
                <p>{fmtDateTime(b.show.start_time)}</p>
                <p className="muted small">Seats: {b.seats.join(', ')} • <span className="mono">{b.ref}</span></p>
              </div>
              <div className="booking-amount">
                <strong>{money(b.total)}</strong>
                {b.refund_amount > 0 && <span className="muted small">{money(b.refund_amount)} refunded</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
