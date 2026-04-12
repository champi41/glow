// src/pages/admin/AgendaPage.jsx

import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBookingsByDate } from "../../hooks/useBookingsByDate.js";
import { useBlocksByDate } from "../../hooks/useBlocksByDate.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useTenantById } from "../../hooks/useTenantById.js";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice, getFirstName } from "../../utils/format.js";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import "./AgendaPage.css";

// ─── Helpers ─────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function generateHours(open, close) {
  const hours = [];
  for (let m = open; m < close; m += 30) {
    hours.push(minToTime(m));
  }
  return hours;
}

const STATUS_COLOR = {
  pending: "var(--color-warning)",
  confirmed: "var(--color-success)",
  completed: "var(--color-accent)",
  cancelled: "var(--color-text-tertiary)",
};

const STATUS_BG = {
  pending: "rgba(201,150,58,0.10)",
  confirmed: "rgba(74,124,89,0.10)",
  completed: "var(--color-accent-bg)",
  cancelled: "var(--color-surface-2)",
};

function isCancelledStatus(status) {
  return status === "cancelled" || status === "canceled";
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// ─── Bloque de reserva en la agenda ──────────────────────────
function AgendaBookingBlock({ item, booking, topPx, heightPx, onClick }) {
  return (
    <div
      className="agenda-block agenda-block--booking"
      style={{
        top: topPx,
        height: Math.max(heightPx, 28),
        borderLeftColor: STATUS_COLOR[booking.status],
        background: STATUS_BG[booking.status],
      }}
      onClick={() => onClick(booking)}
      title={`${item.startTime}–${item.endTime} · ${booking.clientName}`}
    >
      <span className="agenda-block__time">{item.startTime}</span>
      <span className="agenda-block__name">{booking.clientName}</span>
      <span className="agenda-block__service">{item.serviceName}</span>
    </div>
  );
}

// ─── Bloque de bloqueo en la agenda ──────────────────────────
function AgendaBlockBlock({ block, topPx, heightPx, onClick }) {
  return (
    <div
      className="agenda-block agenda-block--block"
      style={{ top: topPx, height: Math.max(heightPx, 28) }}
      title={
        block.reason
          ? "Toca para quitar el bloqueo"
          : "Bloqueado. Toca para quitar"
      }
      onClick={onClick}
      role="button"
    >
      <Lock size={10} />
      <span className="agenda-block__time">{block.startTime}</span>
      {block.reason && (
        <span className="agenda-block__service">{block.reason}</span>
      )}
    </div>
  );
}

// ─── Columna de un profesional ────────────────────────────────
function ProfColumn({
  prof,
  bookings,
  blocks,
  hours,
  openMin,
  pxPerMin,
  onBookingClick,
  onToggleBlock,
}) {
  // Ítems de reservas que corresponden a este profesional,
  // agrupados por reserva para evitar bloques solapados cuando
  // hay varios servicios consecutivos con el mismo profesional.
  const profBookingItems = useMemo(() => {
    const byBooking = new Map();

    for (const booking of bookings) {
      for (const item of booking.items || []) {
        if (item.professionalId !== prof.id) continue;

        const existing = byBooking.get(booking.id);
        if (!existing) {
          // Clonamos el item para poder modificarlo sin tocar el original
          byBooking.set(booking.id, {
            booking,
            item: { ...item },
          });
        } else {
          const aggItem = existing.item;

          // Unimos los nombres de servicios
          aggItem.serviceName = `${aggItem.serviceName}, ${item.serviceName}`;

          // Ajustamos rango de tiempo por si difiere (compatibilidad futura)
          if (timeToMin(item.startTime) < timeToMin(aggItem.startTime)) {
            aggItem.startTime = item.startTime;
          }
          if (timeToMin(item.endTime) > timeToMin(aggItem.endTime)) {
            aggItem.endTime = item.endTime;
          }
        }
      }
    }

    const aggregated = Array.from(byBooking.values());

    // Regla anti-solapamiento por estado:
    // si un bloque cancelado se cruza con uno activo en el mismo profesional,
    // se oculta el cancelado para priorizar la reserva vigente.
    const active = aggregated.filter(
      ({ booking }) => !isCancelledStatus(booking.status),
    );
    const cancelled = aggregated.filter(({ booking }) =>
      isCancelledStatus(booking.status),
    );

    const visibleCancelled = cancelled.filter(({ item }) => {
      const cStart = timeToMin(item.startTime);
      const cEnd = timeToMin(item.endTime);
      return !active.some(({ item: activeItem }) => {
        const aStart = timeToMin(activeItem.startTime);
        const aEnd = timeToMin(activeItem.endTime);
        return rangesOverlap(cStart, cEnd, aStart, aEnd);
      });
    });

    return [...active, ...visibleCancelled];
  }, [bookings, prof.id]);

  // Bloqueos de este profesional
  const profBlocks = useMemo(
    () => blocks.filter((b) => b.professionalId === prof.id),
    [blocks, prof.id],
  );

  return (
    <div className="agenda-col">
      {/* Cuerpo con slots */}
      <div
        className="agenda-col__body"
        style={{ height: hours.length * 30 * 2 }}
      >
        {/* Líneas de hora */}
        {hours.map((hour, i) => {
          const isBlocked = blocks.some(
            (b) => b.professionalId === prof.id && b.startTime === hour,
          );
          return (
            <div
              key={hour}
              className={`agenda-hour-line ${isBlocked ? "agenda-hour-line--blocked" : "agenda-hour-line--empty"}`}
              style={{ top: i * 30 * pxPerMin, height: 30 * pxPerMin }}
              onClick={() => onToggleBlock(hour)}
              title={isBlocked ? "Toca para desbloquear" : "Toca para bloquear"}
            />
          );
        })}

        {/* Bloques de reservas */}
        {profBookingItems.map(({ booking, item }, i) => {
          const startMin = timeToMin(item.startTime) - openMin;
          const endMin = timeToMin(item.endTime) - openMin;
          const topPx = startMin * pxPerMin;
          const heightPx = (endMin - startMin) * pxPerMin;
          return (
            <AgendaBookingBlock
              key={`${booking.id}-${i}`}
              item={item}
              booking={booking}
              topPx={topPx}
              heightPx={heightPx}
              onClick={onBookingClick}
            />
          );
        })}

        {/* Bloques de bloqueos */}
        {profBlocks.map((block, i) => {
          const startMin = timeToMin(block.startTime) - openMin;
          const endMin = timeToMin(block.endTime) - openMin;
          const topPx = startMin * pxPerMin;
          const heightPx = (endMin - startMin) * pxPerMin;
          return (
            <AgendaBlockBlock
              key={`block-${i}`}
              block={block}
              topPx={topPx}
              heightPx={heightPx}
              onClick={() => onToggleBlock(block.startTime)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Vista de un día ──────────────────────────────────────────
function DayView({
  dateStr,
  tenant,
  professionals,
  onBookingClick,
  onToggleBlock,
}) {
  const { tenantId } = useAuth();
  const { data: bookings = [] } = useBookingsByDate(tenantId, dateStr);
  const { data: blocks = [] } = useBlocksByDate(tenantId, dateStr);

  const dayName = format(parseISO(dateStr), "EEEE").toLowerCase();
  const bh = tenant?.businessHours?.[dayName];

  if (!bh?.isOpen) {
    return (
      <div className="agenda-closed">
        <p>Cerrado</p>
      </div>
    );
  }

  const openMin = timeToMin(bh.open);
  const closeMin = timeToMin(bh.close);
  const hours = generateHours(openMin, closeMin);
  const pxPerMin = 2; // 2px por minuto → 30min = 60px

  return (
    <div className="day-view">
      {/* Eje de horas */}
      <div className="agenda-time-axis">
        <div
          className="agenda-time-axis__body"
          style={{ height: hours.length * 30 * pxPerMin }}
        >
          {hours.map((hour, i) => (
            <div
              key={hour}
              className="agenda-time-label"
              style={{ top: i * 30 * pxPerMin }}
            >
              {hour}
            </div>
          ))}
        </div>
      </div>

      {/* Columnas por profesional (ocupan todo el ancho) */}
      <div className="agenda-cols">
        {professionals
          .filter((p) => p.isActive)
          .map((prof) => (
            <ProfColumn
              key={prof.id}
              prof={prof}
              bookings={bookings}
              blocks={blocks}
              hours={hours}
              openMin={openMin}
              pxPerMin={pxPerMin}
              onBookingClick={onBookingClick}
              onToggleBlock={(timeStr) =>
                onToggleBlock(prof.id, dateStr, timeStr, blocks)
              }
            />
          ))}
      </div>
    </div>
  );
}

// ─── Modal de detalle de reserva ─────────────────────────────
function BookingModal({ booking, onClose, onUpdateStatus }) {
  if (!booking) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3 className="modal-card__title">{booking.clientName}</h3>
          <button className="modal-card__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body">
          {booking.items?.map((item, i) => (
            <div key={i} className="modal-item">
              <span className="modal-item__service">{item.serviceName}</span>
              <span className="modal-item__meta">
                con {getFirstName(item.professionalName)}
                {" · "}
                {item.startTime}–{item.endTime}
              </span>
              <span className="modal-item__price">
                {formatPrice(item.price)}
              </span>
            </div>
          ))}

          <div className="modal-total">
            <span>Total</span>
            <span>{formatPrice(booking.totalPrice)}</span>
          </div>

          <a
            href={`https://wa.me/${booking.clientPhone?.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="modal-whatsapp"
          >
            📱 {booking.clientPhone}
          </a>
        </div>

        <div className="modal-card__actions">
          {booking.status === "pending" && (
            <>
              <button
                className="action-btn action-btn--confirm"
                onClick={() => {
                  onUpdateStatus(booking.id, "confirmed");
                  onClose();
                }}
              >
                Confirmar
              </button>
              <button
                className="action-btn action-btn--cancel"
                onClick={() => {
                  onUpdateStatus(booking.id, "cancelled");
                  onClose();
                }}
              >
                Cancelar
              </button>
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              <button
                className="action-btn action-btn--complete"
                onClick={() => {
                  onUpdateStatus(booking.id, "completed");
                  onClose();
                }}
              >
                Completada
              </button>
              <button
                className="action-btn action-btn--cancel"
                onClick={() => {
                  onUpdateStatus(booking.id, "cancelled");
                  onClose();
                }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function AgendaPage() {
  const { tenantId, professionalId } = useAuth();
  const queryClient = useQueryClient();
  const today = startOfToday();

  const [weekStart, setWeekStart] = useState(
    startOfWeek(today, { weekStartsOn: 1 }), // semana empieza lunes
  );
  const [selectedDay, setSelectedDay] = useState(format(today, "yyyy-MM-dd"));
  const [selectedBooking, setSelectedBooking] = useState(null);

  const { data: tenant } = useTenantById(tenantId);
  const { data: professionals = [] } = useProfessionals(tenantId);

  // Días de la semana actual
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  function prevWeek() {
    setWeekStart((d) => addDays(d, -7));
  }

  function nextWeek() {
    setWeekStart((d) => addDays(d, 7));
  }

  async function handleUpdateStatus(bookingId, newStatus) {
    try {
      await updateDoc(doc(db, "tenants", tenantId, "bookings", bookingId), {
        status: newStatus,
      });
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDay],
      });
    } catch (err) {
      console.error("Error al actualizar reserva:", err);
    }
  }
  async function handleToggleBlock(profId, dateStr, timeStr, blocks = []) {
    // Ver si ya existe un bloqueo en ese slot
    const existing = blocks.find(
      (b) => b.professionalId === profId && b.startTime === timeStr,
    );

    try {
      if (existing) {
        // Eliminar bloqueo
        await deleteDoc(doc(db, "tenants", tenantId, "blocks", existing.id));
      } else {
        // Crear bloqueo de 30 min
        const [h, m] = timeStr.split(":").map(Number);
        const endMin = h * 60 + m + 30;
        const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

        await addDoc(collection(db, "tenants", tenantId, "blocks"), {
          professionalId: profId,
          dateStr,
          date: Timestamp.fromDate(parseISO(dateStr)),
          startTime: timeStr,
          endTime,
          reason: "",
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["blocks-date", tenantId, dateStr],
      });
    } catch (err) {
      console.error("Error al togglear bloqueo:", err);
    }
  }
  return (
    <AdminLayout title="Agenda">
      <div className="agenda-page">
        <div className="agendaHeader">
          <div className="admin-page-header">
            <h1 className="admin-page-title">Agenda</h1>
            {/* Navegación de semana */}
            <div className="week-nav">
              <button className="week-nav__btn" onClick={prevWeek}>
                <ChevronLeft size={18} />
              </button>
              <span className="week-nav__label">
                {format(weekStart, "d MMM", { locale: es })}
                {" – "}
                {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
              </span>
              <button className="week-nav__btn" onClick={nextWeek}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Selector de día */}
          <div className="week-days">
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isToday = dateStr === format(today, "yyyy-MM-dd");
              const selected = dateStr === selectedDay;

              return (
                <button
                  key={dateStr}
                  className={[
                    "week-day-chip",
                    selected ? "week-day-chip--selected" : "",
                    isToday ? "week-day-chip--today" : "",
                  ].join(" ")}
                  onClick={() => setSelectedDay(dateStr)}
                >
                  <span className="week-day-chip__name">
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span className="week-day-chip__num">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vista del día seleccionado */}
        <div className="agenda-scroll-wrap">
          <DayView
            dateStr={selectedDay}
            tenant={tenant}
            professionals={professionals.filter((p) => p.id === professionalId)}
            onBookingClick={setSelectedBooking}
            onToggleBlock={handleToggleBlock}
          />
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </AdminLayout>
  );
}
