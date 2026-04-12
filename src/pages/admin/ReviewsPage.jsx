import { useAuth } from "../../context/AuthContext.jsx";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, XCircle } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import {
  usePendingReviews,
  useApprovedReviews,
} from "../../hooks/useReviews.js";
import { updateReviewStatus } from "../../lib/firestore/reviews.js";
import "./ReviewsPage.css";

const STAR_COLOR = "#f4b942";

function ReviewCard({ review, onApprove, onReject, showActions }) {
  const dateObj =
    review.date?.toDate?.() ?? review.createdAt?.toDate?.() ?? new Date();
  const dateStr = format(dateObj, "d MMM yyyy", { locale: es });

  return (
    <div className="reviews-card">
      <div className="reviews-card__row">
        <span className="reviews-card__client">{review.clientName}</span>
        <span
          className="reviews-card__stars"
          aria-label={`${review.rating} estrellas`}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="reviews-card__star"
              style={{
                color:
                  i <= review.rating
                    ? STAR_COLOR
                    : "var(--color-text-tertiary)",
              }}
            >
              ★
            </span>
          ))}
        </span>
      </div>
      <p className="reviews-card__pro">
        con{" "}
        {Array.isArray(review.professionalNames) &&
        review.professionalNames.length > 0
          ? review.professionalNames.join(", ")
          : (review.professionalName ?? "—")}
      </p>
      {review.serviceNames?.length > 0 && (
        <p className="reviews-card__services">
          Servicios: {review.serviceNames.join(", ")}
        </p>
      )}
      {review.comment && (
        <p className="reviews-card__comment">{review.comment}</p>
      )}
      <p className="reviews-card__date">{dateStr}</p>
      {showActions && (
        <div className="reviews-card__actions">
          <button
            type="button"
            className="reviews-card__btn reviews-card__btn--approve"
            onClick={() => onApprove(review.id)}
          >
            <CheckCircle2 size={16} /> Aprobar
          </button>
          <button
            type="button"
            className="reviews-card__btn reviews-card__btn--reject"
            onClick={() => onReject(review.id)}
          >
            <XCircle size={16} /> Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage({ embedded = false }) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: pending = [],
    isLoading: pendingLoading,
    isError: pendingError,
    error: pendingErrorDetail,
  } = usePendingReviews(tenantId);
  const {
    data: approved = [],
    isLoading: approvedLoading,
    isError: approvedError,
    error: approvedErrorDetail,
  } = useApprovedReviews(tenantId);
  const hasError = pendingError || approvedError;
  const errorMessage =
    pendingErrorDetail?.message || approvedErrorDetail?.message;

  async function handleUpdateStatus(reviewId, status) {
    try {
      await updateReviewStatus(tenantId, reviewId, status);
      queryClient.invalidateQueries({
        queryKey: ["reviews-pending", tenantId],
      });
      queryClient.invalidateQueries({ queryKey: ["reviews", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["reviews-prof", tenantId] });
    } catch (err) {
      console.error("Error al actualizar reseña:", err);
    }
  }

  const content = (
    <div className="reviews-page">

      {!tenantId && (
        <p className="reviews-section__empty reviews-section__error">
          No se pudo cargar tu negocio. Cierra sesión y vuelve a entrar.
        </p>
      )}

      {tenantId && hasError && (
        <div className="reviews-section__error-box">
          <p className="reviews-section__error">
            No se pudieron cargar las reseñas. {errorMessage}
          </p>
          <p className="reviews-section__error-hint">
            Si el error menciona &quot;index&quot;, crea el índice en Firebase
            Console → Firestore → Indexes (o abre la consola del navegador para
            ver el enlace que Firestore suele mostrar).
          </p>
        </div>
      )}

      <section className="reviews-section">
        <h2 className="reviews-section__title">Pendientes de aprobación</h2>
        {!tenantId ? null : pendingLoading ? (
          <p className="reviews-section__empty">Cargando...</p>
        ) : pending.length === 0 ? (
          <p className="reviews-section__empty">No hay reseñas pendientes 🎉</p>
        ) : (
          <div className="reviews-list">
            {pending.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={(id) => handleUpdateStatus(id, "approved")}
                onReject={(id) => handleUpdateStatus(id, "rejected")}
                showActions
              />
            ))}
          </div>
        )}
      </section>

      <div className="reviews-divider" aria-hidden="true" />

      <section className="reviews-section">
        <h2 className="reviews-section__title">Reseñas publicadas</h2>
        {approvedLoading ? (
          <p className="reviews-section__empty">Cargando...</p>
        ) : approved.length === 0 ? (
          <p className="reviews-section__empty">
            Aún no hay reseñas publicadas.
          </p>
        ) : (
          <div className="reviews-list">
            {approved.map((review) => (
              <ReviewCard key={review.id} review={review} showActions={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );

  if (embedded) return content;

  return <AdminLayout title="Reseñas">{content}</AdminLayout>;
}
