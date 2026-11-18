import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgePercent, Clock, CreditCard, Landmark, Minus, Plus, Smartphone, Wallet, X } from 'lucide-react';
import { api } from '../api';
import { ErrorBox, Spinner } from '../components/Common';
import { useUI } from '../context/UIContext';
import { fmtDateTime, money } from '../utils';

const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda'];
const WALLETS = ['PhonePe', 'Paytm', 'Amazon Pay', 'MobiKwik'];
const METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
const fmtExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function Checkout() {
  const { ref } = useParams();
  const nav = useNavigate();
  const { toast } = useUI();

  const [b, setB] = useState(null);
  const [foods, setFoods] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [qty, setQty] = useState({});
  const [error, setError] = useState('');
  const [left, setLeft] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [code, setCode] = useState('');
  const [method, setMethod] = useState('upi');
  const [pay, setPay] = useState({ card_number: '', card_expiry: '', card_cvv: '', card_name: '', upi_id: '', bank: BANKS[0], wallet: WALLETS[0] });
  const [paying, setPaying] = useState(false);

  const deadline = useRef(0);
  const qtyRef = useRef({});
  const seq = useRef(0);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/bookings/${ref}`);
      if (data.status === 'CONFIRMED') {
        nav(`/booking/${ref}`, { replace: true });
        return;
      }
      deadline.current = Date.now() + data.seconds_left * 1000;
      setLeft(data.seconds_left);
      setB(data);
      const q = {};
      data.food.forEach((f) => (q[f.food_id] = f.qty));
      qtyRef.current = q;
      setQty(q);
    } catch (e) {
      setError(e.message);
    }
  }, [ref, nav]);

  useEffect(() => {
    load();
    api.get('/food').then(setFoods).catch(() => {});
    api.get('/coupons').then(setCoupons).catch(() => {});
    return () => clearTimeout(timer.current);
  }, [load]);

  // countdown for the seat hold
  useEffect(() => {
    if (!b || b.status !== 'PENDING') return undefined;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        load(); // server will report EXPIRED
      }
    }, 1000);
    return () => clearInterval(t);
  }, [b?.status, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="container page"><ErrorBox message={error} /></div>;
  if (!b) return <Spinner />;

  const dead = b.status !== 'PENDING';
  if (dead) {
    return (
      <div className="container page">
        <div className="center-box">
          <Clock size={40} className="muted" />
          <h2>{b.status === 'EXPIRED' ? 'Your seat hold expired' : 'This booking is no longer active'}</h2>
          <p className="muted">Seats are held for a few minutes while you check out. Please pick your seats again.</p>
          <Link className="btn btn-primary" to={`/shows/${b.show.id}/seats`}>Select seats again</Link>
        </div>
      </div>
    );
  }

  const changeQty = (food, delta) => {
    const next = Math.max(0, Math.min(10, (qtyRef.current[food.id] || 0) + delta));
    qtyRef.current = { ...qtyRef.current, [food.id]: next };
    setQty(qtyRef.current);
    setSyncing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await api.put(`/bookings/${ref}/food`, {
          items: Object.entries(qtyRef.current).map(([food_id, q]) => ({ food_id: Number(food_id), qty: q })),
        });
        if (mine === seq.current) {
          setB(res);
          if (res.notice) toast.info(res.notice);
        }
      } catch (e) {
        toast.error(e.message);
        if (e.status === 410) load();
      } finally {
        if (mine === seq.current) setSyncing(false);
      }
    }, 350);
  };

  const applyCoupon = async (c) => {
    const value = (c || code).trim();
    if (!value) return;
    try {
      const res = await api.post(`/bookings/${ref}/coupon`, { code: value });
      setB(res);
      setCode('');
      toast.success(`Coupon ${res.coupon_code} applied. You saved ${money(res.discount)}!`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeCoupon = async () => {
    try {
      setB(await api.del(`/bookings/${ref}/coupon`));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setPaying(true);
    const details = {
      card: { card_number: pay.card_number, card_expiry: pay.card_expiry, card_cvv: pay.card_cvv, card_name: pay.card_name },
      upi: { upi_id: pay.upi_id },
      netbanking: { bank: pay.bank },
      wallet: { wallet: pay.wallet },
    }[method];
    try {
      await api.post(`/bookings/${ref}/pay`, { method, ...details });
      nav(`/booking/${ref}`, { replace: true, state: { fresh: true } });
    } catch (err) {
      toast.error(err.message);
      if (err.status === 410 || /price has been updated/.test(err.message)) load();
    } finally {
      setPaying(false);
    }
  };

  const set = (k) => (e) => setPay((p) => ({ ...p, [k]: e.target.value }));
  const mm = String(Math.floor((left || 0) / 60)).padStart(2, '0');
  const ss = String((left || 0) % 60).padStart(2, '0');
  const categories = [...new Set(foods.map((f) => f.category))];
  const usable = coupons.filter((c) => c.code !== b.coupon_code);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Checkout</h1>
        <div className={`timer ${left < 60 ? 'urgent' : ''}`} role="timer">
          <Clock size={16} /> Seats held for {mm}:{ss}
        </div>
      </div>

      <div className="checkout-grid">
        <div className="checkout-main">
          <section className="card">
            <h3>Add snacks <span className="muted small">(optional)</span></h3>
            {categories.map((cat) => (
              <div key={cat}>
                <h4 className="cat-title">{cat}</h4>
                <div className="food-grid">
                  {foods.filter((f) => f.category === cat).map((f) => (
                    <div className="food-item" key={f.id}>
                      <span className="food-emoji">{f.emoji}</span>
                      <div className="food-info">
                        <strong>
                          <i className={`veg ${f.is_veg ? 'v' : 'nv'}`} title={f.is_veg ? 'Veg' : 'Non-veg'} /> {f.name}
                        </strong>
                        <span className="muted small">{f.description}</span>
                        <span className="food-price">{money(f.price)}</span>
                      </div>
                      {qty[f.id] ? (
                        <div className="stepper">
                          <button type="button" onClick={() => changeQty(f, -1)} aria-label={`Remove one ${f.name}`}><Minus size={14} /></button>
                          <span>{qty[f.id]}</span>
                          <button type="button" onClick={() => changeQty(f, 1)} aria-label={`Add one ${f.name}`}><Plus size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeQty(f, 1)}>Add</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <h3>Offers &amp; coupons</h3>
            {b.coupon_code ? (
              <div className="applied-coupon">
                <BadgePercent size={20} />
                <div>
                  <strong>{b.coupon_code}</strong> applied
                  <div className="muted small">You're saving {money(b.discount)}</div>
                </div>
                <button className="icon-btn" onClick={removeCoupon} aria-label="Remove coupon"><X size={16} /></button>
              </div>
            ) : (
              <>
                <div className="coupon-form">
                  <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" onKeyDown={(e) => e.key === 'Enter' && applyCoupon()} />
                  <button className="btn btn-primary" disabled={!code.trim() || syncing} onClick={() => applyCoupon()}>Apply</button>
                </div>
                <div className="coupon-list">
                  {usable.map((c) => (
                    <button type="button" key={c.code} className="coupon-chip" disabled={syncing} onClick={() => applyCoupon(c.code)}>
                      <strong>{c.code}</strong>
                      <span>{c.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <form className="card" onSubmit={submit} id="pay-form">
            <h3>Payment</h3>
            <div className="sandbox-note">
              Sandbox mode, no real money is charged. Use card <b>4111 1111 1111 1111</b> with any future expiry and CVV, or any UPI ID like <b>name@okaxis</b>.
            </div>
            <div className="method-tabs" role="tablist">
              {METHODS.map((m) => (
                <button type="button" role="tab" aria-selected={method === m.id} key={m.id} className={method === m.id ? 'on' : ''} onClick={() => setMethod(m.id)}>
                  <m.icon size={16} /> {m.label}
                </button>
              ))}
            </div>

            {method === 'upi' && (
              <label className="field">UPI ID
                <input className="input" value={pay.upi_id} onChange={set('upi_id')} placeholder="yourname@okaxis" required autoComplete="off" />
              </label>
            )}
            {method === 'card' && (
              <div className="form-grid">
                <label className="field span2">Card number
                  <input className="input" inputMode="numeric" value={pay.card_number} onChange={(e) => setPay((p) => ({ ...p, card_number: fmtCard(e.target.value) }))} placeholder="1234 5678 9012 3456" required autoComplete="cc-number" />
                </label>
                <label className="field">Expiry
                  <input className="input" inputMode="numeric" value={pay.card_expiry} onChange={(e) => setPay((p) => ({ ...p, card_expiry: fmtExpiry(e.target.value) }))} placeholder="MM/YY" required autoComplete="cc-exp" />
                </label>
                <label className="field">CVV
                  <input className="input" type="password" inputMode="numeric" maxLength={4} value={pay.card_cvv} onChange={(e) => setPay((p) => ({ ...p, card_cvv: e.target.value.replace(/\D/g, '') }))} placeholder="•••" required autoComplete="cc-csc" />
                </label>
                <label className="field span2">Name on card
                  <input className="input" value={pay.card_name} onChange={set('card_name')} placeholder="As printed on the card" autoComplete="cc-name" />
                </label>
              </div>
            )}
            {method === 'netbanking' && (
              <label className="field">Select your bank
                <select className="input" value={pay.bank} onChange={set('bank')}>{BANKS.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            )}
            {method === 'wallet' && (
              <label className="field">Select wallet
                <select className="input" value={pay.wallet} onChange={set('wallet')}>{WALLETS.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            )}
          </form>
        </div>

        <aside className="summary card">
          <h3>Order summary</h3>
          <div className="summary-movie">
            <strong>{b.show.movie.title}</strong>
            <span className="muted small">{b.show.movie.language} • {b.show.movie.certificate}</span>
            <span className="muted small">{b.show.theatre.name}, {b.show.theatre.city}</span>
            <span className="muted small">{b.show.screen.name} • {fmtDateTime(b.show.start_time)}</span>
          </div>
          <div className="summary-lines">
            <div>
              <span>{b.seat_details.length} ticket{b.seat_details.length > 1 ? 's' : ''} <em className="muted small">({b.seats.join(', ')})</em></span>
              <span>{money(b.seat_total)}</span>
            </div>
            {b.food.map((f) => (
              <div key={f.food_id}><span>{f.qty} × {f.name}</span><span>{money(f.qty * f.unit_price)}</span></div>
            ))}
            <div><span>Convenience fee</span><span>{money(b.fee)}</span></div>
            {b.discount > 0 && <div className="discount"><span>Discount ({b.coupon_code})</span><span>− {money(b.discount)}</span></div>}
          </div>
          <div className="summary-total"><span>Total</span><strong>{money(b.total)}</strong></div>
          <button className="btn btn-primary btn-lg btn-block" type="submit" form="pay-form" disabled={paying || syncing}>
            {paying ? 'Processing…' : syncing ? 'Updating…' : `Pay ${money(b.total)}`}
          </button>
          <p className="muted small center">By paying you agree to our terms. Tickets can be cancelled up to 2 hours before the show.</p>
        </aside>
      </div>
    </div>
  );
}
