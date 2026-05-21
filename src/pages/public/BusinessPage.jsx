import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, ChevronRight } from "lucide-react";
import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useServices } from "../../hooks/useServices.js";
import {
  useApprovedReviews,
  useApprovedReviewsByProf,
} from "../../hooks/useReviews.js";
import { formatTotalPrice } from "../../utils/format.js";
import Spinner from "../../components/ui/Spinner.jsx";
import BusinessHero from "../../components/public/BusinessHero.jsx";
import ProfessionalCard from "../../components/public/ProfessionalCard.jsx";
import SelectableServiceCard from "../../components/public/SelectableServiceCard.jsx";
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
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState(() => new Set());
  const servicesSectionRef = useRef(null);

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

  const isIndividualPlan = tenant?.plan === "individual";
  const primaryProfessional = isIndividualPlan ? professionals[0] : null;
  const professionalId = primaryProfessional?.id ?? null;

  const { data: profReviews = [] } = useApprovedReviewsByProf(
    tenant?.id,
    professionalId,
  );

  const reviewsToShow = isIndividualPlan
    ? profReviews.length > 0
      ? profReviews
      : reviews
    : reviews;

  const hasReviews = reviewsToShow.length > 0;
  const avgRating = hasReviews
    ? (
        reviewsToShow.reduce((s, r) => s + (r.rating ?? 0), 0) /
        reviewsToShow.length
      ).toFixed(1)
    : null;

  const portfolioUrls = Array.isArray(primaryProfessional?.portfolioUrls)
    ? primaryProfessional.portfolioUrls
    : [];
  const hasPortfolio = portfolioUrls.length > 0;

  const profServices = isIndividualPlan
    ? (services ?? []).filter((s) =>
        (s.professionalIds || []).includes(professionalId),
      )
    : [];
  const servicesToShow = isIndividualPlan
    ? profServices.length > 0
      ? profServices
      : services
    : [];

  const servicesByCategory = servicesToShow.reduce((acc, service) => {
    const cat = service.category || "Otros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const showServiceDeposit =
    tenant?.deposit?.enabled === true &&
    tenant?.deposit?.type === "per_service";

  const selectedServices = servicesToShow.filter((s) =>
    selectedServiceIds.has(s.id),
  );
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + (s.duration ?? 0),
    0,
  );

  const toggleService = (serviceId) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleReservar = () => {
    if (!professionalId) return;
    const servicesParam = Array.from(selectedServiceIds).join(",");
    navigate(
      `/${slug}/reservar?profId=${professionalId}&services=${servicesParam}`,
    );
  };

  const scrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

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
        showContactText={isIndividualPlan}
      />

      <section className="page-section page-cta">
        <button
          type="button"
          className="btn-primary services-cta__btn"
          onClick={
            isIndividualPlan
              ? scrollToServices
              : () => navigate(`/${slug}/reservar`)
          }
        >
          Ver servicios <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>
      {!isIndividualPlan && (
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
      )}

      {isIndividualPlan && hasPortfolio && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title">Trabajos</h2>
          </div>
          <div className="business-portfolio__carousel">
            {portfolioUrls.map((url) => (
              <button
                key={url}
                type="button"
                className="business-portfolio__item"
                onClick={() => setLightboxUrl(url)}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </section>
      )}

      {hasReviews && (
        <section className="page-section reviews-section">
          <div className="section-header">
            <h2 className="section-title">
              {isIndividualPlan
                ? "Reseñas del profesional"
                : "Lo que dicen nuestros clientes"}
            </h2>
            <p className="reviews-section__summary">
              ★ {avgRating} · {reviewsToShow.length} reseña
              {reviewsToShow.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="reviews-carousel">
            {reviewsToShow.map((r) => {
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

      {isIndividualPlan && (
        <section className="page-section" ref={servicesSectionRef}>
          <div className="section-header">
            <h2 className="section-title">Servicios</h2>
          </div>
          <div className="prof-services">
            {Object.keys(servicesByCategory).length === 0 ? (
              <p className="business-page__empty">
                Este profesional aún no tiene servicios disponibles.
              </p>
            ) : (
              Object.entries(servicesByCategory).map(([cat, items]) => (
                <div className="prof-services__group" key={cat}>
                  <p className="prof-services__category">{cat}</p>
                  <div className="prof-services__list">
                    {items.map((service) => (
                      <SelectableServiceCard
                        key={service.id}
                        service={service}
                        showDeposit={showServiceDeposit}
                        selected={selectedServiceIds.has(service.id)}
                        onToggle={() => toggleService(service.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {isIndividualPlan && selectedServiceIds.size > 0 && (
        <div className="booking-sticky">
          <div className="booking-sticky__summary">
            <span className="booking-sticky__count">
              {selectedServiceIds.size} servicio
              {selectedServiceIds.size > 1 ? "s" : ""}
            </span>
            <span className="booking-sticky__total">
              {formatTotalPrice(selectedServices)} · {totalDuration} min
            </span>
          </div>
          <button
            type="button"
            className="btn-primary booking-sticky__btn"
            onClick={handleReservar}
          >
            Reservar <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <footer className="site-footer">
        <p>
          {tenant.name} · {tenant.address}
        </p>
        <p>Reservas en línea disponibles las 24 hrs.</p>
      </footer>

      {lightboxUrl && (
        <div
          className="business-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" />
        </div>
      )}

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
