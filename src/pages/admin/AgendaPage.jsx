// src/pages/admin/AgendaPage.jsx

import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
  Timestamp,
  setDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBookingsByDate } from "../../hooks/useBookingsByDate.js";
import { useBlocksByDate } from "../../hooks/useBlocksByDate.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useTenantById } from "../../hooks/useTenantById.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatEntityPrice,
  formatTotalPrice,
  getFirstName,
} from "../../utils/format.js";
import {
  getEntityPriceInfo,
  normalizePriceType,
  formatPrice,
} from "../../utils/format.js";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import { releaseBookingSlots } from "../../lib/firestore/bookings.js";
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
      title={`${item.startTime} - ${item.endTime} · ${booking.clientName}`}
    >
      <span className="agenda-block__time">
        {item.startTime} - {item.endTime}
      </span>
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
function BookingModal({ booking, onClose, onUpdateStatus, professionalId }) {
  if (!booking) return null;

  const totalProfessionals = Array.isArray(booking.items)
    ? new Set(booking.items.map((it) => it.professionalId)).size
    : 0;
  const confirmedCount = Array.isArray(booking.professionalsConfirmed)
    ? booking.professionalsConfirmed.length
    : 0;
  const myConfirmed =
    professionalId &&
    Array.isArray(booking.professionalsConfirmed) &&
    booking.professionalsConfirmed.includes(professionalId);

  function getBookingStartTimeForProfessionalLocal(booking, professionalId) {
    const items = Array.isArray(booking?.items) ? booking.items : [];
    const relevant = professionalId
      ? items.filter((i) => i?.professionalId === professionalId)
      : [];
    const list = relevant.length ? relevant : items;
    const times = list
      .map((i) => i?.startTime)
      .filter((t) => typeof t === "string" && t.length > 0)
      .sort();
    return times[0] || "";
  }

  function canCompleteNow(booking) {
    const startTime = getBookingStartTimeForProfessionalLocal(
      booking,
      professionalId,
    );
    const dateStr = booking.dateStr || booking.date;
    if (!dateStr || !startTime) return true;
    try {
      const dt = parseISO(`${dateStr}T${startTime}:00`);
      return new Date() >= dt;
    } catch (err) {
      console.warn("Error parseando fecha de reserva:", err);
      return true;
    }
  }

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
                {formatEntityPrice(item)}
              </span>
            </div>
          ))}

          <div className="modal-total">
            <span>Total</span>
            <span>{formatTotalPrice(booking.items)}</span>
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
                  if (!myConfirmed) onUpdateStatus(booking.id, "confirmed");
                  onClose();
                }}
                disabled={Boolean(myConfirmed)}
                title={myConfirmed ? "Ya confirmaste" : "Confirmar reserva"}
              >
                {myConfirmed ? "Confirmado" : "Confirmar"}
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
              {totalProfessionals > 1 && (
                <div style={{ marginLeft: 12 }}>
                  <span className="badge badge--muted">
                    {confirmedCount}/{totalProfessionals}
                  </span>
                </div>
              )}
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              {!(
                professionalId &&
                Array.isArray(booking.professionalsCompleted) &&
                booking.professionalsCompleted.includes(professionalId)
              ) ? (
                <button
                  className="action-btn action-btn--complete"
                  onClick={() => {
                    if (!canCompleteNow(booking)) {
                      alert(
                        "No puedes marcar como completada antes de la hora de inicio de la reserva.",
                      );
                      return;
                    }
                    onUpdateStatus(booking.id, "completed");
                    onClose();
                  }}
                >
                  Completada
                </button>
              ) : (
                <button className="action-btn" disabled>
                  Completada
                </button>
              )}
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
  // Estado para completar reserva (modal de cobro)
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeBooking, setCompleteBooking] = useState(null);
  const [completeServiceAmounts, setCompleteServiceAmounts] = useState({});
  const [completeServiceMethods, setCompleteServiceMethods] = useState({});
  const [completeError, setCompleteError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

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
    // Si se marca como completada, abrir modal para ingresar cobros/metodo
    if (newStatus === "completed") {
      let booking =
        selectedBooking && selectedBooking.id === bookingId
          ? selectedBooking
          : null;
      if (!booking) {
        try {
          const snap = await getDoc(
            doc(db, "tenants", tenantId, "bookings", bookingId),
          );
          if (snap.exists()) booking = { id: snap.id, ...snap.data() };
        } catch (err) {
          console.error("Error obteniendo reserva:", err);
        }
      }
      if (!booking) {
        try {
          await updateDoc(doc(db, "tenants", tenantId, "bookings", bookingId), {
            status: newStatus,
            completedAt: Timestamp.now(),
          });
          queryClient.invalidateQueries({
            queryKey: ["bookings-date", tenantId, selectedDay],
          });
        } catch (err) {
          console.error("Error al actualizar reserva:", err);
        }
        return;
      }

      // Si el usuario es un profesional, verificar que la reserva incluya servicios suyos
      const myItems = professionalId
        ? (booking.items || []).filter(
            (i) => i.professionalId === professionalId,
          )
        : booking.items || [];
      if (professionalId && (!myItems || myItems.length === 0)) {
        return;
      }

      // Evitar abrir modal si ya completó su parte
      if (
        professionalId &&
        Array.isArray(booking.professionalsCompleted) &&
        booking.professionalsCompleted.includes(professionalId)
      ) {
        return;
      }

      // abrir modal con valores sugeridos
      openCompleteModal(booking);
      return;
    }

    try {
      const payload = {
        status: newStatus,
        ...(newStatus === "cancelled" ? { cancelledBy: "professional" } : {}),
      };
      await updateDoc(
        doc(db, "tenants", tenantId, "bookings", bookingId),
        payload,
      );
      if (newStatus === "cancelled") {
        const booking =
          selectedBooking && selectedBooking.id === bookingId
            ? selectedBooking
            : (bookings || []).find((b) => b.id === bookingId);
        if (booking?.slotIds?.length) {
          await releaseBookingSlots(tenantId, booking.slotIds);
        }
      }
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

  function openCompleteModal(booking) {
    setCompleteBooking(booking);
    const amounts = {};
    const methods = {};
    const itemsToInit = professionalId
      ? (booking.items || []).filter((i) => i.professionalId === professionalId)
      : booking.items || [];
    for (const item of itemsToInit) {
      const sid = item.serviceId || item.serviceId;
      const info = getEntityPriceInfo(item);
      let suggested = 0;
      if (info.kind === "fixed") suggested = info.amount || 0;
      else if (info.kind === "range") suggested = info.min || 0;
      else suggested = 0;
      amounts[sid] = suggested;
      methods[sid] = "efectivo";
    }
    setCompleteServiceAmounts(amounts);
    setCompleteServiceMethods(methods);
    setCompleteError(null);
    setCompleteModalOpen(true);
  }

  function handleSetCompleteAmount(serviceId, value) {
    setCompleteServiceAmounts((prev) => ({ ...prev, [serviceId]: value }));
  }

  function handleSetCompleteMethod(serviceId, method) {
    setCompleteServiceMethods((prev) => ({ ...prev, [serviceId]: method }));
  }

  async function handleConfirmComplete() {
    setCompleteError(null);
    if (!tenantId || !completeBooking) return;

    // Evitar que el mismo profesional marque su parte más de una vez
    if (
      professionalId &&
      Array.isArray(completeBooking.professionalsCompleted) &&
      completeBooking.professionalsCompleted.includes(professionalId)
    ) {
      setCompleteError("Ya marcaste tu parte como completada.");
      return;
    }
    const allItems = Array.isArray(completeBooking.items)
      ? completeBooking.items
      : [];
    const items = professionalId
      ? allItems.filter((it) => it.professionalId === professionalId)
      : allItems;
    const payments = [];
    let total = 0;

    for (const item of items) {
      const sid = item.serviceId || item.serviceId;
      const raw = completeServiceAmounts[sid];
      const amt = Number(raw || 0);
      const type = normalizePriceType(item?.priceType);
      if (
        (type === "range" || type === "tbd") &&
        (raw === undefined || raw === null || String(raw).trim() === "")
      ) {
        setCompleteError(
          "Ingresa el monto para todos los servicios con precio variable.",
        );
        return;
      }
      const method = completeServiceMethods[sid] || "efectivo";
      payments.push({
        serviceId: sid,
        serviceName: item.serviceName,
        professionalId: item.professionalId,
        amount: amt,
        method,
      });
      total += amt;
    }

    try {
      setIsCompleting(true);
      const bookingRef = doc(
        db,
        "tenants",
        tenantId,
        "bookings",
        completeBooking.id,
      );

      const updatePayload = { collectedTotal: increment(total) };
      const allItemsCount = allItems.length;
      const myItemsCount = items.length;
      if (myItemsCount > 0 && myItemsCount === allItemsCount) {
        updatePayload.status = "completed";
        updatePayload.completedAt = Timestamp.now();
      }
      if (payments.length > 0) updatePayload.payments = arrayUnion(...payments);
      if (professionalId)
        updatePayload.professionalsCompleted = arrayUnion(professionalId);

      await updateDoc(bookingRef, updatePayload);

      const now = new Date();
      const monthId = format(now, "yyyy-MM");
      const tenantReportRef = doc(db, "tenants", tenantId, "reports", monthId);
      const profReportRef = professionalId
        ? doc(
            db,
            "tenants",
            tenantId,
            "professionals",
            professionalId,
            "reports",
            monthId,
          )
        : null;

      const reportPayload = { totalEarned: increment(total) };
      const profReportPayload = { totalEarned: increment(total) };
      const methodTotals = {};
      const serviceTotals = {};
      for (const p of payments) {
        methodTotals[p.method] =
          (methodTotals[p.method] || 0) + (p.amount || 0);
        serviceTotals[p.serviceId] = serviceTotals[p.serviceId] || {
          count: 0,
          revenue: 0,
        };
        serviceTotals[p.serviceId].count += 1;
        serviceTotals[p.serviceId].revenue += p.amount || 0;
      }
      for (const [m, amt] of Object.entries(methodTotals)) {
        reportPayload[`paymentMethods.${m}`] = increment(amt);
        if (profReportRef)
          profReportPayload[`paymentMethods.${m}`] = increment(amt);
      }
      for (const [sid, stat] of Object.entries(serviceTotals)) {
        reportPayload[`services.${sid}.count`] = increment(stat.count);
        reportPayload[`services.${sid}.revenue`] = increment(stat.revenue);
        if (profReportRef) {
          profReportPayload[`services.${sid}.count`] = increment(stat.count);
          profReportPayload[`services.${sid}.revenue`] = increment(
            stat.revenue,
          );
        }
      }

      const updates = [setDoc(tenantReportRef, reportPayload, { merge: true })];
      if (profReportRef)
        updates.push(setDoc(profReportRef, profReportPayload, { merge: true }));
      await Promise.all(updates);
      // Invalidar queries relevantes para refrescar informes inmediatamente
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDay],
      });
      const monthIdForReport = monthId;
      queryClient.invalidateQueries({
        queryKey: ["monthly-report", tenantId],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: [
          "monthly-report",
          tenantId,
          professionalId,
          monthIdForReport,
        ],
      });
      setIsCompleting(false);
      setCompleteModalOpen(false);
    } catch (err) {
      console.error("Error al completar reserva y actualizar informe:", err);
      setCompleteError("Error al completar reserva. Intenta nuevamente.");
      setIsCompleting(false);
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
          <p className="agenda-instruction">
            Pulsa una hora vacia para bloquearla/desbloquearla.
          </p>
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
          professionalId={professionalId}
        />
      )}

      {/* Modal: Completar reserva (ingresar cobros y método) */}
      {completeModalOpen && completeBooking && (
        <div
          className="modal-overlay"
          onClick={() => setCompleteModalOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3 className="modal-card__title">
                Marcar reserva como completada
              </h3>
              <button
                className="modal-card__close"
                onClick={() => setCompleteModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-card__body modal-card__body--scroll">
              <p className="booking-detail__label">
                Reserva de: {completeBooking.clientName}
              </p>
              <p className="booking-detail__label">
                Servicios (ingresa monto cobrado por servicio)
              </p>

              {(
                (professionalId
                  ? completeBooking.items?.filter(
                      (it) => it.professionalId === professionalId,
                    )
                  : completeBooking.items) || []
              ).map((item, i) => {
                const sid = item.serviceId || item.serviceId;
                const amt = completeServiceAmounts[sid] ?? 0;
                const method = completeServiceMethods[sid] || "efectivo";
                const info = getEntityPriceInfo(item);
                const suggestedText =
                  info.kind === "fixed"
                    ? info.amount === 0
                      ? "Gratis"
                      : formatPrice(info.amount)
                    : info.kind === "range"
                      ? `${formatPrice(info.min)} - ${formatPrice(info.max)}`
                      : info.kind === "tbd"
                        ? "A definir"
                        : "";

                return (
                  <div key={i} className="modal-item">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div className="modal-item__service">
                          {item.serviceName}
                        </div>
                        <div className="modal-item__meta">{suggestedText}</div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          minWidth: 140,
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={amt}
                          onChange={(e) =>
                            handleSetCompleteAmount(sid, e.target.value)
                          }
                          className="date-input"
                        />
                        <select
                          value={method}
                          onChange={(e) =>
                            handleSetCompleteMethod(sid, e.target.value)
                          }
                          className="date-input"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="transferencia">Transferencia</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {completeError && (
                <p style={{ color: "var(--color-error)" }}>{completeError}</p>
              )}
            </div>

            <div className="modal-card__actions">
              <button
                className="action-btn action-btn--cancel"
                onClick={() => setCompleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="action-btn action-btn--confirm"
                onClick={handleConfirmComplete}
                disabled={isCompleting}
              >
                {isCompleting ? "Guardando..." : "Confirmar completada"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
