import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2, CalendarClock, Clapperboard, LayoutDashboard, MonitorPlay, Menu, Percent, Ticket, UtensilsCrossed, X, ArrowLeft,
} from 'lucide-react';
import { Logo } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
  { to: '/admin/shows', label: 'Shows', icon: CalendarClock },
  { to: '/admin/movies', label: 'Movies', icon: Clapperboard },
  { to: '/admin/theatres', label: 'Theatres', icon: Building2 },
  { to: '/admin/screens', label: 'Screens', icon: MonitorPlay },
  { to: '/admin/food', label: 'Food & drinks', icon: UtensilsCrossed },
  { to: '/admin/coupons', label: 'Coupons', icon: Percent },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="admin-shell">
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <div className="admin-brand">
          <Link to="/"><Logo /></Link>
          <span className="badge">Admin</span>
        </div>
        <nav>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <l.icon size={18} /> {l.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="admin-back"><ArrowLeft size={16} /> Back to site</Link>
      </aside>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
      <div className="admin-body">
        <header className="admin-top">
          <button className="icon-btn admin-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="muted">Signed in as <strong>{user.name}</strong></span>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
