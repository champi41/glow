import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, ArrowRight, ChevronRight } from "lucide-react";
import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useServices } from "../../hooks/useServices.js";
import { useApprovedReviews } from "../../hooks/useReviews.js";
import Spinner from "../../components/ui/Spinner.jsx";
import BusinessHero from "../../components/public/BusinessHero.jsx";
import ProfessionalCard from "../../components/public/ProfessionalCard.jsx";
import "./BusinessPage.css";

const STAR_COLOR = "#f4b942";

const WEEK_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS_FULL = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function BusinessPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    data: tenant,
    isLoading: tenantLoading,
    isError: tenantError,
  } = useTenant(slug);

  useApplyTheme(tenant);
  const [showLocationHours, setShowLocationHours] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);

  useEffect(() => {
    if (showLocationHours) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showLocationHours]);

  function handleCloseLocationHours() {
    if (isClosingModal) return;
    setIsClosingModal(true);
    setTimeout(() => {
      setShowLocationHours(false);
      setIsClosingModal(false);
    }, 250);
  }
  const { data: professionals = [] } = useProfessionals(tenant?.id);
  const { data: services = [] } = useServices(tenant?.id, { activeOnly: true });
  const { data: reviews = [] } = useApprovedReviews(tenant?.id);
  const hasReviews = reviews.length > 0;
  const avgRating = hasReviews
    ? (
        reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
      ).toFixed(1)
    : null;

  const isLoading = tenantLoading;
  const businessHours = tenant?.businessHours || null;
  const address = tenant?.address?.trim() || "";
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const hasLocationOrHours = !!(address || businessHours);

  useEffect(() => {
    if (!showLocationHours || !address) {
      setMapCoords(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
          {
            headers: {
              "Accept-Language": "es",
              "User-Agent": "ReservasApp/1.0",
            },
          },
        );
        if (cancelled) return;
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setMapCoords({ lat, lon });
          }
        }
      } catch {
        if (!cancelled) setMapCoords(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showLocationHours, address]);

  if (tenantError || (!tenantLoading && !tenant)) {
    return (
      <div className="business-page business-page--error">
        <p className="business-page__error-msg">Negocio no encontrado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="business-page business-page--loading">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="business-page">
      <BusinessHero
        tenant={tenant}
        slug={slug}
        onOpenLocationHours={
          hasLocationOrHours ? () => setShowLocationHours(true) : null
        }
      />
      <section className="page-section page-cta">
        <button
          type="button"
          className="btn-primary services-cta__btn"
          onClick={() => navigate(`/${slug}/reservar`)}
        >
          Ver servicios <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title">Nuestros profesionales</h2>
        </div>
        <div className="professionals-carousel">
          {professionals.map((p) => (
            <ProfessionalCard key={p.id} professional={p} tenantSlug={slug} />
          ))}
        </div>
      </section>

      {hasReviews && (
        <section className="page-section reviews-section">
          <div className="section-header">
            <h2 className="section-title">Lo que dicen nuestros clientes</h2>
            <p className="reviews-section__summary">
              ★ {avgRating} · {reviews.length} reseña
              {reviews.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="reviews-carousel">
            {reviews.map((r) => {
              const proDisplay =
                Array.isArray(r.professionalNames) &&
                r.professionalNames.length > 0
                  ? r.professionalNames.join(", ")
                  : r.professionalName;
              return (
                <div key={r.id} className="reviews-carousel__card">
                  <div
                    className="reviews-carousel__stars"
                    aria-label={`${r.rating} estrellas`}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        style={{
                          color:
                            i <= r.rating
                              ? STAR_COLOR
                              : "var(--color-text-tertiary)",
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="reviews-carousel__comment">
                    {r.comment || "Sin comentario."}
                  </p>
                  {r.serviceNames?.length > 0 && (
                    <p className="reviews-carousel__services">
                      {r.serviceNames.join(", ")}
                    </p>
                  )}
                  <p className="reviews-carousel__meta">
                    {r.clientName}
                    {proDisplay ? ` · ${proDisplay}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="site-footer">
        <p>
          {tenant.name} · {tenant.address}
        </p>
        <p>Reservas en línea disponibles las 24 hrs.</p>
      </footer>

      {showLocationHours && (
        <div
          className={`location-hours-overlay ${isClosingModal ? "location-hours-overlay--closing" : ""}`}
          onClick={handleCloseLocationHours}
        >
          <div
            className={`location-hours-modal ${isClosingModal ? "location-hours-modal--closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="location-hours-modal__header">
              <h2 className="location-hours-modal__title">
                Ubicación y horario
              </h2>
              <button
                type="button"
                className="location-hours-modal__close"
                onClick={handleCloseLocationHours}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="location-hours-modal__body">
              {address && (
                <>
                  <div className="location-hours-modal__map-wrap">
                    {mapCoords ? (
                      <iframe
                        title="Mapa"
                        className="location-hours-modal__map"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lon - 0.008},${mapCoords.lat - 0.006},${mapCoords.lon + 0.008},${mapCoords.lat + 0.006}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lon}`}
                      />
                    ) : (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="location-hours-modal__map-link"
                      >
                        Ver en mapa
                      </a>
                    )}
                  </div>
                  <div className="location-hours-modal__address-wrap">
                    <div className="location-hours-modal__address">
                      <MapPin size={14} aria-hidden="true" />
                      <span>{address}</span>
                    </div>
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="location-hours-modal__maps-btn"
                    >
                      Ver en Maps
                    </a>
                  </div>
                </>
              )}
              {businessHours && (
                <div className="location-hours-modal__hours">
                  <p className="location-hours-modal__hours-title">Horario</p>
                  <ul className="location-hours-list">
                    {WEEK_KEYS.map((key) => {
                      const day = businessHours[key];
                      const isOpen = day?.isOpen;
                      const label = DAY_LABELS_FULL[key] || key;
                      const open = day?.open;
                      const close = day?.close;
                      return (
                        <li key={key} className="location-hours-list__row">
                          <span className="location-hours-list__day">
                            {label}
                          </span>
                          <span className="location-hours-list__time">
                            {isOpen ? `${open} – ${close}` : "Cerrado"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
