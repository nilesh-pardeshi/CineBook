import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertCircle, Film } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="center-box" role="status">
    <div className="spinner" />
    <span className="muted">{label}</span>
  </div>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div className="center-box error-box">
    <AlertCircle size={34} />
    <h3>Something went wrong</h3>
    <p className="muted">{message}</p>
    {onRetry && (
      <button className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const Empty = ({ title, text, action }) => (
  <div className="center-box">
    <Film size={38} className="muted" />
    <h3>{title}</h3>
    {text && <p className="muted">{text}</p>}
    {action}
  </div>
);

export const SkeletonGrid = ({ n = 10 }) => (
  <div className="grid-movies">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="skeleton-card">
        <div className="skeleton" style={{ aspectRatio: '2/3' }} />
        <div className="skeleton" style={{ height: 14, width: '80%', marginTop: 12 }} />
        <div className="skeleton" style={{ height: 12, width: '55%', marginTop: 8 }} />
      </div>
    ))}
  </div>
);

export function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (admin && user.role !== 'admin')
    return (
      <div className="container page">
        <Empty title="Admins only" text="You don't have access to this area." action={<Link className="btn btn-primary" to="/">Go home</Link>} />
      </div>
    );
  return children;
}

export const StatusBadge = ({ status }) => {
  const map = { CONFIRMED: 'success', CANCELLED: 'danger', PENDING: 'warn', EXPIRED: 'muted' };
  return <span className={`status status-${map[status] || 'muted'}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
};
