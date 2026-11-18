import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import Poster from './Poster';
import { duration, fmtShort, genreList } from '../utils';

export default function MovieCard({ movie }) {
  const upcoming = movie.status === 'upcoming';
  return (
    <Link to={`/movies/${movie.id}`} className="movie-card">
      <div className="movie-card-poster">
        <Poster movie={movie} />
        <span className="cert-pill">{movie.certificate}</span>
        {!upcoming && movie.rating > 0 && (
          <span className="rating-pill">
            <Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)}
          </span>
        )}
        {upcoming && movie.release_date && <span className="rating-pill release-pill">{fmtShort(movie.release_date)}</span>}
      </div>
      <div className="movie-card-body">
        <h3 title={movie.title}>{movie.title}</h3>
        <p>{genreList(movie.genres).slice(0, 2).join(' • ')}</p>
        <p className="muted small">
          {movie.language} • {duration(movie.duration_min)}
        </p>
      </div>
    </Link>
  );
}
