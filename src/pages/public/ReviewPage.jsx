import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import {
  getBookingById,
  getReviewByBookingId,
  createReview,
} from "../../lib/firestore/reviews.js";
import Spinner from "../../components/ui/Spinner.jsx";
import "./ReviewPage.css";

const COMMENT_MAX = 300;
const STAR_COLOR = "#f4b942";
const STAR_COLOR_OFF = "var(--color-text-tertiary)";

export default function ReviewPage() {
  const { slug, bookingId } = useParams();
  const queryClient = useQueryClient();
  const { data: tenant, isLoading: tenantLoading } = useTenant(slug);
  useApplyTheme(tenant);

  const tenantId = tenant?.id;

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["booking-review", tenantId, bookingId],
    queryFn: () => getBookingById(tenantId, bookingId),
    enabled: !!tenantId && !!bookingId,
  });

  const { data: existingReview, isLoading: reviewCheckLoading } = useQuery({
    queryKey: ["review-by-booking", tenantId, bookingId],
    queryFn: () => getReviewByBookingId(tenantId, bookingId),
    enabled: !!tenantId && !!bookingId,
  });

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // No esperar a reviewCheckLoading para mostrar el formulario (mejor tiempo de carga)
  const isLoading = tenantLoading || bookingLoading;

  const displayRating = hoverRating || rating;
  const items = booking?.items ?? [];
  const professionalIds = [...new Set(items.map((i) => i.professionalId).filter(Boolean))];
  const professionalNames = [...new Map(items.map((i) => [i.professionalId, i.professionalName])).values()];
  const professionalLabel =
    professionalNames.length === 0
      ? ""
      : professionalNames.length === 1
        ? professionalNames[0]
        : professionalNames.slice(0, -1).join(", ") + " y " + professionalNames[professionalNames.length - 1];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tenantId || !booking || rating < 1) return;
    setError(null);
    setSubmitting(true);
    try {
      await createReview(tenantId, {
        bookingId: booking.id,
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        professionalIds,
        professionalNames,
        serviceNames: items.map((i) => i.serviceName),
        rating,
        comment: comment.trim() || null,
        date: booking.date,
      });
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["review-by-booking", tenantId, bookingId] });
    } catch (err) {
      setError(err.message || "No se pudo enviar la reseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="review-page review-page--loading">
        <Spinner />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="review-page review-page--error">
        <p>Negocio no encontrado.</p>
      </div>
    );
  }

  if (!booking || booking.status !== "completed") {
    return (
      <div className="review-page review-page--error">
        <p>Este link no es válido o ya expiró.</p>
      </div>
    );
  }

  // Si ya cargó la comprobación y existe reseña, mostrar mensaje (puede llegar después del form)
  if (existingReview && !reviewCheckLoading) {
    return (
      <div className="review-page review-page--done">
        <div className="review-page__box">
          <p className="review-page__message">
            Ya dejaste una reseña para esta reserva. ¡Gracias!
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="review-page review-page--success">
        <div className="review-page__box">
          <CheckCircle2 size={48} className="review-page__success-icon" aria-hidden="true" />
          <p className="review-page__success-text">
            ¡Gracias por tu reseña! Será publicada pronto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <div className="review-page__inner">
        <header className="review-page__header">
          {tenant.logoUrl && (
            <img src={tenant.logoUrl} alt="" className="review-page__logo" />
          )}
          <h1 className="review-page__title">{tenant.name}</h1>
        </header>

        <form className="review-form" onSubmit={handleSubmit}>
          <p className="review-form__prompt">
            ¿Cómo fue tu experiencia{professionalLabel ? ` con ${professionalLabel}` : ""}?
          </p>
          {items.length > 0 && (
            <>
              <p className="review-form__services-label">Servicios</p>
              <div className="review-form__chips">
                {items.map((item) => (
                  <span key={`${item.serviceName}-${item.professionalId}`} className="review-form__chip">
                    {item.serviceName}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="review-form__stars-wrap">
            <div
              className="review-form__stars"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="review-form__star"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  aria-label={`${value} estrella${value > 1 ? "s" : ""}`}
                  aria-pressed={rating >= value}
                >
                  <span
                    className="review-form__star-inner"
                    style={{
                      color: displayRating >= value ? STAR_COLOR : STAR_COLOR_OFF,
                    }}
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="review-form__field">
            <textarea
              className="review-form__comment"
              placeholder="Cuéntanos sobre tu experiencia... (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              rows={4}
              maxLength={COMMENT_MAX}
            />
            <span className="review-form__count">{comment.length}/{COMMENT_MAX}</span>
          </div>

          {error && <p className="review-form__error">{error}</p>}

          <button
            type="submit"
            className="btn-primary review-form__submit"
            disabled={submitting || rating < 1}
          >
            {submitting ? "Enviando..." : "Enviar reseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
