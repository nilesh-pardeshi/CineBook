import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Sparkles, RefreshCw, Users, IndianRupee, Accessibility, Armchair, Info } from 'lucide-react';
import { api } from '../api';
import { ErrorBox, Spinner } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { CATEGORY_LABEL, fmtDateTime, money } from '../utils';

export default function SeatSelection() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { toast } = useUI();
  const [show, setShow] = useState(null);
  const [sel, setSel] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiData, setAiData] = useState(null);
  const [selectedRec, setSelectedRec] = useState(0);
  const [crowd, setCrowd] = useState(null);
  const [crowdError, setCrowdError] = useState('');
  const [preferences, setPreferences] = useState({ group_size: 2, max_budget_per_seat: '300', preferred_tier: '', prefer_aisle: false, accessibility_required: false });

  const load = useCallback(async (silent = false) => {
    try {
      const d = await api.get(`/shows/${id}`);
      setShow(d);
      const free = new Set(d.rows.flatMap((r) => r.seats.filter((s) => s.status === 'available').map((s) => s.label)));
      setSel((cur) => {
        const kept = cur.filter((l) => free.has(l));
        if (kept.length !== cur.length) toast.error('Some of your selected seats were just taken.');
        return kept;
      });
    } catch (e) {
      if (!silent) setError(e.message);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    let alive = true;
    api.get(`/ai/shows/${id}/crowd`).then((data) => { if (alive) setCrowd(data); }).catch((e) => { if (alive) setCrowdError(e.message); });
    return () => { alive = false; };
  }, [id]);

  const info = useMemo(() => {
    const m = {};
    show?.rows.forEach((r) => r.seats.forEach((s) => (m[s.label] = { category: r.category, price: r.price, status: s.status })));
    return m;
  }, [show]);

  const recommendedSeats = useMemo(() => new Set(aiData?.recommendations?.[selectedRec]?.seats || []), [aiData, selectedRec]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={() => { setError(''); load(); }} /></div>;
  if (!show) return <Spinner label="Loading seat map…" />;

  const total = sel.reduce((sum, l) => sum + (info[l]?.price || 0), 0);
  const cols = show.rows[0]?.seats.length || 0;
  const aisle = cols >= 8 ? Math.floor(cols / 2) : -1;
  const maxSelectable = Math.min(show.max_seats || 8, 8);

  const toggle = (seat) => {
    if (seat.status !== 'available' || show.is_past) return;
    setSel((cur) => {
      if (cur.includes(seat.label)) return cur.filter((l) => l !== seat.label);
      if (cur.length >= maxSelectable) {
        toast.error(`You can select up to ${maxSelectable} seats.`);
        return cur;
      }
      return [...cur, seat.label];
    });
  };

  const getRecommendations = async (event) => {
    event.preventDefault();
    setAiBusy(true);
    setAiError('');
    setAiData(null);
    try {
      const result = await api.post('/ai/seat-recommendations', {
        show_id: Number(id),
        group_size: Number(preferences.group_size),
        max_budget_per_seat: preferences.max_budget_per_seat === '' ? null : Number(preferences.max_budget_per_seat),
        preferred_tier: preferences.preferred_tier || null,
        prefer_aisle: preferences.prefer_aisle,
        accessibility_required: preferences.accessibility_required,
      });
      setAiData(result);
      setSelectedRec(0);
      if (!result.recommendations?.length) toast.info('No seat cluster matches every preference. Try adjusting your filters.');
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const applyRecommendation = (recommendation) => {
    const available = recommendation.seats.every((label) => info[label]?.status === 'available');
    if (!available) {
      toast.error('Seat availability changed. Refresh the seat map and request a new recommendation.');
      load(true);
      return;
    }
    setSel(recommendation.seats);
    toast.success(`Selected AI recommended seats: ${recommendation.seats.join(', ')}`);
  };

  const proceed = async () => {
    if (!user) {
      toast.info('Please log in to continue with your booking.');
      nav('/login', { state: { from: loc.pathname } });
      return;
    }
    if (!sel.length) return;
    setBusy(true);
    try {
      const b = await api.post('/bookings', { show_id: show.id, seats: sel });
      nav(`/checkout/${b.ref}`);
    } catch (e) {
      toast.error(e.message);
      setSel([]);
      load(true);
    } finally {
      setBusy(false);
    }
  };

  let lastCat = null;
  return (
    <div className="seat-page">
      <div className="container">
        <div className="seat-head">
          <Link to={`/movies/${show.movie.id}`} className="back-link"><ArrowLeft size={16} /> Back</Link>
          <div>
            <h1>{show.movie.title}</h1>
            <p className="muted">
              <span><MapPin size={14} /> {show.theatre.name}, {show.theatre.city}</span>
              <span><Clock size={14} /> {fmtDateTime(show.start_time)}</span>
              <span>{show.screen.name} · {show.screen.type}</span>
              {show.format && <span className="format-inline">{show.format}</span>}
            </p>
          </div>
        </div>

        {show.is_past && <div className="notice notice-warn">This show has already started, so seats can't be booked.</div>}

        <section className="ai-booking-grid">
          <div className="ai-seat-panel">
            <div className="ai-panel-heading"><div className="ai-icon"><Sparkles size={19} /></div><div><span className="eyebrow">CINEBOOK INTELLIGENCE</span><h2>AI Smart Seat Recommender</h2><p className="muted small">Find a contiguous group with a balanced view and price.</p></div></div>
            <form className="ai-preference-form" onSubmit={getRecommendations}>
              <label><span><Users size={14} /> Group size</span><select className="input" value={preferences.group_size} onChange={(e) => setPreferences((p) => ({ ...p, group_size: e.target.value }))}><option value="1">1 person</option>{Array.from({ length: Math.min(7, maxSelectable - 1) }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} people</option>)}</select></label>
              <label><span><IndianRupee size={14} /> Max per seat</span><input className="input" type="number" min="0" max="100000" placeholder="No limit" value={preferences.max_budget_per_seat} onChange={(e) => setPreferences((p) => ({ ...p, max_budget_per_seat: e.target.value }))} /></label>
              <label><span><Armchair size={14} /> Seat tier</span><select className="input" value={preferences.preferred_tier} onChange={(e) => setPreferences((p) => ({ ...p, preferred_tier: e.target.value }))}><option value="">Any tier</option><option value="regular">Classic</option><option value="premium">Prime</option><option value="recliner">Recliner</option></select></label>
              <div className="ai-checks"><label><input type="checkbox" checked={preferences.prefer_aisle} onChange={(e) => setPreferences((p) => ({ ...p, prefer_aisle: e.target.checked }))} /> Prefer aisle</label><label><input type="checkbox" checked={preferences.accessibility_required} onChange={(e) => setPreferences((p) => ({ ...p, accessibility_required: e.target.checked }))} /> <Accessibility size={14} /> Accessible seat</label></div>
              <button className="btn btn-primary" type="submit" disabled={aiBusy || show.is_past}><Sparkles size={16} /> {aiBusy ? 'Finding best seats…' : 'Find my best seats'}</button>
            </form>
            {aiError && <div className="ai-inline-error" role="alert">{aiError}</div>}
            {aiData && <div className="ai-results" aria-live="polite">
              <div className="ai-result-intro"><strong>{aiData.recommendations.length ? `${aiData.recommendations.length} ranked option${aiData.recommendations.length > 1 ? 's' : ''}` : 'No matching cluster'}</strong><span className="muted small">{aiData.algorithm || 'weighted_geometry_v1'}</span></div>
              {aiData.recommendations.map((rec, index) => <article className={`ai-rec-card ${selectedRec === index ? 'active' : ''}`} key={`${rec.seats.join('-')}-${rec.tier}`}>
                <button type="button" className="ai-rec-select" onClick={() => setSelectedRec(index)} aria-pressed={selectedRec === index}>
                  <span className="ai-rec-seatnames">{rec.seats.join(' · ')}</span><span className="ai-rec-score">{rec.score}/100</span>
                </button>
                <div className="ai-rec-meta"><span>{CATEGORY_LABEL[rec.tier] || rec.tier}</span><strong>{money(rec.total_price)}</strong><span>{money(rec.price_per_seat)} / seat</span></div>
                <ul>{rec.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => applyRecommendation(rec)}>Select these seats</button>
              </article>)}
              <p className="ai-explanation"><Info size={14} /> {aiData.explanation}</p>
            </div>}
          </div>

          <aside className="crowd-panel">
            <div className="ai-panel-heading"><div className="ai-icon crowd"><RefreshCw size={18} /></div><div><span className="eyebrow">SHOW INTELLIGENCE</span><h3>Predicted crowd</h3></div></div>
            {crowd ? <>
              <div className="crowd-number"><strong>{Math.round(crowd.expected_fill_rate)}%</strong><span>expected occupancy</span></div>
              <div className="crowd-meter"><span style={{ width: `${Math.min(100, Math.max(0, crowd.expected_fill_rate))}%` }} /></div>
              <div className="crowd-status-row"><span className={`rush-pill rush-${crowd.rush_level.toLowerCase().replace(' ', '-')}`}>{crowd.rush_level} rush</span><span className="muted small">Now {crowd.current_fill_rate}% filled</span></div>
              <ul className="signal-list">{crowd.signals.slice(0, 3).map((signal) => <li key={signal}>{signal}</li>)}</ul>
              <p className="muted tiny">{crowd.model_type} · {crowd.limitation}</p>
            </> : crowdError ? <p className="muted small">Crowd insights unavailable: {crowdError}</p> : <div className="crowd-loading"><span className="spinner" /><span className="muted small">Calculating show insights…</span></div>}
          </aside>
        </section>

        <div className="seat-card">
          <div className="legend legend-seats">
            <span><i className="seat-dot" /> Available</span><span><i className="seat-dot selected" /> Selected</span><span><i className="seat-dot held" /> Held</span><span><i className="seat-dot booked" /> Sold</span><span><i className="seat-dot recommended" /> AI recommended</span>
          </div>
          <p className="seat-hint muted small">Swipe sideways to see all seats</p>
          <div className="seat-scroll"><div className="seat-map" style={{ '--cols': cols }}>
            <div className="screen-wrap"><div className="screen" /><span>All eyes this way, SCREEN</span></div>
            {show.rows.map((row) => {
              const header = row.category !== lastCat;
              lastCat = row.category;
              return <div key={row.row}>
                {header && <div className={`cat-head cat-${row.category}`}>{CATEGORY_LABEL[row.category]} · {money(row.price)}</div>}
                <div className="seat-row"><span className="row-label">{row.row}</span><div className="seats">
                  {row.seats.map((s) => <span key={s.label} className="seat-cell"><button type="button" className={`seat cat-${row.category} ${s.status} ${sel.includes(s.label) ? 'selected' : ''} ${recommendedSeats.has(s.label) && s.status === 'available' ? 'ai-recommended' : ''}`} disabled={s.status !== 'available' || show.is_past} onClick={() => toggle(s)} aria-label={`Seat ${s.label}, ${CATEGORY_LABEL[row.category]}, ${money(row.price)}, ${s.status}${recommendedSeats.has(s.label) ? ', AI recommended' : ''}`} aria-pressed={sel.includes(s.label)} title={recommendedSeats.has(s.label) ? 'AI recommended seat' : s.label}>{s.number}</button>{s.number === aisle && <span className="aisle" />}</span>)}
                </div><span className="row-label">{row.row}</span></div>
              </div>;
            })}
          </div></div>
        </div>
      </div>

      <div className="book-bar"><div className="container book-bar-inner"><div>{sel.length ? <><strong>{sel.length} seat{sel.length > 1 ? 's' : ''}</strong><span className="muted"> · {sel.join(', ')}</span></> : <span className="muted">Select up to {maxSelectable} seats</span>}</div><button className="btn btn-primary btn-lg" disabled={!sel.length || busy || show.is_past} onClick={proceed}>{busy ? 'Holding seats…' : sel.length ? `Pay ${money(total)}` : 'Select seats'}</button></div></div>
    </div>
  );
}
