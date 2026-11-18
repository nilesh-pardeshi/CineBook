import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Logo } from '../components/Navbar';

function useAfterAuth() {
  const nav = useNavigate();
  const loc = useLocation();
  return (user) => nav(loc.state?.from || (user.role === 'admin' ? '/admin' : '/'), { replace: true });
}

export function Login() {
  const { user, login } = useAuth();
  const { toast } = useUI();
  const after = useAfterAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      after(await login(form.email.trim(), form.password));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Welcome back</h1>
        <p className="muted">Log in to book tickets and manage your bookings.</p>
        <label className="field">Email
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">Password
          <input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <div className="demo-box">
          <span className="muted small">Demo accounts</span>
          <div className="row gap-sm wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ email: 'user@cinebook.com', password: 'User@123' })}>Customer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ email: 'admin@cinebook.com', password: 'Admin@123' })}>Admin</button>
          </div>
        </div>
        <p className="muted center">New here? <Link className="link" to="/register" state={useLocation().state}>Create an account</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const { toast } = useUI();
  const after = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register({ ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
      toast.success(`Welcome to CineBook, ${u.name.split(' ')[0]}!`);
      after(u);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Create your account</h1>
        <p className="muted">Book in seconds and keep all your tickets in one place.</p>
        <label className="field">Full name
          <input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label className="field">Email
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">Phone <span className="muted small">(optional)</span>
          <input className="input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </label>
        <label className="field">Password
          <input className="input" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="At least 6 characters" />
        </label>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
        <p className="muted center">Already have an account? <Link className="link" to="/login" state={useLocation().state}>Log in</Link></p>
      </form>
    </div>
  );
}
