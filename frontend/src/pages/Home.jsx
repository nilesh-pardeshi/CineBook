import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, BadgePercent, Check, Copy, Popcorn, Star, Ticket } from 'lucide-react';
import { api } from '../api';
import MovieCard from '../components/MovieCard';
import Poster from '../components/Poster';
import { ErrorBox, SkeletonGrid } from '../components/Common';
import { useUI } from '../context/UIContext';
import { duration, fmtShort, genreList, hueOf, money } from '../utils';

function Hero({ movies }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (movies.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % movies.length), 6500);
    return () => clearInterval(t);
  }, [movies.length]);
  const m = movies[i];
  if (!m) return null;
  const style = { '--h': hueOf(m.title) };
  if (m.backdrop_url) style['--backdrop'] = `url(${m.backdrop_url})`;
  return (
    <section className={`hero ${m.backdrop_url ? 'has-backdrop' : ''}`} style={style}>
      <div className="container hero-inner">
        <div className="hero-text" key={m.id}>
          <div className="chips">
            <span className="badge">{m.certificate}</span>
            <span className="badge">{m.language}</span>
            {genreList(m.genres).map((g) => (
              <span className="badge badge-soft" key={g}>
                {g}
              </span>
            ))}
          </div>
          <h1>{m.title}</h1>
          <p className="hero-desc">{m.description.length > 190 ? m.description.slice(0, 187) + '…' : m.description}</p>
          <div className="hero-meta">
            <span>
              <Star size={15} fill="currentColor" /> {m.rating.toFixed(1)}/10
            </span>
            <span>{duration(m.duration_min)}</span>
          </div>
          <div className="row gap">
            <Link className="btn btn-primary btn-lg" to={`/movies/${m.id}`}>
              <Ticket size={18} /> Book tickets
            </Link>
            <Link className="btn btn-ghost btn-lg" to={`/movies/${m.id}`}>
              Details
            </Link>
          </div>
        </div>
        <div className="hero-poster" key={`p${m.id}`}>
          <Poster movie={m} />
        </div>
      </div>
      {movies.length > 1 && (
        <div className="hero-dots">
          {movies.map((mv, k) => (
            <button key={mv.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Show ${mv.title}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function Offer({ c }) {
  const { toast } = useUI();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.info(`Use code ${c.code} at checkout`);
    }
  };
  return (
    <div className="offer">
      <BadgePercent size={22} />
      <div className="offer-body">
        <strong>{c.discount_type === 'percent' ? `${c.value}% OFF` : `${money(c.value)} OFF`}</strong>
        <p>{c.description}</p>
      </div>
      <button className="code-btn" onClick={copy} aria-label={`Copy code ${c.code}`}>
        {c.code} {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function Home() {
  const [movies, setMovies] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [hindiFeed, setHindiFeed] = useState(null);
  const [lang, setLang] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api.get('/movies?status=now_showing'), api.get('/movies?status=upcoming'), api.get('/coupons'), api.get('/meta')])
      .then(([now, soon, cps, meta]) => {
        setMovies(now);
        setUpcoming(soon);
        setCoupons(cps);
        setLanguages(meta.languages);
        api.get('/discovery/india/hindi').then(setHindiFeed).catch(() => setHindiFeed({ error: true }));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={load} /></div>;

  const featured = movies ? movies.filter((m) => m.is_featured) : [];
  const hero = featured.length ? featured : (movies || []).slice(0, 3);
  const shown = movies ? movies.filter((m) => !lang || m.language === lang) : [];

  return (
    <>
      {movies ? <Hero movies={hero} /> : <div className="hero hero-skeleton skeleton" />}

      <section className="container section">
        <div className="section-head">
          <h2>Now showing</h2>
          <Link to="/movies" className="link">
            See all →
          </Link>
        </div>
        <div className="chips scroll-x">
          <button className={`chip ${lang === '' ? 'on' : ''}`} onClick={() => setLang('')}>
            All languages
          </button>
          {languages.map((l) => (
            <button key={l} className={`chip ${lang === l ? 'on' : ''}`} onClick={() => setLang(l)}>
              {l}
            </button>
          ))}
        </div>
        {!movies ? (
          <SkeletonGrid />
        ) : shown.length ? (
          <div className="grid-movies">
            {shown.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        ) : (
          <p className="muted">No movies in this language right now.</p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Coming soon</h2>
            <Link to="/movies?status=upcoming" className="link">
              See all →
            </Link>
          </div>
          <div className="upcoming-row">
            {upcoming.map((m) => (
              <Link to={`/movies/${m.id}`} className="upcoming-card" key={m.id}>
                <Poster movie={m} />
                <div>
                  <h4>{m.title}</h4>
                  <p className="muted small">
                    {m.language} • {genreList(m.genres)[0]}
                  </p>
                  {m.release_date && <span className="badge">Releases {fmtShort(m.release_date)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hindiFeed && !hindiFeed.error && (
        <section className="container section hindi-discovery-section">
          <div className="section-head">
            <div>
              <h2>Hindi cinema · Now in theatres</h2>
              <p className="muted small">Indian Hindi-language releases, with posters and details from TMDB</p>
            </div>
            <span className="badge">Live catalogue</span>
          </div>
          {hindiFeed.now_playing?.length ? (
            <div className="hindi-movie-grid">
              {hindiFeed.now_playing.slice(0, 8).map((m) => (
                <article className="hindi-movie-card" key={m.tmdb_id}>
                  <a href={m.source_url} target="_blank" rel="noreferrer" className="hindi-poster-link">
                    {m.poster_url ? <img src={m.poster_url} alt={`${m.title} poster`} loading="lazy" /> : <div className="hindi-poster-empty">CineBook</div>}
                  </a>
                  <div className="hindi-movie-info">
                    <h3>{m.title}</h3>
                    <p className="muted small">Hindi · {m.release_date || 'Release date unavailable'}{m.rating ? ` · TMDB ${m.rating}/10` : ''}</p>
                    <p className="hindi-overview">{m.overview}</p>
                    {m.bookable ? <Link className="btn btn-primary btn-sm" to={`/movies/${m.cinebook_movie_id}`}>Book tickets</Link> : <span className="hindi-booking-note">Not bookable yet · showtimes not added</span>}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="muted small">No Hindi theatrical titles were returned by the movie data provider right now.</p>}
          {hindiFeed.upcoming?.length > 0 && (
            <>
              <div className="section-head hindi-upcoming-heading"><h2>Upcoming Hindi releases</h2></div>
              <div className="hindi-upcoming-row">
                {hindiFeed.upcoming.slice(0, 8).map((m) => (
                  <article className="hindi-upcoming-card" key={m.tmdb_id}>
                    {m.poster_url ? <img src={m.poster_url} alt={`${m.title} poster`} loading="lazy" /> : <div className="hindi-poster-empty">CineBook</div>}
                    <div><h3>{m.title}</h3><p className="muted small">{m.release_date || 'Release date TBA'}</p><span className="hindi-booking-note">Coming soon · booking opens after showtimes are scheduled</span></div>
                  </article>
                ))}
              </div>
            </>
          )}
          <p className="tmdb-attribution">Movie metadata and poster images provided by TMDB. {hindiFeed.attribution}</p>
        </section>
      )}

      {coupons.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Offers for you</h2>
          </div>
          <div className="offers">
            {coupons.slice(0, 4).map((c) => (
              <Offer key={c.code} c={c} />
            ))}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="features">
          <div>
            <Armchair size={26} />
            <h4>Pick your exact seat</h4>
            <p className="muted small">Live seat maps with instant holds, no double bookings.</p>
          </div>
          <div>
            <Popcorn size={26} />
            <h4>Pre-order snacks</h4>
            <p className="muted small">Add popcorn and combos to your booking and skip the queue.</p>
          </div>
          <div>
            <BadgePercent size={26} />
            <h4>Great offers</h4>
            <p className="muted small">Apply coupons at checkout for instant savings.</p>
          </div>
          <div>
            <Ticket size={26} />
            <h4>Digital tickets</h4>
            <p className="muted small">Show the QR code at the entrance. No printing needed.</p>
          </div>
        </div>
      </section>
    </>
  );
}
