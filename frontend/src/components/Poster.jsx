import { useState } from 'react';
import { genreList, hueOf } from '../utils';

/** Shows the movie poster image, or a generated gradient poster when no image is set / it fails to load. */
export default function Poster({ movie, className = '' }) {
  const [broken, setBroken] = useState(false);
  if (movie.poster_url && !broken) {
    return (
      <img
        className={`poster ${className}`}
        src={movie.poster_url}
        alt={movie.title}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className={`poster poster-gen ${className}`} style={{ '--h': hueOf(movie.title) }} role="img" aria-label={movie.title}>
      <span className="poster-genre">{genreList(movie.genres)[0]}</span>
      <span className="poster-title">{movie.title}</span>
      <span className="poster-lang">{movie.language}</span>
    </div>
  );
}
