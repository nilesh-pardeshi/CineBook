import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Armchair, AudioLines, CarFront, MapPin, MonitorPlay, Projector, ScreenShare, Ticket, Accessibility, Utensils } from 'lucide-react';
import { api } from '../api';
import Poster from '../components/Poster';
import { Empty, ErrorBox, Spinner } from '../components/Common';
import { fmtDateTime, money } from '../utils';

const FACILITY_ICONS = {
  parking: CarFront,
  food: Utensils,
  wheelchair: Accessibility,
  accessibility: Accessibility,
  default: Ticket,
};

function amenityIcon(value) {
  const key = value.toLowerCase();
  const match = Object.keys(FACILITY_ICONS).find((x) => x !== 'default' && key.includes(x));
  return FACILITY_ICONS[match || 'default'];
}

export default function CinemaDetails() {
  const { id } = useParams();
  const [cinema, setCinema] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    setCinema(null);
    api.get(`/cinemas/${id}`).then(setCinema).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="container page"><ErrorBox message={error} onRetry={load} /></div>;
  if (!cinema) return <Spinner label="Loading cinema details…" />;

  const mapQuery = [cinema.name, cinema.address, cinema.city, cinema.state].filter(Boolean).join(', ');
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <div className="container page cinema-page">
      <Link to="/movies" className="back-link"><ArrowLeft size={16} /> Back to movies</Link>
      <section className="cinema-hero">
        <div className="cinema-mark"><ScreenShare size={34} /></div>
        <div className="cinema-hero-copy">
          <div className="chips">
            {cinema.circuit && <span className="badge badge-soft">{cinema.circuit}</span>}
            <span className="badge">{cinema.city}{cinema.state ? `, ${cinema.state}` : ''}</span>
          </div>
          <h1>{cinema.name}</h1>
          <p className="muted"><MapPin size={15} /> {cinema.address}</p>
          <a className="btn btn-ghost btn-sm" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={15} /> View location</a>
        </div>
      </section>

      <section className="section cinema-section">
        <div className="section-head"><div><span className="eyebrow">THE CINEMA EXPERIENCE</span><h2>Facilities & amenities</h2></div></div>
        {cinema.amenities?.length ? (
          <div className="amenity-grid">
            {cinema.amenities.map((item) => {
              const Icon = amenityIcon(item);
              return <div className="amenity-card" key={item}><Icon size={19} /><span>{item}</span></div>;
            })}
          </div>
        ) : <p className="muted">Amenities have not been listed by this cinema.</p>}
      </section>

      <section className="section cinema-section">
        <div className="section-head"><div><span className="eyebrow">SCREEN TECHNOLOGY</span><h2>Screens & seating</h2></div><span className="muted small">{cinema.screens.length} active screen{cinema.screens.length === 1 ? '' : 's'}</span></div>
        {cinema.screens.length ? <div className="screen-spec-grid">
          {cinema.screens.map((screen) => (
            <article className="screen-spec-card" key={screen.id}>
              <div className="screen-spec-head"><div className="screen-icon"><MonitorPlay size={21} /></div><div><h3>{screen.name}</h3><p className="muted small">{screen.screen_type} · {screen.rows} rows × {screen.columns} seats</p></div><span className="capacity-pill">{screen.capacity} seats</span></div>
              <div className="spec-lines">
                <div><Projector size={16} /><span><small>Projection</small><strong>{screen.projection_format || screen.screen_type || 'Digital'}</strong></span></div>
                <div><AudioLines size={16} /><span><small>Sound</small><strong>{screen.sound_system || 'Not specified'}</strong></span></div>
                {screen.screen_dimensions_ft?.width && screen.screen_dimensions_ft?.height ? <div><ScreenShare size={16} /><span><small>Screen dimensions</small><strong>{screen.screen_dimensions_ft.width} × {screen.screen_dimensions_ft.height} ft</strong></span></div> : null}
              </div>
              <div className="tier-breakdown">
                {Object.entries(screen.seat_tiers || {}).map(([tier, data]) => <div key={tier}><span>{tier}</span><strong>{data.seats}</strong><small>{data.rows} rows</small></div>)}
              </div>
              <p className="muted small access-note"><Accessibility size={14} /> {screen.accessible_seats_configured} accessible seat labels configured</p>
            </article>
          ))}
        </div> : <Empty title="No screen details available" text="The theatre has not configured its screen information yet." />}
      </section>

      <section className="section cinema-section">
        <div className="section-head"><div><span className="eyebrow">PLAN YOUR VISIT</span><h2>Upcoming shows</h2></div></div>
        {cinema.upcoming_shows.length ? <div className="cinema-schedule">
          {cinema.upcoming_shows.map((show) => (
            <article className="cinema-show-row" key={show.show_id}>
              <div className="cinema-show-poster"><Poster movie={{ title: show.movie_title, poster_url: show.poster_url, language: show.language, genres: '' }} /></div>
              <div className="cinema-show-main"><h3><Link to={`/movies/${show.movie_id}`}>{show.movie_title}</Link></h3><div className="chips"><span className="badge">{show.language}</span><span className="badge badge-soft">{show.certificate}</span><span className="badge badge-soft">{show.format}</span></div><p className="muted small">{show.screen} · {fmtDateTime(show.start_time)}</p></div>
              <div className="cinema-show-action"><strong>From {money(show.price_from)}</strong><Link className="btn btn-primary btn-sm" to={`/shows/${show.show_id}/seats`}>Select seats</Link></div>
            </article>
          ))}
        </div> : <Empty title="No upcoming shows" text="There are currently no active future shows at this cinema." />}
      </section>
    </div>
  );
}
