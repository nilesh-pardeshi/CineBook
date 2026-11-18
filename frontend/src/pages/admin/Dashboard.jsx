import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, Clapperboard, IndianRupee, RefreshCcw, Ticket, UtensilsCrossed, Users } from 'lucide-react';
import { api } from '../../api';
import { ErrorBox, Spinner, StatusBadge } from '../../components/Common';
import { fmtDate, fmtDateTime, money } from '../../utils';

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="stat">
      <span className="stat-icon"><Icon size={20} /></span>
      <div>
        <span className="muted small">{label}</span>
        <strong>{value}</strong>
        {sub && <span className="muted small">{sub}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get(`/admin/stats?days=${days}`).then(setData).catch((e) => setError(e.message));
  }, [days]);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const t = data.totals;
  const max = Math.max(1, ...data.daily.map((d) => d.revenue));
  const topMax = Math.max(1, ...data.top_movies.map((m) => m.revenue));
  const periodRevenue = data.daily.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="row gap-sm">
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button className="btn btn-ghost" onClick={load}><RefreshCcw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon={IndianRupee} label="Total revenue" value={money(t.revenue)} sub={`${money(t.refunds)} refunded`} />
        <Stat icon={Ticket} label="Bookings" value={t.bookings.toLocaleString('en-IN')} sub={`${t.tickets.toLocaleString('en-IN')} tickets sold`} />
        <Stat icon={UtensilsCrossed} label="Food revenue" value={money(t.food_revenue)} />
        <Stat icon={Users} label="Customers" value={t.customers.toLocaleString('en-IN')} />
        <Stat icon={CalendarClock} label="Upcoming shows" value={t.upcoming_shows.toLocaleString('en-IN')} />
        <Stat icon={Clapperboard} label="Active movies" value={t.movies} />
        <Stat icon={Building2} label="Active theatres" value={t.theatres} />
        <Stat icon={IndianRupee} label="Avg. order value" value={money(t.bookings ? Math.round(t.revenue / t.bookings) : 0)} />
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="row between wrap gap-sm">
            <h3>Revenue, last {days} days</h3>
            <span className="muted small">{money(periodRevenue)} total</span>
          </div>
          <div className="chart">
            <div className="chart-axis"><span>{money(max)}</span><span>{money(Math.round(max / 2))}</span><span>₹0</span></div>
            <div className="bars">
              {data.daily.map((d) => (
                <div className="bar-col" key={d.date} title={`${fmtDate(d.date)}: ${money(d.revenue)} from ${d.bookings} booking${d.bookings === 1 ? '' : 's'}`}>
                  <div className="bar" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} />
                  <span>{days > 14 ? (Number(d.date.slice(8)) % 2 ? d.date.slice(8) : '') : d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <h3>Top movies by revenue</h3>
          <ol className="top-list">
            {data.top_movies.map((m) => (
              <li key={m.title}>
                <div className="row between gap-sm"><strong>{m.title}</strong><span>{money(m.revenue)}</span></div>
                <div className="meter"><i style={{ width: `${(m.revenue / topMax) * 100}%` }} /></div>
                <span className="muted small">{m.bookings} bookings</span>
              </li>
            ))}
            {data.top_movies.length === 0 && <p className="muted">No sales yet.</p>}
          </ol>
        </section>
      </div>

      <section className="card">
        <div className="row between"><h3>Recent bookings</h3><Link className="link" to="/admin/bookings">View all →</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Booking</th><th>Customer</th><th>Movie</th><th>Show</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent.map((b) => (
                <tr key={b.ref}>
                  <td className="mono">{b.ref}</td>
                  <td>{b.user.name}</td>
                  <td>{b.show.movie.title}</td>
                  <td>{fmtDateTime(b.show.start_time)}</td>
                  <td>{money(b.total)}</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
