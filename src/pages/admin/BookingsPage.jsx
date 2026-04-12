import { useState, useMemo } from "react";
import { format, parseISO, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenantById } from "../../hooks/useTenant.js";
import { useBookingsByDate } from "../../hooks/useBookingsByDate.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice, getFirstName } from "../../utils/format.js";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import {
  Phone,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
} from "lucide-react";
import "./BookingsPage.css";

// ─── Helpers ─────────────────────────────────────────────────
const STATUS_LABEL = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_CLASS = {
  pending: "badge--warning",
  confirmed: "badge--success",
  completed: "badge--info",
  cancelled: "badge--muted",
};

const FILTERS = ["todas", "pending", "confirmed", "completed", "cancelled"];

const FILTER_LABEL = {
  todas: "Todas",
  pending: "Pendientes",
  confirmed: "Confirmadas",
  completed: "Completadas",
  cancelled: "Canceladas",
};

// ─── Componente de reserva ────────────────────────────────────
function BookingCard({
  booking,
  professionals,
  onUpdateStatus,
  onMarkDepositVerified,
  tenantSlug,
}) {
  const [expanded, setExpanded] = useState(false);

  const firstItem = booking.items?.[0];
  const profName = firstItem
    ? professionals.find((p) => p.id === firstItem.professionalId)?.name ||
      firstItem.professionalName
    : "—";

  return (
    <div className={`booking-card booking-card--${booking.status}`}>
      {/* Fila principal */}
      <div
        className="booking-card__main"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="booking-card__left">
          <div className="booking-card__time">
            {firstItem?.startTime || "—"}
          </div>
          <div className="booking-card__info">
            <span className="booking-card__client">{booking.clientName}</span>
            <span className="booking-card__meta">
              {booking.items?.map((i) => i.serviceName).join(", ")}
            </span>
            <span className="booking-card__prof">
              con {getFirstName(profName)}
              {booking.items?.length > 1 && ` +${booking.items.length - 1}`}
            </span>
          </div>
        </div>

        <div className="booking-card__right">
          <div className="booking-card__badges">
            <span className={`badge ${STATUS_CLASS[booking.status]}`}>
              {STATUS_LABEL[booking.status]}
            </span>
            {booking.depositStatus === "uploaded" && (
              <span className="badge badge--warning booking-card__deposit-badge">
                📎 Comprobante
              </span>
            )}
          </div>
          <span className="booking-card__price">
            {formatPrice(booking.totalPrice)}
          </span>
          {expanded ? (
            <ChevronUp size={16} className="booking-card__chevron" />
          ) : (
            <ChevronDown size={16} className="booking-card__chevron" />
          )}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="booking-card__detail">
          {/* Servicios */}
          <div className="booking-detail__section">
            <p className="booking-detail__label">Servicios</p>
            {booking.items?.map((item, i) => (
              <div key={i} className="booking-detail__item">
                <div className="booking-detail__item-info">
                  <span className="booking-detail__item-name">
                    {item.serviceName}
                  </span>
                  <span className="booking-detail__item-meta">
                    con {getFirstName(item.professionalName)}
                    {" · "}
                    {item.startTime}–{item.endTime}
                  </span>
                </div>
                <span className="booking-detail__item-price">
                  {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>

          {/* Cliente */}
          <div className="booking-detail__section">
            <p className="booking-detail__label">Cliente</p>
            <div className="booking-detail__client">
              <a
                href={`https://wa.me/${booking.clientPhone?.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="booking-detail__whatsapp"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="mr-2">{booking.clientName}</span>
                <Phone size={13} className="inline mr-1" />
                {booking.clientPhone}
              </a>
            </div>
          </div>

          {/* Abono */}
          {booking.depositRequired === true && (
            <div className="booking-detail__section">
              <p className="booking-detail__label">Abono</p>
              {booking.depositStatus === "pending" && (
                <p className="booking-detail__deposit-pending">
                  Esperando comprobante del cliente.
                </p>
              )}
              {booking.depositStatus === "uploaded" && (
                <>
                  <a
                    href={booking.depositProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="booking-detail__proof-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={booking.depositProofUrl}
                      alt="Comprobante"
                      className="booking-detail__proof-img"
                    />
                  </a>
                  <div className="booking-detail__actions">
                    <button
                      className="action-btn action-btn--cancel"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(booking.id, "cancelled");
                      }}
                    >
                      <XCircle size={15} /> Cancelar
                    </button>
                    <a
                      href={`https://wa.me/${booking.clientPhone?.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="action-btn booking-detail__whatsapp-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={15} /> Contactar cliente
                    </a>
                    <button
                      className="action-btn action-btn--confirm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkDepositVerified(booking.id);
                      }}
                    >
                      <CheckCircle2 size={15} /> Marcar abono verificado
                    </button>
                  </div>
                </>
              )}
              {booking.depositStatus === "verified" && (
                <p className="booking-detail__deposit-verified">
                  ✅ Abono verificado
                </p>
              )}
            </div>
          )}

          {/* Acciones según estado (ocultar si abono uploaded: ya hay acciones en sección Abono) */}
          {!(
            booking.depositRequired && booking.depositStatus === "uploaded"
          ) && (
            <div className="booking-detail__actions">
              {booking.status === "pending" && (
                <>
                  <button
                    className="action-btn action-btn--confirm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(booking.id, "confirmed");
                    }}
                  >
                    <CheckCircle2 size={15} /> Confirmar
                  </button>
                  <button
                    className="action-btn action-btn--cancel"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(booking.id, "cancelled");
                    }}
                  >
                    <XCircle size={15} /> Cancelar
                  </button>
                </>
              )}
              {booking.status === "confirmed" && (
                <>
                  <button
                    className="action-btn action-btn--complete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(booking.id, "completed");
                    }}
                  >
                    <CheckCircle2 size={15} /> Marcar completada
                  </button>
                  <button
                    className="action-btn action-btn--cancel"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(booking.id, "cancelled");
                    }}
                  >
                    <XCircle size={15} /> Cancelar
                  </button>
                </>
              )}
              {(booking.status === "completed" ||
                booking.status === "cancelled") && (
                <p className="booking-detail__final">
                  {booking.status === "completed"
                    ? "Reserva completada"
                    : "Reserva cancelada"}
                </p>
              )}
            </div>
          )}

          {booking.status === "completed" && tenantSlug && (
            <a
              href={`https://wa.me/${booking.clientPhone?.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hola ${booking.clientName} 👋 Gracias por visitarnos. ¿Nos dejas una reseña? Solo toma un minuto: ${(import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "")}/${tenantSlug}/reserva/${booking.id}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="action-btn action-btn--review"
              onClick={(e) => e.stopPropagation()}
            >
              ⭐ Pedir reseña por WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function BookingsPage() {
  const { tenantId, professionalId } = useAuth();
  const queryClient = useQueryClient();
  const today = format(startOfToday(), "yyyy-MM-dd");

  const { data: tenant } = useTenantById(tenantId);
  const tenantSlug = tenant?.slug;

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeFilter, setActiveFilter] = useState("todas");

  const { data: bookings = [], isLoading } = useBookingsByDate(
    tenantId,
    selectedDate,
  );
  const { data: professionals = [] } = useProfessionals(tenantId);

  // Filtrar por estado
  const filtered = useMemo(() => {
    const sorted = [...bookings]
      .filter((b) =>
        b.items?.some((item) => item.professionalId === professionalId),
      )
      .sort((a, b) => {
        const aTime = a.items?.[0]?.startTime || "";
        const bTime = b.items?.[0]?.startTime || "";
        return aTime.localeCompare(bTime);
      });

    if (activeFilter === "todas") return sorted;
    return sorted.filter((b) => b.status === activeFilter);
  }, [bookings, activeFilter, professionalId]);

  // Actualizar estado de una reserva
  async function handleUpdateStatus(bookingId, newStatus) {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "bookings", bookingId), {
        status: newStatus,
      });
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDate],
      });
    } catch (err) {
      console.error("Error al actualizar reserva:", err);
    }
  }

  // Marcar abono verificado y confirmar reserva
  async function handleMarkDepositVerified(bookingId) {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "bookings", bookingId), {
        depositStatus: "verified",
        status: "confirmed",
      });
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDate],
      });
    } catch (err) {
      console.error("Error al marcar abono verificado:", err);
    }
  }

  const formattedDate = format(parseISO(selectedDate), "EEEE d 'de' MMMM", {
    locale: es,
  });

  return (
    <AdminLayout title="Reservas">
      <div className="bookings-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Reservas</h1>
          {/* Selector de fecha */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
        </div>

        {/* Filtros de estado */}
        <p className="bookings-date-label">{formattedDate}</p>
        <div className="bookings-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={[
                "filter-chip",
                activeFilter === f ? "filter-chip--active" : "",
              ].join(" ")}
              onClick={() => setActiveFilter(f)}
            >
              {FILTER_LABEL[f]}
              {f !== "todas" && (
                <span className="filter-chip__count">
                  {bookings.filter((b) => b.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="bookings-loading">
            <Clock size={20} className="bookings-loading__icon" />
            <p>Cargando reservas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bookings-empty">
            <Circle size={32} strokeWidth={1} />
            <p>
              {activeFilter === "todas"
                ? "No hay reservas para este día."
                : `No hay reservas ${FILTER_LABEL[activeFilter].toLowerCase()}.`}
            </p>
          </div>
        ) : (
          <div className="bookings-list">
            {filtered.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                professionals={professionals}
                onUpdateStatus={handleUpdateStatus}
                onMarkDepositVerified={handleMarkDepositVerified}
                tenantSlug={tenantSlug}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
