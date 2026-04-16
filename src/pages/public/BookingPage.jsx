// src/pages/public/BookingPage.jsx

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { format, parseISO } from "date-fns";

import { useTenant } from "../../hooks/useTenant.js";
import { useApplyTheme } from "../../hooks/useApplyTheme.js";
import { useProfessionals } from "../../hooks/useProfessionals.js";
import { useServices } from "../../hooks/useServices.js";
import { useBookingsByDateRealtime } from "../../hooks/useBookingsByDateRealtime.js";
import { useBlocksByDateRealtime } from "../../hooks/useBlocksByDateRealtime.js";
import { useQueryClient } from "@tanstack/react-query";

import { createBooking } from "../../lib/firestore/bookings.js";
import {
  calcAvailableSlots,
  resolveAnyAssignments,
} from "../../utils/slots.js";
import { normalizeChileanPhone } from "../../utils/phone.js";

import { ChevronLeft, X } from "lucide-react";

import Spinner from "../../components/ui/Spinner.jsx";
import StepServices from "./steps/StepServices.jsx";
import StepProfessional from "./steps/StepProfessional.jsx";
import StepDate from "./steps/StepDate.jsx";
import StepClientForm from "./steps/StepClientForm.jsx";
import StepConfirmation from "./steps/StepConfirmation.jsx";

import "./BookingPage.css";

const CLIENT_CACHE_KEY = "booking-client-data-v1";

function readCachedClientData() {
  if (typeof window === "undefined") {
    return { clientName: "", clientPhone: "", clientEmail: "" };
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_CACHE_KEY);
    if (!raw) return { clientName: "", clientPhone: "", clientEmail: "" };

    const parsed = JSON.parse(raw);
    const normalizedPhone = normalizeChileanPhone(parsed?.clientPhone || "");
    return {
      clientName: parsed?.clientName || "",
      clientPhone: normalizedPhone || parsed?.clientPhone || "",
      clientEmail: parsed?.clientEmail || "",
    };
  } catch {
    return { clientName: "", clientPhone: "", clientEmail: "" };
  }
}

function persistClientData(data) {
  if (typeof window === "undefined") return;

  const payload = {
    clientName: data?.clientName?.trim?.() || "",
    clientPhone:
      normalizeChileanPhone(data?.clientPhone || "") ||
      data?.clientPhone?.trim?.() ||
      "",
    clientEmail: data?.clientEmail?.trim?.() || "",
  };

  try {
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

// ─── Constantes de pasos ─────────────────────────────────────
const STEP = {
  SERVICES: 1,
  PROFESSIONAL: 2,
  DATE: 3,
  TIME: 4,
  CLIENT: 5,
  CONFIRMATION: 6,
};

const STEP_META = {
  [STEP.SERVICES]: { eyebrow: "Servicios", title: "¿Qué te gustaría?" },
  [STEP.PROFESSIONAL]: { eyebrow: "Profesional", title: "¿Con quién?" },
  [STEP.DATE]: { eyebrow: "Fecha", title: "¿Cuándo?" },
  [STEP.TIME]: { eyebrow: "Hora", title: "Elige tu hora" },
  [STEP.CLIENT]: { eyebrow: "Tus datos", title: "Casi listo" },
  [STEP.CONFIRMATION]: { eyebrow: "", title: "¡Reserva confirmada!" },
};

// Convierte "HH:mm" a minutos desde medianoche
function timeToMinLocal(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function BookingPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Queries base ─────────────────────────────────────────
  const { data: tenant, isLoading: loadingTenant } = useTenant(slug);
  const tenantId = tenant?.id;

  useApplyTheme(tenant);

  const { data: professionals = [], isLoading: loadingProfs } =
    useProfessionals(tenantId);
  const { data: allServices = [], isLoading: loadingServices } = useServices(
    tenantId,
    { activeOnly: true },
  );

  // ── Estado del flujo ──────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(null); // null hasta inicializar
  const [selectedServiceIds, setSelectedServiceIds] = useState(new Set());
  const [assignments, setAssignments] = useState({}); // { serviceId: profId | "any" }
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD"
  const [selectedSlotData, setSelectedSlotData] = useState(null); // objeto completo de slots.js
  const [clientData, setClientData] = useState(() => readCachedClientData());
  const [confirmedBooking, setConfirmedBooking] = useState(null); // booking guardado
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // ── Queries de disponibilidad (solo cuando hay fecha) ────
  // Realtime bookings and blocks for the selected date to keep slots in sync
  const existingBookings = useBookingsByDateRealtime(tenantId, selectedDate);
  const existingBlocks = useBlocksByDateRealtime(tenantId, selectedDate);

  // ── Inicialización desde query params ────────────────────
  useEffect(() => {
    if (!allServices.length || !professionals.length) return;
    if (currentStep !== null) return; // ya inicializado

    const profIdParam = searchParams.get("profId");
    const servicesParam = searchParams.get("services");

    let initialServiceIds = new Set();
    let initialAssignments = {};
    let initialStep = STEP.SERVICES;

    // Si vienen servicios preseleccionados desde ProfessionalPage
    if (servicesParam) {
      const ids = servicesParam.split(",").filter(Boolean);
      initialServiceIds = new Set(ids);

      // Pre-asignar profesional si viene profId
      if (profIdParam) {
        for (const id of ids) {
          const service = allServices.find((s) => s.id === id);
          if (service?.professionalIds?.includes(profIdParam)) {
            initialAssignments[id] = profIdParam;
          }
        }
      }

      initialStep = STEP.PROFESSIONAL;

      // Verificar si el paso de profesional es necesario
      const needsSelection = ids.some((id) => {
        const service = allServices.find((s) => s.id === id);
        if (!service) return false;
        const alreadyAssigned = !!initialAssignments[id];
        if (alreadyAssigned) return false;
        const availableProfs = professionals.filter(
          (p) => p.isActive && service.professionalIds?.includes(p.id),
        );
        return availableProfs.length > 1;
      });

      if (!needsSelection) {
        // Auto-asignar los que faltan
        for (const id of ids) {
          if (initialAssignments[id]) continue;
          const service = allServices.find((s) => s.id === id);
          const available = professionals.filter(
            (p) => p.isActive && service?.professionalIds?.includes(p.id),
          );
          if (available.length === 1) {
            initialAssignments[id] = available[0].id;
          }
        }
        initialStep = STEP.DATE;
      }
    }

    setSelectedServiceIds(initialServiceIds);
    setAssignments(initialAssignments);
    setCurrentStep(initialStep);
  }, [allServices, professionals, searchParams, currentStep]);

  // ── Servicios seleccionados (derivado) ───────────────────
  const selectedServices = useMemo(
    () => allServices.filter((s) => selectedServiceIds.has(s.id)),
    [allServices, selectedServiceIds],
  );

  // ── Slots disponibles (derivado, se recalcula al cambiar fecha/assignments) ─
  const resolvedAssignments = useMemo(() => {
    if (!selectedDate || !selectedServices.length) return {};
    return resolveAnyAssignments(
      assignments,
      selectedServices,
      professionals,
      existingBookings,
    );
  }, [
    assignments,
    selectedServices,
    professionals,
    existingBookings,
    selectedDate,
  ]);

  const availableSlots = useMemo(() => {
    if (
      !selectedDate ||
      !selectedServices.length ||
      !Object.keys(resolvedAssignments).length
    )
      return [];

    const slots = calcAvailableSlots({
      date: selectedDate,
      tenant,
      assignments: resolvedAssignments,
      selectedServices,
      professionals,
      existingBookings,
      existingBlocks,
    });

    // Si la fecha seleccionada es hoy, filtrar horas que ya pasaron
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (selectedDate === todayStr) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return slots.filter(
        (slot) => timeToMinLocal(slot.startTime) >= nowMinutes,
      );
    }

    return slots;
  }, [
    selectedDate,
    resolvedAssignments,
    selectedServices,
    tenant,
    professionals,
    existingBookings,
    existingBlocks,
  ]);

  // Si la selección actual deja de estar en los slots disponibles (otro cliente la reservó), invalidarla
  useEffect(() => {
    if (!selectedSlotData) return;
    const stillAvailable = availableSlots.some(
      (s) => s.startTime === selectedSlotData.startTime,
    );
    if (!stillAvailable) {
      // limpiar selección para evitar continuar con un slot ya reservado
      setSelectedSlotData(null);
    }
  }, [availableSlots, selectedSlotData]);

  // ── Pasos activos (para los dots de progreso) ────────────
  const activeSteps = useMemo(() => {
    const steps = [];
    if (!searchParams.get("services")) steps.push(STEP.SERVICES);

    const needsProfStep = selectedServices.some((service) => {
      const available = professionals.filter(
        (p) => p.isActive && service.professionalIds?.includes(p.id),
      );
      return available.length > 1;
    });
    if (needsProfStep || !searchParams.get("services"))
      steps.push(STEP.PROFESSIONAL);

    // Usamos una vista combinada fecha+hora, tratamos DATE y TIME como un solo paso
    steps.push(STEP.DATE, STEP.CLIENT, STEP.CONFIRMATION);
    return steps;
  }, [selectedServices, professionals, searchParams]);

  // ── Handlers ─────────────────────────────────────────────

  function handleToggleService(serviceId) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
        // Limpiar assignment si se deselecciona
        setAssignments((a) => {
          const na = { ...a };
          delete na[serviceId];
          return na;
        });
      } else {
        next.add(serviceId);
      }
      return next;
    });
  }

  function handleAssign(serviceId, profId) {
    setAssignments((prev) => ({ ...prev, [serviceId]: profId }));
  }

  function handleSelectDate(dateStr) {
    setSelectedDate(dateStr);
    setSelectedSlotData(null); // resetear slot al cambiar fecha
    // En la vista combinada permanecemos en el paso DATE
    setCurrentStep(STEP.DATE);
  }

  function handleSelectSlot(slotData) {
    setSelectedSlotData(slotData);
  }

  function handleBack() {
    if (currentStep === STEP.CONFIRMATION) return;
    if (
      currentStep <= STEP.SERVICES ||
      (currentStep === STEP.PROFESSIONAL && !searchParams.get("services"))
    ) {
      navigate(`/${slug}`);
      return;
    }
    // Buscar el paso anterior en activeSteps
    const idx = activeSteps.indexOf(currentStep);
    if (idx > 0) setCurrentStep(activeSteps[idx - 1]);
    else navigate(`/${slug}`);
  }

  function handleContinueFromServices() {
    // Auto-asignar servicios con un solo profesional disponible
    const autoAssignments = {};
    for (const service of selectedServices) {
      const available = professionals.filter(
        (p) => p.isActive && service.professionalIds?.includes(p.id),
      );
      if (available.length === 1) {
        autoAssignments[service.id] = available[0].id;
      }
    }
    setAssignments((prev) => ({ ...autoAssignments, ...prev }));

    // Verificar si necesita paso de profesional
    const needsProf = selectedServices.some((service) => {
      if (autoAssignments[service.id] || assignments[service.id]) return false;
      const available = professionals.filter(
        (p) => p.isActive && service.professionalIds?.includes(p.id),
      );
      return available.length > 1;
    });

    setCurrentStep(needsProf ? STEP.PROFESSIONAL : STEP.DATE);
  }

  function handleContinueFromProfessional() {
    setCurrentStep(STEP.DATE);
  }

  function handleContinueFromTime() {
    if (selectedSlotData) setCurrentStep(STEP.CLIENT);
  }

  async function handleConfirm(formData) {
    const normalizedPhone = normalizeChileanPhone(formData.clientPhone || "");

    const normalizedClientData = {
      clientName: formData.clientName?.trim?.() || "",
      clientPhone: normalizedPhone || formData.clientPhone?.trim?.() || "",
      clientEmail: formData.clientEmail?.trim?.() || "",
    };

    setClientData(normalizedClientData);
    persistClientData(normalizedClientData);

    setIsSubmitting(true);
    setSubmitError(null);
    // Intentamos abrir una nueva pestaña inmediatamente (evitar popup blocker)
    let newWin = null;
    try {
      newWin = window.open("", "_blank");
      if (newWin) {
        // Mostrar breve mensaje de carga mientras se procesa
        newWin.document.write("<p>Creando tu reserva...</p>");
      }
    } catch (err) {
      newWin = null;
    }

    try {
      // Construir items desde selectedSlotData.order
      // Build booking items using per-service start/end provided by calcAvailableSlots
      const items = selectedSlotData.order.flatMap((group) =>
        group.services.map((service) => {
          const prof = professionals.find((p) => p.id === group.profId);
          return {
            serviceId: service.id,
            serviceName: service.name,
            professionalId: group.profId,
            professionalName: prof?.name || "",
            professionalSlug: prof?.slug || "",
            startTime: service.start || group.start,
            endTime: service.end || group.end,
            price: service.price,
            duration: service.duration,
            depositAmount: Number(service.depositAmount) || 0,
          };
        }),
      );

      const booking = {
        clientName: normalizedClientData.clientName,
        clientPhone: normalizedClientData.clientPhone,
        clientEmail: normalizedClientData.clientEmail,
        date: Timestamp.fromDate(parseISO(selectedDate)),
        dateStr: selectedDate,
        status: "pending",
        createdAt: Timestamp.now(),
        notes: "",
        items,
        totalPrice: items.reduce((s, i) => s + i.price, 0),
        totalDuration: items.reduce((s, i) => s + i.duration, 0),
      };

      const result = await createBooking(tenantId, booking, tenant?.deposit);

      // Invalidar queries para que la agenda del admin se actualice
      queryClient.invalidateQueries({
        queryKey: ["bookings-date", tenantId, selectedDate],
      });

      setConfirmedBooking({
        id: result.id,
        ...booking,
        depositRequired: result.depositRequired,
        depositAmount: result.depositAmount,
        depositStatus: result.depositStatus,
        depositProofUrl: null,
      });
      setCurrentStep(STEP.CONFIRMATION);

      // Redirigir la nueva pestaña al estado de reserva
      const statusUrl = `/${slug}/reserva/${result.id}`;
      if (newWin) {
        try {
          newWin.location.href = statusUrl;
        } catch (err) {
          // Si no se puede redirigir (política), abrir en la misma pestaña
          window.open(statusUrl, "_blank");
        }
      } else {
        // Fallback: abrir en nueva pestaña si popup bloqueado
        window.open(statusUrl, "_blank");
      }
    } catch (err) {
      console.error("Error al crear reserva:", err);
      setSubmitError(
        "Ocurrió un error al guardar tu reserva. Intenta nuevamente.",
      );
      // Cerrar la pestaña en blanco si existía
      try {
        if (newWin) newWin.close();
      } catch (e) {}
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Loading inicial ───────────────────────────────────────
  if (
    loadingTenant ||
    loadingProfs ||
    loadingServices ||
    currentStep === null
  ) {
    return <Spinner />;
  }

  if (!tenant) {
    return (
      <div className="booking-not-found">
        <p>Negocio no encontrado.</p>
      </div>
    );
  }

  const stepMeta = STEP_META[currentStep];
  const currentIndex = activeSteps.indexOf(currentStep);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="booking-page">
      {/* Header con progreso */}
      <header className="booking-header">
        <button
          className="booking-header__btn"
          onClick={handleBack}
          aria-label="Volver"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div className="booking-progress">
          {activeSteps.map((step, i) => (
            <div
              key={step}
              className={[
                "progress-dot",
                i < currentIndex ? "progress-dot--done" : "",
                i === currentIndex ? "progress-dot--active" : "",
              ].join(" ")}
            />
          ))}
        </div>

        <button
          className="booking-header__btn"
          onClick={() => navigate(`/${slug}`)}
          aria-label="Cerrar"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {/* Contenido del paso */}
      <div className="booking-content">
        {currentStep !== STEP.CONFIRMATION && (
          <div className="booking-step-title">
            {stepMeta.eyebrow && (
              <p className="section-eyebrow">{stepMeta.eyebrow}</p>
            )}
            <h2 className="section-title">{stepMeta.title}</h2>
          </div>
        )}

        {currentStep === STEP.SERVICES && (
          <StepServices
            services={allServices}
            selectedServiceIds={selectedServiceIds}
            onToggle={handleToggleService}
            onContinue={handleContinueFromServices}
          />
        )}

        {currentStep === STEP.PROFESSIONAL && (
          <StepProfessional
            selectedServices={selectedServices}
            professionals={professionals}
            assignments={assignments}
            onAssign={handleAssign}
            onContinue={handleContinueFromProfessional}
            onBack={handleBack}
          />
        )}

        {(currentStep === STEP.DATE || currentStep === STEP.TIME) && (
          <StepDate
            tenant={tenant}
            professionals={professionals}
            assignments={assignments}
            selectedServices={selectedServices}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            // Props to render times inside StepDate
            availableSlots={availableSlots}
            selectedSlotData={selectedSlotData}
            onSelectSlot={handleSelectSlot}
            onContinue={handleContinueFromTime}
            onChangeProfessional={() => setCurrentStep(STEP.PROFESSIONAL)}
            onChangeDate={() => setCurrentStep(STEP.DATE)}
            isLoading={!selectedDate}
          />
        )}

        {currentStep === STEP.CLIENT && (
          <StepClientForm
            selectedSlotData={selectedSlotData}
            selectedDate={selectedDate}
            selectedServices={selectedServices}
            professionals={professionals}
            initialClientData={clientData}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}

        {currentStep === STEP.CONFIRMATION && confirmedBooking && (
          <StepConfirmation
            booking={confirmedBooking}
            tenant={tenant}
            slug={slug}
          />
        )}
      </div>
    </div>
  );
}
