import { useState, useMemo } from "react";
import { format, parseISO, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import {
  doc,
  updateDoc,
  Timestamp,
  setDoc,
  increment,
  arrayUnion,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";
// funciones removidas — usar lógica cliente
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenantById } from "../../hooks/useTenant.js";
import { useBookingsByDate } from "../../hooks/useBookingsByDate.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useServices } from "../../hooks/useServices.js";
import { useBlocksByDate } from "../../hooks/useBlocksByDate.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatEntityPrice,
  formatPrice,
  formatTotalPrice,
  getFirstName,
  getTotalPriceInfo,
  normalizePriceType,
  getEntityPriceInfo,
} from "../../utils/format.js";
import { calcAvailableSlots } from "../../utils/slots.js";
import { normalizeChileanPhone } from "../../utils/phone.js";
import { createBooking } from "../../lib/firestore/bookings.js";
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

function getBookingStartTimeForProfessional(booking, professionalId) {
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

// ─── Componente de reserva ────────────────────────────────────
function BookingCard({
  booking,
  professionals,
  professionalId,
  onUpdateStatus,
  onMarkDepositVerified,
  tenantSlug,
}) {
  const [expanded, setExpanded] = useState(false);

  const items = Array.isArray(booking?.items) ? booking.items : [];
  const profItems = professionalId
    ? items.filter((i) => i?.professionalId === professionalId)
    : [];
  const displayItems = profItems.length ? profItems : items;
  const displayStartTime = getBookingStartTimeForProfessional(
    booking,
    professionalId,
  );

  const profFromItems = displayItems?.[0]
    ? professionals.find((p) => p.id === displayItems[0].professionalId)
    : null;
  const profName =
    professionals.find((p) => p.id === professionalId)?.name ||
    profFromItems?.name ||
    displayItems?.[0]?.professionalName ||
    "—";

  const servicesLabel = displayItems.map((i) => i?.serviceName).filter(Boolean);
  const extraCount = Math.max(0, displayItems.length - 1);

  const myCompleted =
    professionalId &&
    Array.isArray(booking.professionalsCompleted) &&
    booking.professionalsCompleted.includes(professionalId);

  const myConfirmed =
    professionalId &&
    Array.isArray(booking.professionalsConfirmed) &&
    booking.professionalsConfirmed.includes(professionalId);

  const confirmedCount = Array.isArray(booking.professionalsConfirmed)
    ? booking.professionalsConfirmed.length
    : 0;

  function canCompleteNow(booking) {
    const startTime = getBookingStartTimeForProfessional(
      booking,
      professionalId,
    );
    const dateStr = booking.dateStr || booking.date;
    if (!dateStr || !startTime) {
      return true;
    }
    try {
      const dt = parseISO(`${dateStr}T${startTime}:00`);
      return new Date() >= dt;
    } catch (err) {
      console.warn("Error parseando fecha de reserva:", err);
      return true;
    }
  }

  const totalProfessionals = Array.isArray(booking.items)
    ? new Set(booking.items.map((it) => it.professionalId)).size
    : 0;
  const completedCount = Array.isArray(booking.professionalsCompleted)
    ? booking.professionalsCompleted.length
    : 0;

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
          <div className="booking-card__time">{displayStartTime || "—"}</div>
          <div className="booking-card__info">
            <span className="booking-card__client">{booking.clientName}</span>
            <span className="booking-card__meta">
              {servicesLabel.join(", ")}
            </span>
            <span className="booking-card__prof">
              con {getFirstName(profName)}
              {extraCount > 0 && ` +${extraCount}`}
            </span>
          </div>
        </div>

        <div className="booking-card__right">
          <div className="booking-card__badges">
            {myCompleted && booking.status === "confirmed" ? (
              <>
                <span className={`badge ${STATUS_CLASS["completed"]}`}>
                  Completada
                </span>
                {totalProfessionals > 1 && (
                  <span className="badge badge--muted booking-card__completion-fraction">
                    {completedCount}/{totalProfessionals}
                  </span>
                )}
              </>
            ) : (
              <span className={`badge ${STATUS_CLASS[booking.status]}`}>
                {STATUS_LABEL[booking.status]}
              </span>
            )}
            {booking.status === "pending" && totalProfessionals > 1 && (
              <span className="badge badge--muted booking-card__confirm-fraction">
                {confirmedCount}/{totalProfessionals}
              </span>
            )}
            {booking.depositStatus === "uploaded" && (
              <span className="badge badge--warning booking-card__deposit-badge">
                📎 Comprobante
              </span>
            )}
          </div>
          <span className="booking-card__price">
            {formatTotalPrice(booking.items)}
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
                  {formatEntityPrice(item)}
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
                      if (!myConfirmed) onUpdateStatus(booking.id, "confirmed");
                    }}
                    disabled={Boolean(myConfirmed)}
                    title={myConfirmed ? "Ya confirmaste" : "Confirmar reserva"}
                  >
                    <CheckCircle2 size={15} />{" "}
                    {myConfirmed ? "Confirmado" : "Confirmar"}
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
                  {!myCompleted ? (
                    <button
                      className="action-btn action-btn--complete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canCompleteNow(booking)) {
                          alert(
                            "No puedes marcar como completada antes de la hora de inicio de la reserva.",
                          );
                          return;
                        }
                        onUpdateStatus(booking.id, "completed");
                      }}
                    >
                      <CheckCircle2 size={15} /> Marcar completada
                    </button>
                  ) : (
                    <button className="action-btn" disabled>
                      <CheckCircle2 size={15} /> Tu parte completada
                    </button>
                  )}
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
  const { data: services = [] } = useServices(tenantId);

  // Estado para crear reserva desde el panel (modal)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createClientName, setCreateClientName] = useState("");
  const [createClientPhone, setCreateClientPhone] = useState("");
  const [createClientEmail, setCreateClientEmail] = useState("");
  const [createSelectedServiceIds, setCreateSelectedServiceIds] = useState(
    new Set(),
  );
  const [createDate, setCreateDate] = useState(selectedDate);
  const { data: bookingsForCreateDate = [] } = useBookingsByDate(
    tenantId,
    createDate,
  );
  const { data: blocksForCreateDate = [] } = useBlocksByDate(
    tenantId,
    createDate,
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [isSearchingSlots, setIsSearchingSlots] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Estado para completar reserva (modal de cobro)
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeBooking, setCompleteBooking] = useState(null);
  const [completeServiceAmounts, setCompleteServiceAmounts] = useState({});
  const [completeServiceMethods, setCompleteServiceMethods] = useState({});
  const [completeError, setCompleteError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Reservas en las que participa el profesional actual
  const bookingsForProfessional = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    if (!professionalId) return list;
    return list.filter((b) =>
      b.items?.some((item) => item.professionalId === professionalId),
    );
  }, [bookings, professionalId]);

  // Filtrar por estado
  const filtered = useMemo(() => {
    const sorted = [...bookingsForProfessional].sort((a, b) => {
      const aTime = getBookingStartTimeForProfessional(a, professionalId);
      const bTime = getBookingStartTimeForProfessional(b, professionalId);
      return aTime.localeCompare(bTime);
    });

    if (activeFilter === "todas") return sorted;
    return sorted.filter((b) => b.status === activeFilter);
  }, [bookingsForProfessional, activeFilter, professionalId]);

  const countsByStatus = useMemo(() => {
    const counts = {};
    for (const s of FILTERS) {
      if (s === "todas") continue;
      counts[s] = bookingsForProfessional.filter((b) => b.status === s).length;
    }
    return counts;
  }, [bookingsForProfessional]);

  // Actualizar estado de una reserva
  async function handleUpdateStatus(bookingId, newStatus) {
    if (!tenantId) return;
    // Si se marca como completada, abrir modal para ingresar cobros/metodo
    if (newStatus === "completed") {
      const booking = (bookings || []).find((b) => b.id === bookingId);
      if (!booking) {
        // fallback: actualizar sin modal
        try {
          await updateDoc(doc(db, "tenants", tenantId, "bookings", bookingId), {
            status: newStatus,
            completedAt: Timestamp.now(),
          });
          queryClient.invalidateQueries({
            queryKey: ["bookings-date", tenantId, selectedDate],
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
        // nada que completar para este profesional
        return;
      }

      // Evitar abrir modal si este profesional ya marcó su parte
      if (
        professionalId &&
        Array.isArray(booking.professionalsCompleted) &&
        booking.professionalsCompleted.includes(professionalId)
      ) {
        // ya completado por este profesional: no hacer nada
        return;
      }

      // abrir modal con valores sugeridos (solo para los items del profesional)
      openCompleteModal(booking);
      return;
    }

    try {
      if (newStatus === "confirmed") {
        const bookingRef = doc(db, "tenants", tenantId, "bookings", bookingId);
        // Si el usuario es admin (no professionalId), marcar confirmado globalmente
        if (!professionalId) {
          await updateDoc(bookingRef, {
            status: "confirmed",
            confirmedAt: Timestamp.now(),
          });
        } else {
          // Transacción: añadir professionalId a professionalsConfirmed y setear status si corresponde
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(bookingRef);
            if (!snap.exists()) throw new Error("Reserva no encontrada");
            const booking = snap.data() || {};
            const profIds = [
              ...new Set(
                (booking.items || [])
                  .map((i) => i.professionalId)
                  .filter(Boolean),
              ),
            ];
            const current = Array.isArray(booking.professionalsConfirmed)
              ? [...booking.professionalsConfirmed]
              : [];
            if (!current.includes(professionalId)) current.push(professionalId);
            const updates = { professionalsConfirmed: current };
            if (profIds.length > 0 && current.length >= profIds.length) {
              updates.status = "confirmed";
              updates.confirmedAt = Timestamp.now();
            }
            tx.update(bookingRef, updates);
          });
        }
      } else {
        const payload = {
          status: newStatus,
          ...(newStatus === "cancelled" ? { cancelledBy: "professional" } : {}),
        };
        await updateDoc(
          doc(db, "tenants", tenantId, "bookings", bookingId),
          payload,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDate],
      });
    } catch (err) {
      console.error("Error al actualizar reserva:", err);
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
      else if (info.kind === "tbd") suggested = 0;
      else suggested = info.amount || 0;
      amounts[sid] = suggested;
      methods[sid] = "efectivo";
    }
    setCompleteServiceAmounts(amounts);
    setCompleteServiceMethods(methods);
    setCompleteError(null);
    setCompleteModalOpen(true);
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

  // Abrir la página pública de reserva en una nueva pestaña, preseleccionando al profesional
  function handleOpenBookingPageForClient() {
    if (!tenantId || !professionalId) return;
    // Inicializar estado del modal
    setCreateDate(selectedDate);
    setCreateClientName("");
    setCreateClientPhone("");
    setCreateClientEmail("");
    setCreateSelectedServiceIds(new Set());
    setAvailableSlots([]);
    setSelectedSlotIndex(null);
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
  }

  function toggleCreateService(serviceId) {
    setCreateSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  async function handleSearchSlots() {
    setCreateError(null);
    setAvailableSlots([]);
    setSelectedSlotIndex(null);

    const ids = Array.from(createSelectedServiceIds);
    if (!ids.length) {
      setCreateError("Selecciona al menos un servicio");
      return;
    }

    const selectedServices = services.filter((s) => ids.includes(s.id));
    const assignments = {};
    for (const s of selectedServices) assignments[s.id] = professionalId;

    try {
      setIsSearchingSlots(true);
      const slots = calcAvailableSlots({
        date: createDate,
        tenant,
        assignments,
        selectedServices,
        professionals,
        existingBookings: bookingsForCreateDate,
        existingBlocks: blocksForCreateDate,
      });

      setAvailableSlots(slots || []);
      if (!(slots && slots.length)) {
        setCreateError(
          "No hay horarios disponibles para la selección indicada.",
        );
      }
    } catch (err) {
      console.error("Error al calcular slots:", err);
      setCreateError("Error al buscar horarios. Intenta nuevamente.");
    } finally {
      setIsSearchingSlots(false);
    }
  }

  function getDepositRequiredForBooking(tenantDeposit, items) {
    if (!tenantDeposit?.enabled) return false;
    const list = Array.isArray(items) ? items : [];
    const allItemsFree =
      list.length > 0 &&
      list.every((i) => normalizePriceType(i?.priceType) === "free");
    if (allItemsFree) return false;

    if (tenantDeposit.type === "fixed") {
      return (Number(tenantDeposit.amount) || 0) > 0;
    }

    if (tenantDeposit.type === "per_service") {
      return (list || []).some(
        (item) =>
          normalizePriceType(item?.priceType) !== "free" &&
          (Number(item.depositAmount) || 0) > 0,
      );
    }

    return false;
  }

  async function handleSubmitCreateBooking() {
    setCreateError(null);
    if (!tenantId || !professionalId) return;
    if (selectedSlotIndex == null) {
      setCreateError("Selecciona un horario");
      return;
    }

    const normalizedPhone =
      normalizeChileanPhone(createClientPhone) ||
      createClientPhone?.trim() ||
      "";
    const normalizedClientData = {
      clientName: createClientName?.trim() || "",
      clientPhone: normalizedPhone,
      clientEmail: createClientEmail?.trim() || "",
    };

    const slot = availableSlots[selectedSlotIndex];
    if (!slot) {
      setCreateError("Horario inválido");
      return;
    }

    // Construir items desde slot.order (igual que en BookingPage)
    const items = slot.order.flatMap((group) =>
      group.services.map((service) => {
        const prof = professionals.find((p) => p.id === group.profId);
        const priceType = normalizePriceType(service?.priceType);
        const priceFields =
          priceType === "range"
            ? {
                priceType,
                price: Number(service.priceMin) || 0,
                priceMin: Number(service.priceMin) || 0,
                priceMax: Number(service.priceMax) || 0,
              }
            : priceType === "tbd"
              ? {
                  priceType,
                  price: 0,
                  priceText: (service.priceText || "").trim() || undefined,
                }
              : priceType === "free"
                ? { priceType, price: 0 }
                : { priceType: "fixed", price: Number(service.price) || 0 };

        if (priceFields.priceText === undefined) delete priceFields.priceText;

        return {
          serviceId: service.id,
          serviceName: service.name,
          professionalId: group.profId,
          professionalName: prof?.name || "",
          professionalSlug: prof?.slug || "",
          startTime: service.start || group.start,
          endTime: service.end || group.end,
          ...priceFields,
          duration: service.duration,
          depositAmount:
            priceType === "free" ? 0 : Number(service.depositAmount) || 0,
        };
      }),
    );

    const totalPriceInfo = getTotalPriceInfo(items);
    const totalPrice =
      totalPriceInfo.kind === "fixed" ? totalPriceInfo.amount : null;

    const depositRequired = getDepositRequiredForBooking(
      tenant?.deposit,
      items,
    );
    const autoConfirmed =
      Boolean(tenant?.autoConfirmBookings) && !depositRequired;

    const booking = {
      clientName: normalizedClientData.clientName,
      clientPhone: normalizedClientData.clientPhone,
      clientEmail: normalizedClientData.clientEmail,
      date: Timestamp.fromDate(parseISO(createDate)),
      dateStr: createDate,
      status: autoConfirmed ? "confirmed" : "pending",
      createdAt: Timestamp.now(),
      notes: "",
      items,
      totalPrice,
      totalDuration: items.reduce((s, i) => s + i.duration, 0),
    };

    try {
      setIsCreating(true);
      const result = await createBooking(tenantId, booking, tenant?.deposit);
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, createDate],
      });
      setIsCreating(false);
      setCreateModalOpen(false);
      // Abrir página de estado de reserva en nueva pestaña
      if (tenant?.slug) {
        try {
          window.open(`/${tenant.slug}/reserva/${result.id}`, "_blank");
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error("Error al crear reserva desde panel:", err);
      setCreateError("Error al crear la reserva. Intenta nuevamente.");
      setIsCreating(false);
    }
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
      // Si el servicio es rango/tbd, requerir valor
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

    // Actualizar reserva y documento de informe mensual (incremental)
    try {
      setIsCompleting(true);

      // actualizar booking: añadir pagos parciales del profesional y aumentar collectedTotal
      const bookingRef = doc(
        db,
        "tenants",
        tenantId,
        "bookings",
        completeBooking.id,
      );

      const updatePayload = {
        collectedTotal: increment(total),
      };

      // si este profesional es el único en la reserva, marcar como completada
      const allItemsCount = allItems.length;
      const myItemsCount = items.length;
      if (myItemsCount > 0 && myItemsCount === allItemsCount) {
        updatePayload.status = "completed";
        updatePayload.completedAt = Timestamp.now();
      }

      // usar arrayUnion para anexar pagos sin sobrescribir los existentes
      if (payments.length > 0) updatePayload.payments = arrayUnion(...payments);
      // marcar que este profesional completó su parte (para evitar doble conteo)
      if (professionalId)
        updatePayload.professionalsCompleted = arrayUnion(professionalId);

      await updateDoc(bookingRef, updatePayload);

      // actualizar informe mensual (tenant-level) y además el informe por profesional
      const now = new Date();
      const monthId = format(now, "yyyy-MM");

      // preparar payloads basados SOLO en los pagos creados por este profesional en esta acción
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

      // aplicar actualizaciones
      const updates = [setDoc(tenantReportRef, reportPayload, { merge: true })];
      if (profReportRef)
        updates.push(setDoc(profReportRef, profReportPayload, { merge: true }));
      await Promise.all(updates);
      // Invalidar listas de reservas y el informe mensual para refrescar datos inmediatamente
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDate],
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
    <AdminLayout title="Reservas">
      <div className="bookings-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Reservas</h1>
          <div className="admin-page-controls">
            {/* Selector de fecha */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>
        </div>
        <button
          className="action-btn action-btn--confirm"
          onClick={handleOpenBookingPageForClient}
          title="Crear reserva para un cliente"
        >
          Crear reserva para cliente
        </button>
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
                  {countsByStatus[f] ?? 0}
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
                professionalId={professionalId}
                onUpdateStatus={handleUpdateStatus}
                onMarkDepositVerified={handleMarkDepositVerified}
                tenantSlug={tenantSlug}
              />
            ))}
          </div>
        )}

        {/* Modal: Crear reserva desde panel (profesional) */}
        {createModalOpen && (
          <div className="modal-overlay" onClick={closeCreateModal}>
            <div
              className="modal-card modal-card--form"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-card__header">
                <h3 className="modal-card__title">
                  Crear reserva para cliente
                </h3>
                <button
                  className="modal-card__close"
                  onClick={closeCreateModal}
                >
                  ✕
                </button>
              </div>

              <div className="modal-card__body modal-card__body--scroll">
                <p className="booking-detail__label">Cliente</p>
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={createClientName}
                  onChange={(e) => setCreateClientName(e.target.value)}
                  className="date-input"
                />
                <input
                  type="tel"
                  placeholder="Teléfono del cliente"
                  value={createClientPhone}
                  onChange={(e) => setCreateClientPhone(e.target.value)}
                  className="date-input"
                />
                <input
                  type="email"
                  placeholder="Email (opcional)"
                  value={createClientEmail}
                  onChange={(e) => setCreateClientEmail(e.target.value)}
                  className="date-input"
                />
                <p className="modal-note">
                  Si no se proporciona email, no se notificarán automáticamente
                  las actualizaciones de la reserva al cliente.
                </p>

                <p className="booking-detail__label">Servicios</p>
                {services.filter((s) =>
                  (s.professionalIds || []).includes(professionalId),
                ).length === 0 ? (
                  <p>No hay servicios asignados a este profesional.</p>
                ) : (
                  services
                    .filter((s) =>
                      (s.professionalIds || []).includes(professionalId),
                    )
                    .map((s) => (
                      <label key={s.id} className="modal-item">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <input
                              type="checkbox"
                              checked={createSelectedServiceIds.has(s.id)}
                              onChange={() => toggleCreateService(s.id)}
                            />
                            <span style={{ marginLeft: 8 }}>{s.name}</span>
                          </div>
                          <span className="modal-item__price">
                            {formatEntityPrice(s)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-tertiary)",
                          }}
                        >
                          {s.duration} min
                        </div>
                      </label>
                    ))
                )}

                <p className="booking-detail__label">Fecha</p>
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="date-input"
                />

                <div style={{ marginTop: 8 }}>
                  <button
                    className="action-btn action-btn--confirm"
                    onClick={handleSearchSlots}
                    disabled={isSearchingSlots}
                  >
                    {isSearchingSlots ? "Buscando..." : "Buscar horarios"}
                  </button>
                </div>

                {createError && (
                  <p style={{ color: "var(--color-error)", marginTop: 8 }}>
                    {createError}
                  </p>
                )}

                {availableSlots.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p className="booking-detail__label">
                      Horarios disponibles
                    </p>
                    <div
                      className="slots-grid"
                      role="list"
                      aria-label="Horarios disponibles"
                    >
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`slot-card ${selectedSlotIndex === idx ? "slot-card--selected" : ""}`}
                          onClick={() => setSelectedSlotIndex(idx)}
                        >
                          <div className="slot-card__time">
                            {slot.startTime}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-card__actions">
                <button
                  className="action-btn action-btn--cancel"
                  onClick={closeCreateModal}
                >
                  Cancelar
                </button>
                <button
                  className="action-btn action-btn--confirm"
                  onClick={handleSubmitCreateBooking}
                  disabled={isCreating || selectedSlotIndex == null}
                >
                  {isCreating ? "Creando..." : "Crear reserva"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Completar reserva (ingresar cobros y método) */}
        {completeModalOpen && completeBooking && (
          <div
            className="modal-overlay"
            onClick={() => setCompleteModalOpen(false)}
          >
            <div
              className="modal-card modal-card--form"
              onClick={(e) => e.stopPropagation()}
            >
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
                          <div className="modal-item__meta">
                            {suggestedText}
                          </div>
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
      </div>
    </AdminLayout>
  );
}
