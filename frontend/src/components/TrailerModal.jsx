import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, PlayCircle, TriangleAlert } from 'lucide-react';
import Modal from './Modal';

function parseTrailerUrl(raw) {
  if (!raw || !String(raw).trim()) return { type: 'none', url: '', externalUrl: '' };
  const value = String(raw).trim();
  const candidate = /^[A-Za-z0-9_-]{11}$/.test(value) ? `https://www.youtube.com/watch?v=${value}` : value;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';
    if (host === 'youtu.be') videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') videoId = parsed.searchParams.get('v') || '';
      else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) videoId = parts[1] || '';
      }
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return {
        type: 'youtube',
        url: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const vimeoId = parts.at(-1) || '';
      if (/^\d+$/.test(vimeoId)) return { type: 'vimeo', url: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`, externalUrl: `https://vimeo.com/${vimeoId}` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) return { type: 'video', url: parsed.href, externalUrl: parsed.href };
    return { type: 'external', url: '', externalUrl: parsed.href };
  } catch {
    return { type: 'external', url: '', externalUrl: /^https?:\/\//i.test(value) ? value : '' };
  }
}

export default function TrailerModal({ movie, onClose }) {
  const source = useMemo(() => parseTrailerUrl(movie?.trailer_url), [movie?.trailer_url]);
  const [playerFailed, setPlayerFailed] = useState(false);
  useEffect(() => setPlayerFailed(false), [movie?.trailer_url]);
  const content = (
    <Modal title={`${movie?.title || 'Movie'} · Trailer`} onClose={onClose} wide>
      <div className="trailer-frame">
        {!playerFailed && (source.type === 'youtube' || source.type === 'vimeo') ? (
          <iframe
            src={source.url}
            title={`${movie?.title || 'Movie'} official trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            loading="eager"
            referrerPolicy="origin"
            onError={() => setPlayerFailed(true)}
          />
        ) : !playerFailed && source.type === 'video' ? (
          <video src={source.url} controls autoPlay playsInline onError={() => setPlayerFailed(true)} />
        ) : (
          <div className="trailer-fallback">
            {source.type === 'none' ? <PlayCircle size={34} /> : <TriangleAlert size={32} />}
            <p>{source.type === 'none' ? 'A trailer has not been added for this movie yet. Import its details from TMDB in the admin movie form.' : 'This video cannot be embedded here. You can still open the original trailer.'}</p>
            {source.externalUrl && <a className="btn btn-primary" href={source.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open trailer on source</a>}
          </div>
        )}
      </div>
      {source.type === 'youtube' && <div className="trailer-actions"><a href={source.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open on YouTube</a></div>}
      <p className="muted small trailer-caption">Trailers are played from their original video host. CineBook does not download or re-host copyrighted trailers.</p>
    </Modal>
  );
  return createPortal(content, document.body);
}
