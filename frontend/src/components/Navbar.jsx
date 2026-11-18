import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, MapPin, Menu, Search, Ticket, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f43f5e" />
            <stop offset="1" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#lg)" />
        <path d="M20 18h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4Zm9 8v12l10-6-10-6Z" fill="#fff" />
      </svg>
      <span>
        Cine<b>Book</b>
      </span>
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { city, cities, setCity } = useCity();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [loc.pathname]);

  useEffect(() => {
    const onClick = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const search = (e) => {
    e.preventDefault();
    nav(`/movies${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setOpen(false);
  };

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" aria-label="CineBook home">
          <Logo />
        </Link>

        <form className="nav-search" onSubmit={search} role="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies…" aria-label="Search movies" />
        </form>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/movies" end>
            Movies
          </NavLink>
          <NavLink to="/movies?status=upcoming">Coming soon</NavLink>
          <NavLink to="/cinemas">Cinemas</NavLink>
          <div className="city-select">
            <MapPin size={15} />
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Select city">
              {(cities.length ? cities : [city]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button className="user-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
                <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="user-name">{user.name.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="dropdown">
                  <Link to="/bookings">
                    <Ticket size={16} /> My bookings
                  </Link>
                  <Link to="/profile">
                    <User size={16} /> Profile
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin">
                      <LayoutDashboard size={16} /> Admin panel
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      nav('/');
                    }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </div>
          )}
        </nav>

        <button className="icon-btn nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
