// All times from the API are naive "wall clock" strings in the theatre's timezone, so we
// format them exactly as written, with no timezone conversion.
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const parse = (s) => new Date(s.length === 10 ? s + 'T00:00:00' : s);

export const fmtTime = (s) =>
  parse(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

export const fmtDate = (s) => parse(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDateLong = (s) =>
  parse(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtDateTime = (s) => `${fmtDate(s)}, ${fmtTime(s)}`;

export const fmtShort = (s) => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const dayParts = (s) => {
  const d = parse(s);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
  };
};

export const duration = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export const hueOf = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
};

export const isoToday = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const CATEGORY_LABEL = { regular: 'Classic', premium: 'Prime', recliner: 'Recliner' };

export const genreList = (g) => (g || '').split(',').map((x) => x.trim()).filter(Boolean);
