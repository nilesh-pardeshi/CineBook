import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BrainCircuit, ChevronDown, Clapperboard, Compass, Heart,
  HelpCircle, MapPin, ShieldCheck, Sparkles, Ticket, Users, Zap,
} from 'lucide-react';
import { Logo } from './Navbar';

const questions = [
  {
    q: 'How does booking work?',
    a: 'Choose a movie, select a city and showtime, pick available seats, review your order and complete the checkout flow. Your booking and ticket details are available in My bookings.',
  },
  {
    q: 'What does the AI Concierge do?',
    a: 'The CineBook Concierge helps explore the catalogue and find relevant shows using the information available in CineBook. Recommendations are guidance; seat availability and final prices are confirmed by the live booking flow.',
  },
  {
    q: 'Are movie listings and showtimes the same thing?',
    a: 'No. Movie discovery information can come from TMDB, while bookable showtimes, theatres, seat inventory and ticket prices are managed by CineBook. A movie is bookable only when a CineBook show has been scheduled.',
  },
];

function FooterAccordion({ title, children, open, onClick }) {
  return (
    <section className={`footer-accordion ${open ? 'is-open' : ''}`}>
      <button className="footer-accordion-trigger" type="button" onClick={onClick} aria-expanded={open}>
        <span>{title}</span><ChevronDown size={17} />
      </button>
      {open && <div className="footer-accordion-content">{children}</div>}
    </section>
  );
}

export default function Footer() {
  const [openFaq, setOpenFaq] = useState(-1);
  const [showCredits, setShowCredits] = useState(false);

  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="container footer-inner">
        <section className="footer-hero">
          <div className="footer-brand-block">
            <Link to="/" aria-label="CineBook home"><Logo /></Link>
            <span className="footer-kicker"><Sparkles size={13} /> YOUR CINEMA, ONE PLACE</span>
            <h2>Every story deserves<br /><span>a great seat.</span></h2>
            <p>Discover films, explore theatres and turn movie plans into memorable experiences with CineBook.</p>
            <div className="footer-hero-actions">
              <Link to="/movies" className="btn btn-primary">Explore movies <ArrowRight size={16} /></Link>
              <Link to="/movies?status=upcoming" className="footer-text-link">Coming soon</Link>
            </div>
          </div>
          <div className="footer-vision-card">
            <div className="footer-vision-icon"><Clapperboard size={22} /></div>
            <span className="footer-card-label">OUR VISION</span>
            <h3>Make cinema discovery feel as exciting as the movie itself.</h3>
            <p>One connected experience for discovering films, comparing real showtimes and booking seats with confidence.</p>
            <div className="footer-vision-points">
              <span><ShieldCheck size={14} /> Clear booking information</span>
              <span><Heart size={14} /> Made for movie lovers</span>
            </div>
          </div>
        </section>

        <section className="footer-value-grid" aria-label="CineBook capabilities">
          <article className="footer-value-card">
            <span className="footer-value-icon coral"><Compass size={19} /></span>
            <h3>Discover</h3>
            <p>Explore movies, languages, genres, posters and film details in one catalogue.</p>
            <Link to="/movies">Browse the catalogue <ArrowRight size={13} /></Link>
          </article>
          <article className="footer-value-card">
            <span className="footer-value-icon violet"><Ticket size={19} /></span>
            <h3>Book with clarity</h3>
            <p>Compare scheduled theatres and showtimes, then choose seats from live availability.</p>
            <Link to="/movies">Find a show <ArrowRight size={13} /></Link>
          </article>
          <article className="footer-value-card">
            <span className="footer-value-icon blue"><BrainCircuit size={19} /></span>
            <h3>AI-assisted choices</h3>
            <p>Use the AI Concierge and available recommendation tools to make movie planning easier.</p>
            <span className="footer-capability-note"><Zap size={12} /> Helpful guidance, you stay in control</span>
          </article>
          <article className="footer-value-card">
            <span className="footer-value-icon green"><Users size={19} /></span>
            <h3>Your CineBook space</h3>
            <p>Keep track of your bookings and manage your account from one place.</p>
            <Link to="/bookings">View my bookings <ArrowRight size={13} /></Link>
          </article>
        </section>

        <section className="footer-how" aria-label="How CineBook works">
          <div className="footer-section-heading">
            <div><span className="footer-kicker">SIMPLE FROM START TO SCREEN</span><h2>How CineBook works</h2></div>
            <p>Four clear steps. No guesswork about what is actually bookable.</p>
          </div>
          <div className="footer-steps">
            <div className="footer-step"><span>01</span><div><strong>Find your film</strong><small>Browse titles and explore movie details.</small></div></div>
            <div className="footer-step"><span>02</span><div><strong>Choose a show</strong><small>Pick a city, theatre, date and scheduled time.</small></div></div>
            <div className="footer-step"><span>03</span><div><strong>Select your seats</strong><small>Check availability and review your selection.</small></div></div>
            <div className="footer-step"><span>04</span><div><strong>Enjoy the show</strong><small>Complete checkout and access your ticket.</small></div></div>
          </div>
        </section>

        <section className="footer-faq" aria-label="Frequently asked questions">
          <div className="footer-section-heading compact">
            <div><span className="footer-kicker">GOOD TO KNOW</span><h2>Quick answers</h2></div>
            <span className="footer-faq-hint"><HelpCircle size={14} /> Tap a question to expand</span>
          </div>
          <div className="footer-faq-list">
            {questions.map((item, index) => (
              <FooterAccordion key={item.q} title={item.q} open={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                <p>{item.a}</p>
              </FooterAccordion>
            ))}
          </div>
        </section>

        <section className="footer-bottom-grid">
          <div className="footer-bottom-brand">
            <Logo />
            <p>Thoughtful discovery. Clear choices. Better movie nights.</p>
            <span className="footer-status"><span /> Made for movie lovers</span>
          </div>
          <div className="footer-nav-column">
            <h4>Explore</h4>
            <Link to="/movies">Now showing</Link>
            <Link to="/movies?status=upcoming">Coming soon</Link>
            <Link to="/">Home</Link>
          </div>
          <div className="footer-nav-column">
            <h4>Your account</h4>
            <Link to="/bookings">My bookings</Link>
            <Link to="/profile">Profile & settings</Link>
            <Link to="/login">Log in</Link>
          </div>
          <div className="footer-nav-column footer-help-column">
            <h4>Plan your visit</h4>
            <p><MapPin size={14} /> Choose your city in the top navigation to see local showtimes.</p>
            <Link to="/movies" className="footer-bottom-cta">Start exploring <ArrowRight size={14} /></Link>
          </div>
        </section>

        <div className="footer-legal-row">
          <span>© {new Date().getFullYear()} CineBook. Built around the joy of cinema.</span>
          <button type="button" className="footer-credits-toggle" onClick={() => setShowCredits(!showCredits)} aria-expanded={showCredits}>
            Movie data credits <ChevronDown size={13} />
          </button>
          <span className="footer-demo-note">Demo environment · Payments may run in sandbox mode</span>
        </div>
        {showCredits && (
          <div className="footer-credits-panel">
            <span className="tmdb-wordmark">TMDB</span>
            <p>Movie metadata and images may be provided by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        )}
      </div>
    </footer>
  );
}
