import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, Clapperboard, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, UserRound, Ticket, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [busy, setBusy] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const initials = useMemo(() => (form.name || user.email || 'C').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''), [form.name, user.email]);
  const profileChanged = form.name.trim() !== (user.name || '') || form.phone.trim() !== (user.phone || '');

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMessage('');
    if (form.name.trim().length < 2) return setProfileMessage('Please enter a name with at least 2 characters.');
    setBusy('profile');
    try {
      const updated = await api.put('/auth/me', { name: form.name.trim(), phone: form.phone.trim() });
      setUser(updated);
      setForm({ name: updated.name || '', phone: updated.phone || '' });
      setProfileMessage('Your profile details have been saved.');
      toast.success('Profile updated successfully');
    } catch (err) {
      setProfileMessage(err.message || 'Could not save your profile.');
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    if (pw.new_password.length < 8) return setPasswordMessage('Use at least 8 characters for your new password.');
    if (pw.new_password !== pw.confirm_password) return setPasswordMessage('The new password and confirmation do not match.');
    if (pw.current_password === pw.new_password) return setPasswordMessage('Choose a password different from your current password.');
    setBusy('password');
    try {
      await api.post('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage('Your password has been changed successfully.');
      toast.success('Password changed successfully');
    } catch (err) {
      setPasswordMessage(err.message || 'Could not change your password.');
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="container page profile-page">
      <header className="profile-welcome">
        <div className="profile-avatar">{initials || <UserRound size={30} />}</div>
        <div className="profile-welcome-copy">
          <span className="profile-eyebrow"><Sparkles size={14}/> YOUR CINEBOOK ACCOUNT</span>
          <h1>Welcome back, {form.name.split(' ')[0] || 'Movie Lover'}</h1>
          <p>Manage your details, keep your account secure and get back to the movies you love.</p>
        </div>
        <div className="profile-member-pill"><BadgeCheck size={16}/> Member account</div>
      </header>

      <nav className="profile-shortcuts" aria-label="Account shortcuts">
        <Link to="/bookings" className="profile-shortcut"><span className="profile-shortcut-icon"><Ticket size={19}/></span><span><strong>My bookings</strong><small>Tickets and booking history</small></span><ArrowRight size={17}/></Link>
        <Link to="/movies" className="profile-shortcut"><span className="profile-shortcut-icon"><Clapperboard size={19}/></span><span><strong>Explore movies</strong><small>Find your next movie night</small></span><ArrowRight size={17}/></Link>
      </nav>

      <div className="profile-grid">
        <section className="profile-panel">
          <div className="profile-panel-heading"><span className="profile-panel-icon"><UserRound size={19}/></span><div><h2>Personal details</h2><p>Keep your contact information up to date.</p></div></div>
          <form onSubmit={saveProfile}>
            <label className="field">Email address
              <span className="profile-input-wrap"><Mail size={17}/><input className="input" type="email" value={user.email || ''} disabled aria-describedby="email-help"/></span>
              <small id="email-help" className="profile-help">Your sign-in email is managed securely and cannot be changed here.</small>
            </label>
            <label className="field">Full name
              <span className="profile-input-wrap"><UserRound size={17}/><input className="input" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter your full name"/></span>
            </label>
            <label className="field">Phone number <span className="profile-optional">Optional</span>
              <span className="profile-input-wrap"><Phone size={17}/><input className="input" type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Add a contact number"/></span>
            </label>
            {profileMessage && <p className={`profile-feedback ${profileMessage.includes('saved') ? 'success' : 'error'}`} role="status">{profileMessage}</p>}
            <div className="profile-form-footer"><span className="profile-help">Changes apply to your CineBook account.</span><button className="btn btn-primary" disabled={busy === 'profile' || !profileChanged}>{busy === 'profile' ? 'Saving changes…' : 'Save changes'}</button></div>
          </form>
        </section>

        <section className="profile-panel profile-security-panel">
          <div className="profile-panel-heading"><span className="profile-panel-icon security"><LockKeyhole size={19}/></span><div><h2>Account security</h2><p>Change your password to keep your account protected.</p></div></div>
          <form onSubmit={savePassword}>
            <label className="field">Current password
              <span className="profile-input-wrap"><LockKeyhole size={17}/><input className="input" type={showCurrent ? 'text' : 'password'} required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} placeholder="Enter current password"/><button className="profile-eye" type="button" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'}>{showCurrent ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
            </label>
            <label className="field">New password
              <span className="profile-input-wrap"><ShieldCheck size={17}/><input className="input" type={showNew ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="At least 8 characters"/><button className="profile-eye" type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? 'Hide new password' : 'Show new password'}>{showNew ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
            </label>
            <label className="field">Confirm new password
              <span className="profile-input-wrap"><ShieldCheck size={17}/><input className="input" type={showConfirm ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={pw.confirm_password} onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })} placeholder="Enter new password again"/><button className="profile-eye" type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}>{showConfirm ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
            </label>
            <div className="profile-password-hint"><ShieldCheck size={16}/><span>Use at least 8 characters. Avoid reusing a password from another site.</span></div>
            {passwordMessage && <p className={`profile-feedback ${passwordMessage.includes('successfully') ? 'success' : 'error'}`} role="status">{passwordMessage}</p>}
            <div className="profile-form-footer"><span className="profile-help">Your password is never displayed or stored here.</span><button className="btn btn-primary" disabled={busy === 'password' || !pw.current_password || !pw.new_password || !pw.confirm_password}>{busy === 'password' ? 'Updating password…' : 'Update password'}</button></div>
          </form>
        </section>
      </div>

      <aside className="profile-trust-note"><ShieldCheck size={18}/><span><strong>Your account, your control.</strong> CineBook uses secure sign-in to protect your profile and bookings. Never share your password or login code with anyone.</span></aside>
    </main>
  );
}
