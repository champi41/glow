// src/pages/public/BookingStatusPage.jsx

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { db } from "../../config/firebase.js";
import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import { formatPrice, getFirstName } from "../../utils/format.js";
import { generateICS } from "../../utils/ics.js";
import { useQuery } from "@tanstack/react-query";
import {
  getReviewByBookingId,
  createReview,
} from "../../lib/firestore/reviews.js";
import "./BookingStatusPage.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "djghs9u2k";

async function uploadToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "Reservas");
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Error al subir la imagen");
  }
  const data = await res.json();
  return data.secure_url;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pendiente de confirmación",
    icon: "🕐",
    class: "booking-status__badge--warning",
  },
  confirmed: {
    label: "Confirmada",
    icon: "✅",
    class: "booking-status__badge--success",
  },
  cancelled: {
    label: "Cancelada",
    icon: "❌",
    class: "booking-status__badge--error",
  },
  completed: {
    label: "Completada",
    icon: "⭐",
    class: "booking-status__badge--accent",
  },
};

export default function BookingStatusPage() {
  const { slug, bookingId } = useParams();
  const fileInputRef = useRef(null);

  const { data: tenant, isLoading: loadingTenant } = useTenant(slug);
  const tenantId = tenant?.id;

  const [booking, setBooking] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useApplyTheme(tenant);

  // Suscripción en tiempo real al booking
  useEffect(() => {
    if (!tenantId || !bookingId) return;

    const ref = doc(db, "tenants", tenantId, "bookings", bookingId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBooking(null);
          setNotFound(true);
          return;
        }
        setBooking({ id: snap.id, ...snap.data() });
        setNotFound(false);
      },
      (err) => {
        console.error("BookingStatusPage onSnapshot error", err);
        setNotFound(true);
      },
    );
    return () => unsub();
  }, [tenantId, bookingId]);

  // Comprobar si ya existe reseña asociada a esta reserva
  const { data: existingReview, isLoading: loadingExistingReview } = useQuery({
    queryKey: ["review-by-booking", tenantId, bookingId],
    queryFn: () => getReviewByBookingId(tenantId, bookingId),
    enabled: !!tenantId && !!bookingId,
  });

  const items = booking?.items ?? [];
  const professionalIds = [
    ...new Set(items.map((i) => i.professionalId).filter(Boolean)),
  ];
  const professionalNames = [
    ...new Map(
      items?.map((i) => [i.professionalId, i.professionalName]),
    ).values(),
  ];

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!tenantId || !booking) return;
    if (existingReview) return; // ya existe
    if (rating < 1) {
      setReviewError("Por favor selecciona una calificación.");
      return;
    }
    setReviewError(null);
    setSubmittingReview(true);
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
      setReviewSuccess(true);
    } catch (err) {
      setReviewError(err.message || "No se pudo enviar la reseña.");
    } finally {
      setSubmittingReview(false);
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !bookingId || !booking) return;

    setUploadError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const folder = `barberia/${tenantId}/deposits/${bookingId}`;
      const secureUrl = await uploadToCloudinary(file, folder);

      const ref = doc(db, "tenants", tenantId, "bookings", bookingId);
      await updateDoc(ref, {
        depositStatus: "uploaded",
        depositProofUrl: secureUrl,
      });
    } catch (err) {
      setUploadError(err.message || "Error al subir el comprobante.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const whatsappHref = tenant?.phone
    ? `https://wa.me/${tenant.phone.replace(/\D/g, "")}`
    : null;

  const canCancel =
    booking?.status === "pending" || booking?.status === "confirmed";

  async function handleCancelBooking() {
    if (!tenantId || !bookingId || !canCancel) return;
    const confirmed = window.confirm(
      "¿Estás seguro de que quieres cancelar esta reserva?",
    );
    if (!confirmed) return;

    setCancelError(null);
    setCancelling(true);
    try {
      const ref = doc(db, "tenants", tenantId, "bookings", bookingId);
      await updateDoc(ref, {
        status: "cancelled",
        cancelledBy: "client",
      });
      // onSnapshot actualizará la UI; Firebase Functions enviará la notificación a los profesionales
    } catch (err) {
      setCancelError(err.message || "No se pudo cancelar la reserva.");
    } finally {
      setCancelling(false);
    }
  }

  if (loadingTenant || (tenant && !booking && !notFound)) {
    return (
      <div className="booking-status-page booking-status-page--loading">
        <p className="booking-status-page__message">Cargando...</p>
      </div>
    );
  }

  if (!tenant || notFound || !booking) {
    return (
      <div className="booking-status-page booking-status-page--error">
        <p className="booking-status-page__message">Reserva no encontrada.</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const formattedDate = booking.dateStr
    ? format(parseISO(booking.dateStr), "EEEE d 'de' MMMM 'de' yyyy", {
        locale: es,
      })
    : "";
  const bank = tenant.deposit?.bankInfo;

  return (
    <div className="booking-status-page">
      <div className="booking-status-page__inner">
        <header className="booking-status-page__header">
          {tenant.logoUrl && (
            <img
              src={tenant.logoUrl}
              alt=""
              className="booking-status-page__logo"
            />
          )}
          <h1 className="booking-status-page__title">{tenant.name}</h1>
          <h2 className="booking-status-page__subtitle">Mi reserva</h2>
        </header>

        {/* Si la reserva está completada, mostrar formulario de reseña embebido */}
        {booking.status === "completed" && (
          <section className="booking-status__section booking-status__review review-page__inner">
            <div className="review-page__box">
              {!(existingReview || reviewSuccess) && (
                <h3 className="review-page__title">Deja tu reseña</h3>
              )}

              {loadingExistingReview ? (
                <p className="review-page__message">Cargando...</p>
              ) : existingReview ? (
                <p className="review-page__message">
                  Ya dejaste una reseña para esta reserva. ¡Gracias!
                </p>
              ) : reviewSuccess ? (
                <p className="review-page__message">
                  ¡Gracias por tu reseña! Será publicada pronto.
                </p>
              ) : (
                <form className="review-form" onSubmit={handleSubmitReview}>
                  <p className="review-form__prompt">
                    ¿Cómo fue tu experiencia
                    {professionalNames.length
                      ? ` con ${professionalNames.join(", ")}`
                      : ""}
                    ?
                  </p>

                  <div
                    className="review-form__stars-wrap"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <div className="review-form__stars">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="review-form__star"
                          onClick={() => setRating(v)}
                          onMouseEnter={() => setHoverRating(v)}
                          aria-pressed={rating >= v}
                        >
                          <span
                            className="review-form__star-inner"
                            style={{
                              color:
                                (hoverRating || rating) >= v
                                  ? "#f4b942"
                                  : "var(--color-text-tertiary)",
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
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, 300))}
                      placeholder="Cuéntanos sobre tu experiencia... (opcional)"
                      rows={4}
                    />
                    <div className="review-form__count">
                      {comment.length}/300
                    </div>
                  </div>

                  {reviewError && (
                    <p className="review-form__error">{reviewError}</p>
                  )}
                  <div className="review-form__submit">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={submittingReview || rating < 1}
                    >
                      {submittingReview ? "Enviando..." : "Enviar reseña"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}

        {/* Badges de estado */}
        <section className="booking-status__section">
          <div
            className={`booking-status__badge ${statusConfig.class}`}
            role="status"
          >
            <span className="booking-status__badge-icon">
              {statusConfig.icon}
            </span>
            {statusConfig.label}
          </div>

          {booking.depositRequired === true &&
            booking.depositStatus === "pending" && (
              <div className="booking-status__badge booking-status__badge--warning booking-status__deposit-badge">
                ⏳ Abono pendiente
              </div>
            )}

          {booking.depositStatus === "uploaded" && (
            <div className="booking-status__badge booking-status__badge--info booking-status__deposit-badge">
              📎 Comprobante enviado — esperando verificación
            </div>
          )}
        </section>

        {/* Detalles de la reserva */}
        <section className="booking-status__section booking-status__details">
          <p className="booking-status__date">{formattedDate}</p>
          {booking.items?.map((item, i) => (
            <div key={i} className="booking-status__item">
              <div className="booking-status__item-left">
                <span className="booking-status__item-name">
                  {item.serviceName}
                </span>
                <span className="booking-status__item-meta">
                  con {getFirstName(item.professionalName)}
                  {" · "}
                  {item.startTime} – {item.endTime}
                </span>
              </div>
              <span className="booking-status__item-price">
                {formatPrice(item.price)}
              </span>
            </div>
          ))}
          <div className="booking-status__total">
            <div className="booking-status__total-left">
              <span>Total</span>
              <span className="booking-status__total-duration">
                {booking.totalDuration} min
              </span>
            </div>
            <span className="booking-status__total-price">
              {formatPrice(booking.totalPrice)}
            </span>
          </div>
        </section>

        {/* Sección abono */}
        {booking.depositRequired === true && (
          <section className="booking-status__section booking-status__deposit">
            {booking.depositStatus === "pending" && (
              <>
                <div className="booking-status__deposit-card">
                  <p className="booking-status__deposit-amount">
                    {formatPrice(booking.depositAmount)}
                  </p>
                  {bank && (
                    <div className="booking-status__deposit-bank">
                      {bank.bank && <p>{bank.bank}</p>}
                      {bank.accountType && <p>{bank.accountType}</p>}
                      {bank.accountNumber && <p>{bank.accountNumber}</p>}
                      {bank.rut && <p>RUT: {bank.rut}</p>}
                      {bank.holderName && <p>{bank.holderName}</p>}
                    </div>
                  )}
                </div>
                <div className="booking-status__upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="booking-status__file-input"
                    onChange={handleFileChange}
                    disabled={uploading}
                    aria-label="Subir comprobante"
                  />
                  <button
                    type="button"
                    className="btn-primary booking-status__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Subiendo..." : "Subir comprobante"}
                  </button>
                  {previewUrl && !booking.depositProofUrl && (
                    <div className="booking-status__preview-wrap">
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        className="booking-status__preview"
                      />
                    </div>
                  )}
                  {uploadError && (
                    <p className="booking-status__upload-error">
                      {uploadError}
                    </p>
                  )}
                </div>
              </>
            )}

            {booking.depositStatus === "uploaded" && (
              <>
                {booking.depositProofUrl && (
                  <div className="booking-status__proof-wrap">
                    <img
                      src={booking.depositProofUrl}
                      alt="Comprobante enviado"
                      className="booking-status__proof-img"
                    />
                  </div>
                )}
                <p className="booking-status__deposit-uploaded-text">
                  Comprobante enviado. El equipo lo verificará pronto.
                </p>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary booking-status__whatsapp-btn"
                  >
                    Contactar por WhatsApp
                  </a>
                )}
              </>
            )}

            {booking.depositStatus === "verified" && (
              <p className="booking-status__deposit-verified">
                ✅ Abono verificado. Tu reserva está confirmada.
              </p>
            )}
          </section>
        )}

        {/* Acciones: calendario y cancelar */}
        {booking.status !== "cancelled" && (
          <div className="booking-status__actions">
            <button
              type="button"
              className="btn-outline booking-status__ics"
              onClick={() => generateICS(booking, tenant)}
            >
              Agregar al calendario
            </button>

            {canCancel && (
              <>
                <button
                  type="button"
                  className="btn-outline booking-status__cancel"
                  onClick={handleCancelBooking}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelando..." : "Cancelar reserva"}
                </button>
                {cancelError && (
                  <p className="booking-status__cancel-error">{cancelError}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
