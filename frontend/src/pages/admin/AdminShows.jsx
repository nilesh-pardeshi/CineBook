import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CalendarRange, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { api, qs } from '../../api';
import Modal from '../../components/Modal';
import { Empty, ErrorBox, Spinner } from '../../components/Common';
import { useUI } from '../../context/UIContext';
import { fmtDateTime, fmtTime, isoToday, money } from '../../utils';

const EMPTY = { movie_id: '', screen_id: '', start_time: '', price_regular: 200, price_premium: 300, price_recliner: 500 };

function PriceFields({ form, set }) {
  return (
    <>
      <label className="field">Classic price (₹)
        <input className="input" type="number" min={0} required value={form.price_regular} onChange={set('price_regular')} />
      </label>
      <label className="field">Prime price (₹)
        <input className="input" type="number" min={0} required value={form.price_premium} onChange={set('price_premium')} />
      </label>
      <label className="field">Recliner price (₹)
        <input className="input" type="number" min={0} required value={form.price_recliner} onChange={set('price_recliner')} />
      </label>
    </>
  );
}

function MovieScreenFields({ form, set, movies, screens }) {
  return (
    <>
      <label className="field span2">Movie
        <select className="input" required value={form.movie_id} onChange={set('movie_id')}>
          <option value="">Select movie…</option>
          {movies.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.duration_min} min)</option>)}
        </select>
      </label>
      <label className="field span2">Screen
        <select className="input" required value={form.screen_id} onChange={set('screen_id')}>
          <option value="">Select screen…</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.theatre_name} - {s.name} ({s.screen_type})</option>)}
        </select>
      </label>
    </>
  );
}

export default function AdminShows() {
  const { toast, confirm } = useUI();
  const [shows, setShows] = useState(null);
  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ date: '', movie_id: '', upcoming_only: true });
  const [modal, setModal] = useState(null); // 'new' | 'bulk' | show row
  const [form, setForm] = useState(EMPTY);
  const [bulk, setBulk] = useState({ ...EMPTY, start_date: isoToday(), end_date: isoToday(), times: ['10:00', '14:00', '18:00'] });
  const [newTime, setNewTime] = useState('21:30');
  const [bulkResult, setBulkResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get(`/admin/shows${qs({ date: filters.date, movie_id: filters.movie_id, upcoming_only: filters.upcoming_only ? 'true' : '' })}`)
      .then(setShows)
      .catch((e) => setError(e.message));
  }, [filters]);
  useEffect(load, [load]);

  useEffect(() => {
    api.get('/admin/movies').then((l) => setMovies(l.filter((m) => m.is_active && m.status === 'now_showing'))).catch(() => {});
    api.get('/admin/screens').then((l) => setScreens(l.filter((s) => s.is_active))).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setB = (k) => (e) => setBulk((f) => ({ ...f, [k]: e.target.value }));
  const num = (f) => ({ ...f, movie_id: Number(f.movie_id), screen_id: Number(f.screen_id), price_regular: Number(f.price_regular), price_premium: Number(f.price_premium), price_recliner: Number(f.price_recliner) });

  const openNew = () => { setForm(EMPTY); setModal('new'); };
  const openEdit = (s) => {
    setForm({ movie_id: s.movie_id, screen_id: s.screen_id, start_time: s.start_time.slice(0, 16), price_regular: s.price_regular, price_premium: s.price_premium, price_recliner: s.price_recliner });
    setModal(s);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'new') await api.post('/admin/shows', { ...num(form), is_active: true });
      else await api.put(`/admin/shows/${modal.id}`, { ...num(form), is_active: modal.is_active });
      toast.success(modal === 'new' ? 'Show scheduled' : 'Show updated');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveBulk = async (e) => {
    e.preventDefault();
    if (!bulk.times.length) return toast.error('Add at least one showtime');
    setSaving(true);
    try {
      const res = await api.post('/admin/shows/bulk', { ...num(bulk), start_date: bulk.start_date, end_date: bulk.end_date, times: bulk.times });
      setBulkResult(res);
      toast.success(`${res.created} show${res.created === 1 ? '' : 's'} scheduled`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => {
    const body = { movie_id: s.movie_id, screen_id: s.screen_id, start_time: s.start_time.slice(0, 16), price_regular: s.price_regular, price_premium: s.price_premium, price_recliner: s.price_recliner, is_active: !s.is_active };
    if (s.is_active) {
      const ok = await confirm(
        s.booked ? `This show has ${s.booked} booked seat(s). Cancelling it will cancel every booking and refund customers in full.` : 'Cancel this show? It will no longer be visible to customers.',
        { title: 'Cancel show', confirmText: 'Cancel show', cancelText: 'Keep show', danger: true }
      );
      if (!ok) return;
    }
    try {
      const res = await api.put(`/admin/shows/${s.id}`, body);
      toast.success(s.is_active ? `Show cancelled${res.refunded_bookings ? `, ${res.refunded_bookings} booking(s) refunded` : ''}` : 'Show re-activated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (s) => {
    if (!(await confirm('Delete this show permanently?', { title: 'Delete show', confirmText: 'Delete', danger: true }))) return;
    try {
      await api.del(`/admin/shows/${s.id}`);
      toast.success('Show deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addTime = () => {
    if (!newTime) return;
    setBulk((b) => ({ ...b, times: [...new Set([...b.times, newTime])].sort() }));
  };

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>Shows</h1>
        <div className="row gap-sm wrap">
          <button className="btn btn-ghost" onClick={() => { setBulkResult(null); setModal('bulk'); }}><CalendarRange size={16} /> Bulk schedule</button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add show</button>
        </div>
      </div>

      <div className="filters">
        <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} aria-label="Date" />
        <select className="input" value={filters.movie_id} onChange={(e) => setFilters({ ...filters, movie_id: e.target.value })} aria-label="Movie">
          <option value="">All movies</option>
          {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={filters.upcoming_only} onChange={(e) => setFilters({ ...filters, upcoming_only: e.target.checked })} /> Upcoming only
        </label>
        {(filters.date || filters.movie_id) && <button className="btn btn-ghost" onClick={() => setFilters({ date: '', movie_id: '', upcoming_only: true })}><X size={15} /> Clear</button>}
      </div>

      {error ? <ErrorBox message={error} onRetry={load} /> : !shows ? <Spinner /> : shows.length === 0 ? (
        <Empty title="No shows found" text="Schedule a show or change the filters." action={<button className="btn btn-primary" onClick={openNew}><CalendarPlus size={16} /> Add show</button>} />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Movie</th><th>Theatre / screen</th><th>Prices</th><th>Seats</th><th>State</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {shows.map((s) => (
                  <tr key={s.id} className={s.is_active ? '' : 'row-off'}>
                    <td className="nowrap"><strong>{fmtDateTime(s.start_time)}</strong><div className="muted small">ends {fmtTime(s.end_time)}</div></td>
                    <td>{s.movie_title}</td>
                    <td>{s.theatre_name}<div className="muted small">{s.city} • {s.screen_name}</div></td>
                    <td className="nowrap small">{money(s.price_regular)} / {money(s.price_premium)} / {money(s.price_recliner)}</td>
                    <td>{s.booked} / {s.total_seats}</td>
                    <td><span className={`status ${s.is_active ? 'status-success' : 'status-muted'}`}>{s.is_active ? 'Scheduled' : 'Cancelled'}</span></td>
                    <td className="right nowrap">
                      <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit show"><Pencil size={16} /></button>
                      <button className="icon-btn" onClick={() => toggle(s)} aria-label={s.is_active ? 'Cancel show' : 'Re-activate show'} title={s.is_active ? 'Cancel show' : 'Re-activate'}><Power size={16} /></button>
                      <button className="icon-btn danger" onClick={() => remove(s)} aria-label="Delete show"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shows.length >= 500 && <p className="muted small pad">Showing the first 500 shows. Use filters to narrow down.</p>}
        </div>
      )}

      {(modal === 'new' || (modal && modal !== 'bulk')) && (
        <Modal
          title={modal === 'new' ? 'Schedule a show' : 'Edit show'}
          wide
          onClose={() => setModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" type="submit" form="show-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}
        >
          <form id="show-form" className="form-grid" onSubmit={save}>
            <MovieScreenFields form={form} set={set} movies={movies} screens={screens} />
            <label className="field span2">Start time
              <input className="input" type="datetime-local" required value={form.start_time} onChange={set('start_time')} />
              <span className="muted small">A 15 minute cleaning gap is required between shows on the same screen.</span>
            </label>
            <PriceFields form={form} set={set} />
            {modal !== 'new' && modal.booked > 0 && <p className="notice notice-info span2 small">This show already has bookings, so only prices can be changed.</p>}
          </form>
        </Modal>
      )}

      {modal === 'bulk' && (
        <Modal
          title="Bulk schedule"
          wide
          onClose={() => setModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button><button className="btn btn-primary" type="submit" form="bulk-form" disabled={saving}>{saving ? 'Scheduling…' : 'Create shows'}</button></>}
        >
          <form id="bulk-form" className="form-grid" onSubmit={saveBulk}>
            <MovieScreenFields form={bulk} set={setB} movies={movies} screens={screens} />
            <label className="field">From date
              <input className="input" type="date" required min={isoToday()} value={bulk.start_date} onChange={setB('start_date')} />
            </label>
            <label className="field">To date
              <input className="input" type="date" required min={bulk.start_date} value={bulk.end_date} onChange={setB('end_date')} />
            </label>
            <div className="field span2">
              Showtimes (every day in the range)
              <div className="chips">
                {bulk.times.map((t) => (
                  <span className="chip on" key={t}>{t}<button type="button" className="chip-x" onClick={() => setBulk((b) => ({ ...b, times: b.times.filter((x) => x !== t) }))} aria-label={`Remove ${t}`}><X size={12} /></button></span>
                ))}
              </div>
              <div className="row gap-sm">
                <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                <button type="button" className="btn btn-ghost" onClick={addTime}>Add time</button>
              </div>
            </div>
            <PriceFields form={bulk} set={setB} />
            {bulkResult && (
              <div className="notice notice-info span2 small">
                <strong>{bulkResult.created} created.</strong>
                {bulkResult.skipped.length > 0 && <> Skipped {bulkResult.skipped.length}: {bulkResult.skipped.slice(0, 8).join('; ')}{bulkResult.skipped.length > 8 ? '…' : ''}</>}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
