import { useState } from 'react';
import { Bot, X, Send, Sparkles, MapPin, Popcorn, Ticket, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const QUICK = ["Marathi movies in Pune under ₹500 for 2", "Tamil movie in Bengaluru", "Suggest an affordable show tonight"];
export default function AiConcierge() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const ask = async (value = prompt) => {
    const clean = value.trim(); if (clean.length < 2 || loading) return;
    setPrompt(clean); setLoading(true); setError('');
    try { setResult(await api.post('/assistant/concierge', { prompt: clean, group_size: 2 })); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div className="ai-concierge-root">
      {open && <section className="ai-concierge-panel" aria-label="CineBook AI concierge">
        <header className="ai-concierge-head"><span className="ai-concierge-icon"><Bot size={19}/></span><div><strong>CineBook Concierge</strong><small>Movie and snack finder</small></div><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18}/></button></header>
        <div className="ai-concierge-body">
          <p className="ai-concierge-intro">Tell me your city, preferred language and budget. I’ll look through actual upcoming CineBook shows.</p>
          <div className="ai-quick-prompts">{QUICK.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
          {loading && <p className="ai-state"><Loader2 className="spin-icon" size={16}/> Finding matching shows…</p>}
          {error && <p className="ai-error">{error}</p>}
          {result && <div className="ai-results">
            <p className="ai-result-message">{result.message}</p>
            {result.detected_preferences && <div className="ai-detected">{result.detected_preferences.city && <span><MapPin size={12}/> {result.detected_preferences.city}</span>}{result.detected_preferences.language && <span>{result.detected_preferences.language}</span>}{result.detected_preferences.budget != null && <span>₹{result.detected_preferences.budget}</span>}</div>}
            {result.shows?.map((show) => <article className="ai-show-card" key={show.show_id}>
              {show.poster_url && <img src={show.poster_url} alt=""/>}<div className="ai-show-copy"><strong>{show.movie_title}</strong><small>{show.language} · {show.format} · {show.city}</small><small>{show.theatre} · {new Date(show.start_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small><b>From ₹{show.starting_price}</b><Link className="btn btn-primary btn-sm" to={show.booking_path} onClick={() => setOpen(false)}><Ticket size={13}/> Choose seats</Link></div>
            </article>)}
            {result.shows?.length === 0 && <p className="muted small">No matching shows. Try another city, language or budget.</p>}
            {result.snacks?.length > 0 && <div className="ai-snack-list"><strong><Popcorn size={14}/> Snack ideas</strong><div>{result.snacks.slice(0,4).map((f) => <span key={f.id}>{f.emoji} {f.name} · ₹{f.price}</span>)}</div></div>}
            <small className="ai-disclaimer">{result.limitations}</small>
          </div>}
        </div>
        <form className="ai-concierge-input" onSubmit={(e) => { e.preventDefault(); ask(); }}><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Hindi movie in Pune under ₹600"/><button className="btn btn-primary" disabled={loading || prompt.trim().length < 2} aria-label="Send prompt"><Send size={16}/></button></form>
      </section>}
      <button className="ai-concierge-launch" onClick={() => setOpen((v) => !v)} aria-expanded={open}><Sparkles size={18}/><span>AI Concierge</span></button>
    </div>
  );
}
