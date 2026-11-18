import { useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AiConcierge from './components/AiConcierge';
import { Protected } from './components/Common';
import Home from './pages/Home';
import Movies from './pages/Movies';
import MovieDetail from './pages/MovieDetail';
import CinemaDetails from './pages/CinemaDetails';
import CinemaDirectory from './pages/CinemaDirectory';
import SeatSelection from './pages/SeatSelection';
import Checkout from './pages/Checkout';
import Ticket from './pages/Ticket';
import MyBookings from './pages/MyBookings';
import { Login, Register } from './pages/Auth';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import { AdminCoupons, AdminFood, AdminMovies, AdminScreens, AdminTheatres } from './pages/admin/AdminCatalog';
import AdminShows from './pages/admin/AdminShows';
import AdminBookings from './pages/admin/AdminBookings';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function SiteLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <Footer />
      <AiConcierge />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="movies" element={<Movies />} />
          <Route path="movies/:id" element={<MovieDetail />} />
          <Route path="cinemas" element={<CinemaDirectory />} />
          <Route path="cinemas/:id" element={<CinemaDetails />} />
          <Route path="shows/:id/seats" element={<SeatSelection />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="checkout/:ref" element={<Protected><Checkout /></Protected>} />
          <Route path="booking/:ref" element={<Protected><Ticket /></Protected>} />
          <Route path="bookings" element={<Protected><MyBookings /></Protected>} />
          <Route path="profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="admin" element={<Protected admin><AdminLayout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="movies" element={<AdminMovies />} />
          <Route path="theatres" element={<AdminTheatres />} />
          <Route path="screens" element={<AdminScreens />} />
          <Route path="shows" element={<AdminShows />} />
          <Route path="food" element={<AdminFood />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="bookings" element={<AdminBookings />} />
        </Route>
      </Routes>
    </>
  );
}
