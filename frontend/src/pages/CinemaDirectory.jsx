import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Search, ExternalLink, Clapperboard, Info } from 'lucide-react';
import { api } from '../api';
import { useCity } from '../context/CityContext';

export default function CinemaDirectory() {
  const { city, setCity } = useCity();
  const [cities, setCities] = useState([]);
  const [venues, setVenues] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/cinema-directory/cities').then(setCities).catch(() => setError('Could not load city directory.')); }, []);
  useEffect(() => { setLoading(true); api.get(`/cinema-directory/theatres?city=${encodeURIComponent(city)}`).then(setVenues).catch(() => setVenues([])).finally(() => setLoading(false)); }, [city]);
  const filtered = useMemo(() => venues.filter(v => `${v.name} ${v.address}`.toLowerCase().includes(query.toLowerCase())), [venues, query]);
  const cityInfo = cities.find(c => c.name === city);
  return <div className="page container cinema-directory-page">
    <div className="cinema-directory-hero"><div><span className="eyebrow">CINEBOOK CITY GUIDE</span><h1>Find your cinema.</h1><p>Explore theatres across India's movie-going cities. Choose a city to discover listed venues, then book only CineBook shows that have been scheduled and activated.</p></div><div className="cinema-directory-stat"><Building2 size={25}/><strong>{venues.length}</strong><span>cinemas listed in {city}</span><small>Public listings + CineBook venues</small></div></div>
    <section className="cinema-directory-controls"><label className="field">Select city<select className="input" value={city} onChange={e => setCity(e.target.value)}>{cities.map(c => <option key={c.name} value={c.name}>{c.name} · {c.state}</option>)}</select></label><label className="field cinema-search"><span>Search cinema or area</span><div className="input-icon"><Search size={16}/><input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try PVR, INOX, mall, neighbourhood…"/></div></label></section>
    <div className="section-head"><div><h2>Cinemas in {city}</h2><p className="muted small">{filtered.length} cinema and CineBook venue records available</p></div>{cityInfo?.source_url && <a className="btn btn-ghost btn-sm" href={cityInfo.source_url} target="_blank" rel="noreferrer">View current listings <ExternalLink size={14}/></a>}</div>
    {loading ? <div className="card">Loading cinema directory…</div> : filtered.length ? <div className="cinema-directory-grid">{filtered.map((v,i)=><article className="card cinema-directory-card" key={`${v.city}-${v.name}-${i}`}><div className="cinema-directory-card-icon"><Clapperboard size={20}/></div><div className="cinema-directory-card-top"><span className="badge">{v.city}</span><span className="directory-tag">{v.listing_type || 'Public directory listing'}</span></div><h3>{v.name}</h3><p><MapPin size={14}/>{v.address}</p><div className="cinema-directory-card-foot"><span>{v.state}, India</span>{v.source_url ? <a href={v.source_url} target="_blank" rel="noreferrer">Source <ExternalLink size={12}/></a> : <span>Sample booking venue</span>}</div></article>)}</div> : <div className="card cinema-directory-empty"><Info size={22}/><h3>No cinema records for {city} yet</h3><p>Run the all-city inventory seeder to add sample cinemas and make this city available for project bookings.</p>{cityInfo?.source_url && <a className="btn btn-primary" href={cityInfo.source_url} target="_blank" rel="noreferrer">Browse {city} cinemas <ExternalLink size={14}/></a>}</div>}
    <div className="cinema-directory-note"><Info size={17}/><p><strong>Booking transparency:</strong> Public directory entries are discovery-only. CineBook demo venues and their simulated schedules are project test inventory, with working seat holds, sandbox checkout and QR tickets. They are not official operator schedules or live market prices.</p></div>
    {error && <p className="muted small">{error}</p>}
    <p className="cinema-directory-source">City coverage and cinema counts are based on the CinemaHalls.in India directory; venue names and addresses shown here are transcribed from public BookMyShow cinema listings. Information can change; confirm directly with the cinema before travel.</p>
  </div>;
}
