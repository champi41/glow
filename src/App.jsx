import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import BusinessPage from "./pages/public/BusinessPage.jsx";
import ProfessionalPage from "./pages/public/ProfessionalPage.jsx";
import BookingPage from "./pages/public/BookingPage.jsx";
// ReviewPage removed; reviews now handled inside BookingStatusPage
import BookingStatusPage from "./pages/public/BookingStatusPage.jsx";
import AuthGuard from "./components/ui/AuthGuard.jsx";
import LoginPage from "./pages/admin/LoginPage.jsx";
import BookingsPage from "./pages/admin/BookingsPage.jsx";
import AgendaPage from "./pages/admin/AgendaPage.jsx";
import SchedulePage from "./pages/admin/SchedulePage.jsx";
import ServicesPage from "./pages/admin/ServicesPage.jsx";
import ProfilePage from "./pages/admin/ProfilePage.jsx";
import BusinessProfilePage from "./pages/admin/BusinessProfilePage.jsx";
import ReviewsPage from "./pages/admin/ReviewsPage.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();

  // Siempre que cambia la ruta, subimos al inicio de la página
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function AdminLoginPlaceholder() {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        fontFamily: "var(--font-system)",
      }}
    >
      Admin login — próximamente
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        fontFamily: "var(--font-system)",
        color: "var(--color-text-secondary)",
      }}
    >
      404 — Página no encontrada
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />

        <Route
          path="/admin"
          element={
            <AuthGuard>
              <Navigate to="/admin/reservas" replace />
            </AuthGuard>
          }
        />

        <Route
          path="/admin/reservas"
          element={
            <AuthGuard>
              <BookingsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/admin/agenda"
          element={
            <AuthGuard>
              <AgendaPage />
            </AuthGuard>
          }
        />

        <Route
          path="/admin/negocio"
          element={
            <AuthGuard requireManage>
              <BusinessProfilePage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/servicios"
          element={
            <AuthGuard requireManage>
              <ServicesPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/horario"
          element={
            <AuthGuard requireManage>
              <SchedulePage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/resenas"
          element={
            <AuthGuard requireManage>
              <ReviewsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/admin/perfil"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />

        <Route path="/:slug/pro/:profSlug" element={<ProfessionalPage />} />
        {/* Ruta de reseñas eliminada: ahora las reseñas se gestionan en BookingStatusPage */}
        <Route
          path="/:slug/reserva/:bookingId"
          element={<BookingStatusPage />}
        />
        <Route path="/:slug/reservar" element={<BookingPage />} />
        <Route path="/:slug" element={<BusinessPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
