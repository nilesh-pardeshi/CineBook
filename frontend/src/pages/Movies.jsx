import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, X, Star, ExternalLink, Clapperboard } from 'lucide-react';
import { api, qs } from '../api';
import MovieCard from '../components/MovieCard';
import Poster from '../components/Poster';
import { Empty, ErrorBox, SkeletonGrid } from '../components/Common';

function DiscoveryCard({ movie }) {
  return (
    <article className="discovery-card">
      <a className="discovery-poster" href={movie.source_url} target="_blank" rel="noreferrer" aria-label={`View ${movie.title} on TMDB`}>
        {movie.poster_url ? <img src={movie.poster_url} alt={`${movie.title} poster`} loading="lazy" /> : <div className="discovery-no-poster"><Clapperboard size={28} /></div>}
      </a>
      <div className="discovery-copy">
        <h3>{movie.title}</h3>
        <p className="muted small">{movie.release_date?.slice(0, 4) || 'Release year unknown'} · {movie.language || 'Language unavailable'}</p>
        <p className="discovery-overview">{movie.overview || 'No synopsis available from TMDB.'}</p>
        <div className="discovery-actions">
          {movie.rating > 0 && <span className="muted small"><Star size={13} fill="currentColor" /> {movie.rating}/10</span>}
          <a className="btn btn-ghost btn-sm" href={movie.source_url} target="_blank" rel="noreferrer">Discover <ExternalLink size={13} /></a>
        </div>
        <span className="discovery-only-label">Discovery only · Not yet bookable</span>
      </div>
    </article>
  );
}

export default function Movies() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'now_showing';
  const genre = params.get('genre') || '';
  const language = params.get('language') || '';
  const q = params.get('q') || '';
  const [text, setText] = useState(q);
  const [movies, setMovies] = useState(null);
  const [discovery, setDiscovery] = useState(null);
  const [hindiFeed, setHindiFeed] = useState(null);
  const [meta, setMeta] = useState({ genres: [], languages: [] });
  const [error, setError] = useState('');
  const [discoveryError, setDiscoveryError] = useState('');

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => { api.get('/meta').then(setMeta).catch(() => {}); }, []);
  // Load the India Hindi theatrical feed on the catalogue page as well as the home page.
  useEffect(() => { api.get('/discovery/india/hindi').then(setHindiFeed).catch((e) => setHindiFeed({ error: e.message })); }, []);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (text === q) return undefined;
    const t = setTimeout(() => update({ q: text.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const load = useCallback(async () => {
    setError(''); setDiscoveryError(''); setMovies(null); setDiscovery(null);
    try {
      if (q.trim().length >= 2) {
        const data = await api.get(`/discovery/combined-search${qs({ query: q, language, status, genre })}`);
        setMovies(data.local_results || []);
        setDiscovery(data.tmdb_results || []);
        if (data.tmdb_error) setDiscoveryError(data.tmdb_error);
      } else {
        const data = await api.get(`/movies${qs({ status, genre, language, q })}`);
        setMovies(data); setDiscovery([]);
      }
    } catch (e) { setError(e.message); }
  }, [status, genre, language, q]);

  useEffect(() => { load(); }, [load]);
  const hasFilters = genre || language || q;
  const hasAnyResults = (movies?.length || 0) + (discovery?.length || 0) > 0;

  return (
    <div className="container page">
      <div className="page-head">
        <h1>{status === 'upcoming' ? 'Coming soon' : 'Now showing'}</h1>
        <div className="tabs">
          <button className={status === 'now_showing' ? 'on' : ''} onClick={() => update({ status: '' })}>Now showing</button>
          <button className={status === 'upcoming' ? 'on' : ''} onClick={() => update({ status: 'upcoming' })}>Coming soon</button>
        </div>
      </div>
      <div className="filters">
        <div className="input-icon"><Search size={16} /><input className="input" placeholder="Search CineBook + global movies…" value={text} onChange={(e) => setText(e.target.value)} /></div>
        <select className="input" value={language} onChange={(e) => update({ language: e.target.value })} aria-label="Language">
          <option value="">All languages</option>{meta.languages.map((l) => <option key={l}>{l}</option>)}
          {['Hindi','Marathi','Telugu','Tamil','Kannada','Malayalam','English','Bengali','Gujarati','Punjabi'].filter((l) => !meta.languages.includes(l)).map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className="input" value={genre} onChange={(e) => update({ genre: e.target.value })} aria-label="Genre"><option value="">All genres</option>{meta.genres.map((g) => <option key={g}>{g}</option>)}</select>
        {hasFilters && <button className="btn btn-ghost" onClick={() => setParams(status === 'upcoming' ? { status } : {}, { replace: true })}><X size={15} /> Clear</button>}
      </div>
      {error ? <ErrorBox message={error} onRetry={load} /> : movies === null ? <SkeletonGrid /> : (
        <>
          {movies.length > 0 && <section className="search-section"><div className="search-section-heading"><h2>CineBook catalogue</h2><span>{movies.length} bookable {movies.length === 1 ? 'movie' : 'movies'}</span></div><div className="grid-movies">{movies.map((m) => <MovieCard key={m.id} movie={m} />)}</div></section>}
          {q.trim().length >= 2 && <section className="search-section discovery-section"><div className="search-section-heading"><h2>Discover more movies</h2><span>Powered by TMDB</span></div>
            {discoveryError && <p className="muted small discovery-message">{discoveryError}</p>}
            {discovery?.length > 0 ? <div className="discovery-grid">{discovery.map((m) => <DiscoveryCard key={m.tmdb_id} movie={m} />)}</div> : !discoveryError && <p className="muted">No additional TMDB matches found.</p>}
            <p className="muted small tmdb-attribution">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </section>}
          {!hasAnyResults && <Empty title="No movies found" text="Try another title or clear your filters. Search checks both CineBook and TMDB." />}
        </>
      )}
      {!q.trim() && hindiFeed && !hindiFeed.error && (
        <section className="search-section hindi-discovery-section">
          <div className="search-section-heading"><div><h2>Hindi cinema · Now in theatres</h2><p className="muted small">Indian Hindi-language releases · posters and details from TMDB</p></div><span>Live movie data</span></div>
          {hindiFeed.now_playing?.length ? <div className="hindi-movie-grid">
            {hindiFeed.now_playing.slice(0, 8).map((m) => <article className="hindi-movie-card" key={m.tmdb_id}>
              <a href={m.source_url} target="_blank" rel="noreferrer" className="hindi-poster-link">{m.poster_url ? <img src={m.poster_url} alt={`${m.title} poster`} loading="lazy" /> : <div className="hindi-poster-empty">CineBook</div>}</a>
              <div className="hindi-movie-info"><h3>{m.title}</h3><p className="muted small">Hindi · {m.release_date || 'Release date unavailable'}{m.rating ? ` · TMDB ${m.rating}/10` : ''}</p><p className="hindi-overview">{m.overview}</p>
                {m.bookable ? <Link className="btn btn-primary btn-sm" to={`/movies/${m.cinebook_movie_id}`}>Book tickets</Link> : <span className="hindi-booking-note">Not bookable yet · showtimes not added</span>}
              </div></article>)}
          </div> : <p className="muted small">No Hindi theatrical titles were returned by TMDB right now.</p>}
          {hindiFeed.upcoming?.length > 0 && <><div className="search-section-heading hindi-upcoming-heading"><h2>Upcoming Hindi releases</h2><span>Coming soon</span></div><div className="hindi-upcoming-row">
            {hindiFeed.upcoming.slice(0, 8).map((m) => <article className="hindi-upcoming-card" key={m.tmdb_id}>{m.poster_url ? <img src={m.poster_url} alt={`${m.title} poster`} loading="lazy" /> : <div className="hindi-poster-empty">CineBook</div>}<div><h3>{m.title}</h3><p className="muted small">{m.release_date || 'Release date TBA'}</p><span className="hindi-booking-note">Booking opens after CineBook showtimes are scheduled</span></div></article>)}
          </div></>}
          <p className="tmdb-attribution">Movie metadata and poster images provided by TMDB. {hindiFeed.attribution}</p>
        </section>
      )}
      {hindiFeed?.error && !q.trim() && <p className="muted small">Hindi movie feed unavailable: {hindiFeed.error}. Check TMDB configuration in the backend.</p>}
    </div>
  );
}
