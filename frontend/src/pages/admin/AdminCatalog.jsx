import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clapperboard, Download, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { api, qs } from '../../api';
import Modal from '../../components/Modal';
import { Empty, ErrorBox, Spinner } from '../../components/Common';
import { useUI } from '../../context/UIContext';
import { fmtShort, money } from '../../utils';

const Active = ({ on }) => <span className={`status ${on ? 'status-success' : 'status-muted'}`}>{on ? 'Active' : 'Inactive'}</span>;

function FieldInput({ f, value, onChange, options }) {
  const v = value ?? '';
  if (f.type === 'textarea')
    return <textarea className="input" rows={4} value={v} onChange={(e) => onChange(e.target.value)} required={f.required} />;
  if (f.type === 'checkbox')
    return (
      <label className="check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.checkLabel || 'Yes'}
      </label>
    );
  if (f.type === 'select') {
    const list = f.optionsFrom ? options[f.optionsFrom.path] || [] : f.options;
    return (
      <select className="input" value={v} onChange={(e) => onChange(e.target.value)} required={f.required}>
        {f.optionsFrom && <option value="">Select…</option>}
        {list.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    );
  }
  return (
    <input
      className="input"
      type={f.type || 'text'}
      value={v}
      onChange={(e) => onChange(e.target.value)}
      required={f.required}
      min={f.min}
      max={f.max}
      step={f.step}
      placeholder={f.placeholder}
    />
  );
}


function MovieMetadataLookup({ onApply, currentTitle = '' }) {
  const [query, setQuery] = useState(currentTitle);
  const [language, setLanguage] = useState('hi-IN');
  const [results, setResults] = useState([]);
  const [configured, setConfigured] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/discovery/status').then(setConfigured).catch(() => setConfigured({ configured: false }));
  }, []);

  const search = async (e) => {
    e.preventDefault();
    if (query.trim().length < 2) { setError('Enter at least two characters.'); return; }
    setLoading(true); setError(''); setResults([]);
    try {
      const data = await api.get(`/discovery/search${qs({ query: query.trim(), language })}`);
      setResults(data.results || []);
      if (!(data.results || []).length) setError('No matching movies found. Try another language or spelling.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const choose = async (item) => {
    setLoadingId(item.tmdb_id); setError('');
    try {
      const details = await api.get(`/discovery/movie/${item.tmdb_id}${qs({ language })}`);
      onApply(details);
      setResults([]);
      setQuery(details.title || item.title);
    } catch (err) { setError(err.message); }
    finally { setLoadingId(null); }
  };

  return (
    <section className="tmdb-lookup">
      <div className="tmdb-lookup-title"><span className="tmdb-icon"><Sparkles size={17} /></span><div><strong>Import movie details from TMDB</strong><p>Find real Indian and international movies, then autofill the form.</p></div></div>
      {configured && !configured.configured ? (
        <div className="notice-warn tmdb-notice">TMDB is not configured. Add <code>TMDB_READ_ACCESS_TOKEN</code> to <code>backend/.env</code>, then restart FastAPI.</div>
      ) : (
        <>
          <form className="tmdb-search-row" onSubmit={search}>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search e.g. Sairat, Jawan, RRR, Leo…" aria-label="Movie title to search" />
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Search language">
              <option value="hi-IN">Hindi</option><option value="mr-IN">Marathi</option><option value="te-IN">Telugu</option><option value="ta-IN">Tamil</option><option value="kn-IN">Kannada</option><option value="ml-IN">Malayalam</option><option value="en-US">English</option><option value="bn-IN">Bengali</option><option value="gu-IN">Gujarati</option><option value="pa-IN">Punjabi</option>
            </select>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? <Loader2 className="spin-icon" size={16} /> : <Search size={16} />} Search</button>
          </form>
          {error && <p className="form-error tmdb-error">{error}</p>}
          {results.length > 0 && <div className="tmdb-results">{results.map((item) => (
            <article className="tmdb-result" key={item.tmdb_id}>
              {item.poster_url ? <img src={item.poster_url} alt={`${item.title} poster`} loading="lazy" /> : <div className="tmdb-result-no-poster"><Clapperboard size={20} /></div>}
              <div className="tmdb-result-copy"><strong>{item.title}</strong><span>{item.release_date?.slice(0, 4) || 'Release year unknown'} · {item.language} · {item.rating ? `${item.rating}/10` : 'Not rated'}</span><p>{item.overview || 'No synopsis available.'}</p></div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => choose(item)} disabled={loadingId !== null}>{loadingId === item.tmdb_id ? <Loader2 className="spin-icon" size={15} /> : <Download size={15} />} Use</button>
            </article>
          ))}</div>}
          <p className="muted small tmdb-attribution">Movie metadata and artwork supplied by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>.</p>
        </>
      )}
    </section>
  );
}

/** One reusable list + add/edit modal + delete for a simple admin table. */
function CrudPage({ title, noun, path, columns, fields, defaults, searchKeys, metadataLookup = false }) {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState(null);
  const [options, setOptions] = useState({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get(`/admin/${path}`).then(setRows).catch((e) => setError(e.message));
  }, [path]);

  useEffect(() => {
    setRows(null);
    load();
    fields
      .filter((f) => f.optionsFrom)
      .forEach((f) =>
        api.get(`/admin/${f.optionsFrom.path}`).then((list) =>
          setOptions((o) => ({ ...o, [f.optionsFrom.path]: list.map((r) => ({ value: r.id, label: f.optionsFrom.label(r) })) }))
        )
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q))) : rows;
  }, [rows, search, searchKeys]);

  const open = (row) => {
    const init = { ...defaults };
    if (row !== 'new') fields.forEach((f) => (init[f.name] = row[f.name] ?? (f.type === 'checkbox' ? false : '')));
    setForm(init);
    setEditing(row);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {};
    fields.forEach((f) => {
      let v = form[f.name];
      if (f.type === 'number') v = v === '' || v == null ? (f.nullable ? '' : undefined) : Number(v);
      else if (f.type === 'checkbox') v = !!v;
      else if (f.type === 'select' && f.optionsFrom) v = Number(v);
      else v = v ?? '';
      if (v !== undefined) payload[f.name] = v;
    });
    setSaving(true);
    try {
      if (editing === 'new') await api.post(`/admin/${path}`, payload);
      else await api.put(`/admin/${path}/${editing.id}`, payload);
      toast.success(`${noun} ${editing === 'new' ? 'created' : 'updated'}`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm(`Delete this ${noun.toLowerCase()}? This can't be undone.`, { title: `Delete ${noun.toLowerCase()}`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/admin/${path}/${row.id}`);
      toast.success(`${noun} deleted`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!rows) return <Spinner />;

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>{title}</h1>
        <div className="row gap-sm">
          <div className="input-icon">
            <Search size={16} />
            <input className="input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => open('new')}><Plus size={16} /> Add {noun.toLowerCase()}</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title={`No ${title.toLowerCase()} found`} />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}<th className="right">Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    {columns.map((c) => <td key={c.label}>{c.render ? c.render(r) : r[c.key]}</td>)}
                    <td className="right nowrap">
                      <button className="icon-btn" onClick={() => open(r)} aria-label="Edit"><Pencil size={16} /></button>
                      <button className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <Modal
          title={`${editing === 'new' ? 'Add' : 'Edit'} ${noun.toLowerCase()}`}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit" form="crud-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          {metadataLookup && <MovieMetadataLookup currentTitle={form.title || ''} onApply={(details) => {
            setForm((current) => ({ ...current, ...Object.fromEntries(['title','description','genres','language','duration_min','certificate','rating','poster_url','backdrop_url','trailer_url','release_date','director','cast_members'].map((key) => [key, details[key] ?? current[key]])) }));
            toast.success('Movie details imported. Review the fields and save.');
          }} />}
          <form id="crud-form" className="form-grid" onSubmit={save}>
            {fields.map((f) => (
              <label key={f.name} className={`field ${f.wide ? 'span2' : ''}`}>
                {f.label}
                <FieldInput f={f} value={form[f.name]} options={options} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
                {f.help && <span className="muted small">{f.help}</span>}
              </label>
            ))}
          </form>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ configs
export function AdminMovies() {
  return (
    <CrudPage
      title="Movies" noun="Movie" path="movies" metadataLookup
      searchKeys={['title', 'language', 'genres', 'director']}
      defaults={{ language: 'Hindi', duration_min: 120, certificate: 'UA', rating: 0, status: 'now_showing', is_featured: false, is_active: true }}
      columns={[
        { label: 'Title', render: (r) => <strong>{r.title}</strong> },
        { label: 'Language', key: 'language' },
        { label: 'Genres', key: 'genres' },
        { label: 'Duration', render: (r) => `${r.duration_min} min` },
        { label: 'Rating', render: (r) => (r.rating ? r.rating.toFixed(1) : '-') },
        { label: 'Status', render: (r) => (r.status === 'upcoming' ? `Upcoming${r.release_date ? ' • ' + fmtShort(r.release_date) : ''}` : 'Now showing') },
        { label: 'Featured', render: (r) => (r.is_featured ? '★' : '') },
        { label: 'State', render: (r) => <Active on={r.is_active} /> },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true, wide: true },
        { name: 'description', label: 'Description', type: 'textarea', wide: true },
        { name: 'genres', label: 'Genres', help: 'Comma separated, e.g. Action, Drama' },
        { name: 'language', label: 'Language', required: true },
        { name: 'duration_min', label: 'Duration (minutes)', type: 'number', min: 30, max: 400, required: true },
        { name: 'certificate', label: 'Certificate', type: 'select', options: ['U', 'UA', 'A', 'S'] },
        { name: 'rating', label: 'Rating (0-10)', type: 'number', min: 0, max: 10, step: 0.1 },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'now_showing', label: 'Now showing' }, { value: 'upcoming', label: 'Upcoming' }] },
        { name: 'release_date', label: 'Release date', type: 'date' },
        { name: 'director', label: 'Director' },
        { name: 'cast_members', label: 'Cast', help: 'Comma separated', wide: true },
        { name: 'poster_url', label: 'Poster image URL', type: 'url', wide: true, help: 'Optional. A gradient poster is generated when empty.' },
        { name: 'backdrop_url', label: 'Backdrop image URL', type: 'url', wide: true },
        { name: 'trailer_url', label: 'Trailer URL', type: 'url', wide: true },
        { name: 'is_featured', label: 'Featured on home page', type: 'checkbox', checkLabel: 'Show in hero banner' },
        { name: 'is_active', label: 'Visibility', type: 'checkbox', checkLabel: 'Visible to customers' },
      ]}
    />
  );
}

export function AdminTheatres() {
  return (
    <CrudPage
      title="Theatres" noun="Theatre" path="theatres"
      searchKeys={['name', 'city', 'address']}
      defaults={{ is_active: true }}
      columns={[
        { label: 'Name', render: (r) => <strong>{r.name}</strong> },
        { label: 'City', key: 'city' },
        { label: 'Address', key: 'address' },
        { label: 'Amenities', key: 'amenities' },
        { label: 'State', render: (r) => <Active on={r.is_active} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, wide: true },
        { name: 'city', label: 'City', required: true },
        { name: 'amenities', label: 'Amenities', help: 'Comma separated' },
        { name: 'address', label: 'Address', wide: true },
        { name: 'is_active', label: 'Visibility', type: 'checkbox', checkLabel: 'Open for bookings' },
      ]}
    />
  );
}

export function AdminScreens() {
  return (
    <CrudPage
      title="Screens" noun="Screen" path="screens"
      searchKeys={['name', 'theatre_name', 'screen_type']}
      defaults={{ screen_type: 'Standard 2D', rows: 10, cols: 14, premium_rows: 3, recliner_rows: 0, is_active: true }}
      columns={[
        { label: 'Theatre', key: 'theatre_name' },
        { label: 'Screen', render: (r) => <strong>{r.name}</strong> },
        { label: 'Type', key: 'screen_type' },
        { label: 'Layout', render: (r) => `${r.rows} × ${r.cols} = ${r.rows * r.cols} seats` },
        { label: 'Tiers', render: (r) => `${r.rows - r.premium_rows - r.recliner_rows} classic, ${r.premium_rows} prime, ${r.recliner_rows} recliner` },
        { label: 'State', render: (r) => <Active on={r.is_active} /> },
      ]}
      fields={[
        { name: 'theatre_id', label: 'Theatre', type: 'select', required: true, wide: true, optionsFrom: { path: 'theatres', label: (t) => `${t.name} (${t.city})` } },
        { name: 'name', label: 'Screen name', required: true },
        { name: 'screen_type', label: 'Type', type: 'select', options: ['Standard 2D', 'Dolby Atmos', 'IMAX', '4DX', 'Recliner Lounge'] },
        { name: 'rows', label: 'Rows (A, B, C…)', type: 'number', min: 3, max: 26, required: true },
        { name: 'cols', label: 'Seats per row', type: 'number', min: 4, max: 30, required: true },
        { name: 'premium_rows', label: 'Prime rows (at the back)', type: 'number', min: 0, max: 20 },
        { name: 'recliner_rows', label: 'Recliner rows (last)', type: 'number', min: 0, max: 10, help: 'Layout can only change while the screen has no upcoming shows.' },
        { name: 'is_active', label: 'Visibility', type: 'checkbox', checkLabel: 'In service' },
      ]}
    />
  );
}

export function AdminFood() {
  return (
    <CrudPage
      title="Food & drinks" noun="Item" path="food"
      searchKeys={['name', 'category', 'description']}
      defaults={{ category: 'Snacks', emoji: '🍿', is_veg: true, is_active: true }}
      columns={[
        { label: '', render: (r) => <span className="food-emoji sm">{r.emoji}</span> },
        { label: 'Name', render: (r) => <strong>{r.name}</strong> },
        { label: 'Category', key: 'category' },
        { label: 'Price', render: (r) => money(r.price) },
        { label: 'Type', render: (r) => (r.is_veg ? 'Veg' : 'Non-veg') },
        { label: 'State', render: (r) => <Active on={r.is_active} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, wide: true },
        { name: 'description', label: 'Description', wide: true },
        { name: 'price', label: 'Price (₹)', type: 'number', min: 1, required: true },
        { name: 'category', label: 'Category', type: 'select', options: ['Popcorn', 'Snacks', 'Beverages', 'Combos'] },
        { name: 'emoji', label: 'Emoji icon' },
        { name: 'is_veg', label: 'Diet', type: 'checkbox', checkLabel: 'Vegetarian' },
        { name: 'is_active', label: 'Availability', type: 'checkbox', checkLabel: 'Available to order' },
      ]}
    />
  );
}

export function AdminCoupons() {
  return (
    <CrudPage
      title="Coupons" noun="Coupon" path="coupons"
      searchKeys={['code', 'description']}
      defaults={{ discount_type: 'percent', value: 10, min_amount: 0, one_per_user: false, is_active: true }}
      columns={[
        { label: 'Code', render: (r) => <strong className="mono">{r.code}</strong> },
        { label: 'Description', key: 'description' },
        { label: 'Discount', render: (r) => (r.discount_type === 'percent' ? `${r.value}%${r.max_discount ? ` (max ${money(r.max_discount)})` : ''}` : money(r.value)) },
        { label: 'Min order', render: (r) => money(r.min_amount) },
        { label: 'Valid', render: (r) => (r.valid_from || r.valid_to ? `${r.valid_from ? fmtShort(r.valid_from) : '…'} → ${r.valid_to ? fmtShort(r.valid_to) : '…'}` : 'Always') },
        { label: 'Used', render: (r) => `${r.used_count}${r.usage_limit ? ` / ${r.usage_limit}` : ''}` },
        { label: 'State', render: (r) => <Active on={r.is_active} /> },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true, help: 'Letters, numbers, - and _' },
        { name: 'discount_type', label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percentage (%)' }, { value: 'flat', label: 'Flat amount (₹)' }] },
        { name: 'value', label: 'Value', type: 'number', min: 1, required: true, help: '% or ₹ depending on type' },
        { name: 'max_discount', label: 'Max discount (₹)', type: 'number', nullable: true, min: 1, help: 'Optional cap for % coupons' },
        { name: 'min_amount', label: 'Minimum order (₹)', type: 'number', min: 0 },
        { name: 'usage_limit', label: 'Total usage limit', type: 'number', nullable: true, min: 1, help: 'Leave empty for unlimited' },
        { name: 'valid_from', label: 'Valid from', type: 'date' },
        { name: 'valid_to', label: 'Valid until', type: 'date' },
        { name: 'description', label: 'Description', wide: true },
        { name: 'one_per_user', label: 'Per customer', type: 'checkbox', checkLabel: 'One use per customer' },
        { name: 'is_active', label: 'State', type: 'checkbox', checkLabel: 'Active' },
      ]}
    />
  );
}
