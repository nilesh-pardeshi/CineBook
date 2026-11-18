import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Clock, MapPin, Play, Star, ChevronRight, Heart, Bookmark, ExternalLink, Film, Users, Image as ImageIcon, MessageSquare, Globe2 } from 'lucide-react';
import { api } from '../api';
import Poster from '../components/Poster';
import TrailerModal from '../components/TrailerModal';
import { Empty, ErrorBox, Spinner } from '../components/Common';
import { useCity } from '../context/CityContext';
import { dayParts, duration, fmtDateLong, fmtShort, fmtTime, genreList, hueOf, money } from '../utils';

const STATE_LABEL = { available: 'Available', filling_fast: 'Filling fast', sold_out: 'Sold out' };
const normalize = (value = '') => value.toLocaleLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fmtMoney = (value) => value ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : '—';

export default function MovieDetail() {
  const { id } = useParams();
  const { city, cities, setCity } = useCity();
  const [movie, setMovie] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [data, setData] = useState(null);
  const [loadingShows, setLoadingShows] = useState(false);
  const [showsError, setShowsError] = useState('');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [saved, setSaved] = useState(false);

  const loadMovie = useCallback(() => {
    setError(''); setMetadata(null);
    api.get(`/movies/${id}`).then(setMovie).catch((e) => setError(e.message));
  }, [id]);
  useEffect(loadMovie, [loadMovie]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    const load = async () => {
      try {
        const langMap = { Hindi: 'hi-IN', Marathi: 'mr-IN', Telugu: 'te-IN', Tamil: 'ta-IN', Kannada: 'kn-IN', Malayalam: 'ml-IN', English: 'en-US' };
        const language = langMap[movie.language] || 'en-US';
        const result = await api.get(`/discovery/search?query=${encodeURIComponent(movie.title)}&language=${language}`);
        const target = normalize(movie.title);
        const match = (result.results || []).find((item) => normalize(item.title) === target || normalize(item.original_title) === target);
        if (!match?.tmdb_id) return;
        const details = await api.get(`/discovery/movie/${match.tmdb_id}?language=${language}`);
        if (!cancelled) setMetadata(details);
      } catch {
        // Optional TMDB enrichment must never interrupt CineBook's local movie and booking experience.
      }
    };
    load();
    return () => { cancelled = true; };
  }, [movie]);

  useEffect(() => { setSelectedDate(null); setData(null); setShowsError(''); }, [city, id]);
  useEffect(() => {
    if (!movie) return;
    setLoadingShows(true); setShowsError('');
    const d = selectedDate ? `&date=${selectedDate}` : '';
    api.get(`/movies/${id}/shows?city=${encodeURIComponent(city)}${d}`).then(setData).catch((e) => setShowsError(e.message)).finally(() => setLoadingShows(false));
  }, [movie, city, selectedDate, id]);



  const displayMovie = useMemo(() => movie ? ({ ...movie,
    poster_url: movie.poster_url || metadata?.poster_url,
    backdrop_url: movie.backdrop_url || metadata?.backdrop_url,
    trailer_url: movie.trailer_url || metadata?.trailer_url,
  }) : null, [movie, metadata]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={loadMovie} /></div>;
  if (!movie) return <Spinner />;

  const style = { '--h': hueOf(movie.title) };
  const backdrop = displayMovie.backdrop_url;
  if (backdrop) style['--backdrop'] = `url(${backdrop})`;
  const upcoming = movie.status === 'upcoming';
  const trailer = metadata?.videos?.find((v) => v.type === 'Trailer' && v.official) || metadata?.videos?.find((v) => v.type === 'Trailer') || metadata?.videos?.[0];
  const heroMovie = { ...displayMovie, trailer_url: displayMovie.trailer_url || trailer?.url };
  const cast = metadata?.cast || [];
  const crew = metadata?.crew || [];
  const videos = metadata?.videos || [];
  const backdrops = metadata?.backdrops || [];
  const posters = metadata?.posters || [];
  const reviews = metadata?.reviews || [];
  const hasCredits = cast.length > 0 || crew.length > 0;
  const hasMedia = videos.length > 0 || backdrops.length > 0 || posters.length > 0;
  const hasReviews = reviews.length > 0;
  const facts = [
    ['Original title', metadata?.original_title],
    ['Original language', metadata?.language || movie.language],
    ['Release date', movie.release_date ? fmtDateLong(movie.release_date) : null],
    ['Runtime', movie.duration_min ? duration(movie.duration_min) : null],
    ['Certification', movie.certificate],
    ['Production status', metadata?.status],
    ['Keywords', metadata?.keywords?.length ? metadata.keywords.join(', ') : null],
    ['Production companies', metadata?.production_companies?.length ? metadata.production_companies.map((x) => x.name).join(', ') : null],
  ].filter(([, value]) => value && value !== '—');

  return (
    <>
      <section className={`cine-detail-hero ${backdrop ? 'has-image' : ''}`} style={style}>
        <div className="cine-detail-shade" />
        <div className="container cine-detail-layout">
          <div className="cine-detail-poster"><Poster movie={displayMovie} /></div>
          <div className="cine-detail-main">
            <div className="cine-detail-kicker"><span className="badge">{movie.certificate}</span><span>{movie.language}</span>{movie.release_date && <span>{new Date(`${movie.release_date}T00:00:00`).getFullYear()}</span>}</div>
            <h1>{movie.title} <span>({movie.release_date ? new Date(`${movie.release_date}T00:00:00`).getFullYear() : '—'})</span></h1>
            <div className="cine-detail-meta">{movie.release_date && <span><Calendar size={15}/>{fmtShort(movie.release_date)}</span>}<span><Clock size={15}/>{duration(movie.duration_min)}</span><span>{genreList(movie.genres).join(', ') || 'Feature film'}</span></div>
            <div className="cine-detail-actions">
              {movie.rating > 0 && <div className="cine-score"><strong>{Number(movie.rating).toFixed(1)}</strong><span> / 10<br/>CineBook score</span></div>}
              <button className="btn btn-ghost" type="button" onClick={() => setTrailerOpen(true)}><Play size={16}/> Play trailer</button>
              <button className={`btn btn-ghost ${saved ? 'is-saved' : ''}`} type="button" onClick={() => setSaved((v) => !v)} aria-pressed={saved}>{saved ? <Heart size={16} fill="currentColor"/> : <Bookmark size={16}/>} {saved ? 'Saved' : 'Watchlist'}</button>
              {metadata?.source_url && <a className="btn btn-ghost" href={metadata.source_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> TMDB</a>}
            </div>
            {metadata?.tagline && <p className="cine-tagline">{metadata.tagline}</p>}
            <h2>Overview</h2><p className="cine-overview">{movie.description || metadata?.description || 'Synopsis not available.'}</p>
            <div className="cine-crew-line">{(crew.filter((x) => ['Director','Screenplay','Writer'].includes(x.job)).slice(0,4)).map((person) => <div key={`${person.id}-${person.job}`}><strong>{person.name}</strong><span>{person.job}</span></div>)}{!crew.length && movie.director && <div><strong>{movie.director}</strong><span>Director</span></div>}</div>
          </div>
        </div>
      </section>

      <div className="container cine-detail-tabs" role="tablist" aria-label="Movie information">
        {[['overview','Overview'], ...(hasCredits ? [['cast','Cast & Crew']] : []), ...(hasMedia ? [['media','Media']] : []), ...(hasReviews ? [['reviews','Reviews']] : []), ...(facts.length ? [['details','Details']] : [])].map(([key,label]) => <button key={key} role="tab" aria-selected={activeTab===key} className={activeTab===key?'active':''} onClick={() => setActiveTab(key)}>{label}</button>)}
      </div>
      {activeTab === 'overview' && (hasCredits || movie.cast_members) && <section className="container cine-content-section"><div className="cine-section-heading"><h2><Users size={19}/> {cast.length ? 'Top billed cast' : 'Featuring'}</h2><span>{cast.length ? `${cast.length} people` : 'CineBook catalogue'}</span></div>{cast.length > 0 ? <div className="cine-cast-row">{cast.slice(0,12).map((person) => <article className="cine-cast-card" key={person.id}><div className="cine-person-photo">{person.profile_url ? <img src={person.profile_url} alt={person.name} loading="lazy"/> : <Users/>}</div><strong>{person.name}</strong><span>{person.character || 'Cast'}</span></article>)}</div> : <div className="cine-local-cast">{String(movie.cast_members).split(',').map((name) => name.trim()).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div>}</section>}
      {activeTab === 'cast' && hasCredits && <section className="container cine-content-section"><div className="cine-section-heading"><h2><Users size={19}/> Cast & crew</h2><span>{cast.length + crew.length} credits</span></div><div className="cine-credit-grid">{[...cast.map((x)=>({...x,job:x.character || 'Cast'})),...crew].map((person,index)=><article className="cine-credit-card" key={`${person.id}-${person.job}-${index}`}><div className="cine-person-photo">{person.profile_url?<img src={person.profile_url} alt={person.name} loading="lazy"/>:<Users/>}</div><div><strong>{person.name}</strong><span>{person.job}</span></div></article>)}</div></section>}
      {activeTab === 'media' && hasMedia && <section className="container cine-content-section"><div className="cine-section-heading"><h2><ImageIcon size={19}/> Media</h2><span>{backdrops.length + posters.length} images · {videos.length} videos</span></div>{videos.length > 0 && <div className="cine-video-list">{videos.map((v)=><a key={v.id} href={v.url || metadata.source_url} target="_blank" rel="noreferrer"><Play size={16}/><span><strong>{v.name || v.type}</strong><small>{v.site} · {v.type}</small></span><ExternalLink size={14}/></a>)}</div>}<div className="cine-gallery">{[...backdrops,...posters].map((src,index)=><a href={src} target="_blank" rel="noreferrer" key={`${src}-${index}`}><img src={src} loading="lazy" alt={`${movie.title} media ${index+1}`}/></a>)}</div></section>}
      {activeTab === 'reviews' && hasReviews && <section className="container cine-content-section"><div className="cine-section-heading"><h2><MessageSquare size={19}/> Reviews</h2><span>{reviews.length} TMDB reviews</span></div><div className="cine-reviews">{reviews.map((review)=><article key={review.id}><div><strong>{review.author}</strong><span>{review.rating ? `${review.rating}/10` : 'Community review'}</span></div><p>{review.content}</p>{review.url && <a href={review.url} target="_blank" rel="noreferrer">Read original review <ExternalLink size={13}/></a>}</article>)}</div></section>}
      {activeTab === 'details' && facts.length > 0 && <section className="container cine-content-section"><div className="cine-section-heading"><h2><Film size={19}/> Movie facts</h2></div><div className="cine-facts-grid">{facts.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>}

      <section className="container section" id="showtimes">
        <>
            <div className="section-head">
              <div><h2>Select showtime</h2>{upcoming && <p className="muted small">CineBook demo screenings are available for project testing; the movie's listed release date remains unchanged.</p>}</div>
              <div className="city-pill">
                <MapPin size={15} />
                <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {showsError ? (
              <ErrorBox message={showsError} onRetry={() => setSelectedDate(selectedDate)} />
            ) : !data ? (
              <Spinner label="Finding showtimes…" />
            ) : data.dates.length === 0 ? (
              <Empty title={`No scheduled shows in ${city}`} text="Choose another city or ask the cinema administrator to publish showtimes for this movie." />
            ) : (
              <>
                <div className="date-strip" role="tablist">
                  {data.dates.map((d) => {
                    const p = dayParts(d);
                    return (
                      <button key={d} role="tab" aria-selected={d === data.date} className={`date-btn ${d === data.date ? 'on' : ''}`} onClick={() => setSelectedDate(d)}>
                        <span>{p.weekday}</span>
                        <strong>{p.day}</strong>
                        <span>{p.month}</span>
                      </button>
                    );
                  })}
                </div>

                <div className={`theatre-list ${loadingShows ? 'dim' : ''}`}>
                  {data.theatres.length === 0 && <p className="muted">No shows on this date.</p>}
                  {data.theatres.map((t) => (
                    <div className="theatre-row" key={t.id}>
                      <div className="theatre-info">
                        <h4>{t.name}</h4>
                        <p className="muted small">{t.address}</p>
                        {t.amenities && <p className="amenities small">{t.amenities}</p>}
                        <Link className="cinema-detail-link" to={`/cinemas/${t.id}`}>Cinema details <ChevronRight size={14} /></Link>
                      </div>
                      <div className="show-chips">
                        {t.shows.map((s) =>
                          s.state === 'sold_out' ? (
                            <div key={s.id} className="show-chip sold_out" title="Sold out">
                              <strong>{fmtTime(s.start_time)}</strong>
                              <span>{s.screen_type} · {s.format}</span>
                              <em>Sold out</em>
                            </div>
                          ) : (
                            <Link key={s.id} to={`/shows/${s.id}/seats`} className={`show-chip ${s.state}`} title={`${STATE_LABEL[s.state]} • ${s.available} seats left`}>
                              <strong>{fmtTime(s.start_time)}</strong>
                              <span>{s.screen_type} · {s.format}</span>
                              <em>from {money(s.price_from)}</em>
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="legend">
                  <span><i className="dot available" /> Available</span>
                  <span><i className="dot filling_fast" /> Filling fast</span>
                  <span><i className="dot sold_out" /> Sold out</span>
                </div>
              </>
            )}
          </>
      </section>
      {trailerOpen && <TrailerModal movie={heroMovie} onClose={() => setTrailerOpen(false)} />}
    </>
  );
}
