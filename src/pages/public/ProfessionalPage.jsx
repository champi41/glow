import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import { useProfessional } from "../../hooks/useProfessional.js";
import { useServices } from "../../hooks/useServices.js";
import { useApprovedReviewsByProf } from "../../hooks/useReviews.js";
import { formatPrice } from "../../utils/format.js";
import Spinner from "../../components/ui/Spinner.jsx";
import ProfessionalHero from "../../components/public/ProfessionalHero.jsx";
import SelectableServiceCard from "../../components/public/SelectableServiceCard.jsx";
import "./ProfessionalPage.css";

const STAR_COLOR = "#f4b942";

export default function ProfessionalPage() {
  const { slug, profSlug } = useParams();
  const navigate = useNavigate();
  const { data: tenant, isLoading: tenantLoading } = useTenant(slug);
  const { data: professional, isLoading: profLoading } = useProfessional(tenant?.id, profSlug);
  const { data: services = [], isLoading: servicesLoading } = useServices(tenant?.id, { activeOnly: true });

  const [selectedServiceIds, setSelectedServiceIds] = useState(() => new Set());
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

  useApplyTheme(tenant);

  const { data: reviews = [] } = useApprovedReviewsByProf(tenant?.id, professional?.id);
  const hasReviews = reviews.length > 0;
  const displayedReviews = reviewsExpanded ? reviews : reviews.slice(0, 5);
  const hasMoreReviews = reviews.length > 5;

  const portfolioUrls = professional?.portfolioUrls ?? [];
  const hasPortfolio = Array.isArray(portfolioUrls) && portfolioUrls.length > 0;
  const lightboxRef = useRef(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", onKeyDown);
    lightboxRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

  const isLoading = tenantLoading || profLoading || servicesLoading;
  const tenantId = tenant?.id;

  const profServices = (services ?? []).filter((s) =>
    (s.professionalIds || []).includes(professional?.id)
  );

  const servicesByCategory = profServices.reduce((acc, service) => {
    const cat = service.category || "Otros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const selectedServices = profServices.filter((s) => selectedServiceIds.has(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration ?? 0), 0);

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
    const servicesParam = Array.from(selectedServiceIds).join(",");
    navigate(`/${slug}/reservar?profId=${professional.id}&services=${servicesParam}`);
  };

  if (!tenantLoading && !tenant) {
    return (
      <div className="professional-page professional-page--error">
        <p className="professional-page__error-msg">Negocio no encontrado</p>
      </div>
    );
  }

  if (!profLoading && tenant && !professional) {
    return (
      <div className="professional-page professional-page--error">
        <p className="professional-page__error-msg">Profesional no encontrado</p>
        <button type="button" className="btn-outline" onClick={() => navigate(`/${slug}`)}>
          Volver
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="professional-page professional-page--loading">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="professional-page">
      <ProfessionalHero
        professional={professional}
        tenantSlug={slug}
        tenantName={tenant.name}
      />

      {hasPortfolio && (
        <section className="prof-page-section prof-portfolio">
          <h2 className="prof-portfolio__title">Trabajos</h2>
          <div className="prof-portfolio__carousel">
            {portfolioUrls.map((url) => (
              <button
                key={url}
                type="button"
                className="prof-portfolio__item"
                onClick={() => setLightboxUrl(url)}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="prof-page-section">
        <div className="prof-section-header">
          <h2 className="prof-section-title">Servicios</h2>
        </div>

        <div className="prof-services">
          {Object.keys(servicesByCategory).length === 0 ? (
            <p className="prof-services__empty">
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
      {hasReviews && (
        <section className="prof-page-section prof-reviews">
          <h2 className="prof-section-title prof-reviews__title">Reseñas</h2>
          <div className="prof-reviews__list">
            {displayedReviews.map((r) => (
              <div key={r.id} className="prof-reviews__item">
                <span className="prof-reviews__client">{r.clientName}</span>
                <div className="prof-reviews__row">
                  <span
                    className="prof-reviews__stars"
                    aria-label={`${r.rating} estrellas`}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className="prof-reviews__star"
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
                  </span>

                  <span className="prof-reviews__date">
                    {r.createdAt?.toDate
                      ? formatDistanceToNow(r.createdAt.toDate(), {
                          locale: es,
                          addSuffix: true,
                        })
                      : r.date?.toDate
                        ? formatDistanceToNow(r.date.toDate(), {
                            locale: es,
                            addSuffix: true,
                          })
                        : ""}
                  </span>
                </div>
                {r.serviceNames?.length > 0 && (
                  <div className="prof-reviews__chips">
                    {r.serviceNames.map((name) => (
                      <span key={name} className="prof-reviews__chip">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {r.comment && (
                  <p className="prof-reviews__comment">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
          {hasMoreReviews && !reviewsExpanded && (
            <button
              type="button"
              className="prof-reviews__expand"
              onClick={() => setReviewsExpanded(true)}
            >
              Ver todas las reseñas
            </button>
          )}
        </section>
      )}
      {selectedServiceIds.size > 0 && (
        <div className="booking-sticky">
          <div className="booking-sticky__summary">
            <span className="booking-sticky__count">
              {selectedServiceIds.size} servicio
              {selectedServiceIds.size > 1 ? "s" : ""}
            </span>
            <span className="booking-sticky__total">
              {formatPrice(totalPrice)} · {totalDuration} min
            </span>
          </div>
          <button
            type="button"
            className="btn-primary booking-sticky__btn"
            onClick={handleReservar}
          >
            Reservar <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {lightboxUrl && (
        <div
          ref={lightboxRef}
          className="prof-lightbox"
          onClick={() => setLightboxUrl(null)}
          role="button"
          tabIndex={-1}
          aria-label="Cerrar (clic o Escape)"
        >
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}