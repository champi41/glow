// src/pages/public/steps/StepDate.jsx

import { useMemo } from "react";
import { format, addDays, startOfToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import "./StepDate.css";
import StepTime from "./StepTime.jsx";

export default function StepDate({
  tenant,
  professionals,
  assignments,
  selectedServices,
  selectedDate,
  onSelectDate,
  // props para el render de horas
  availableSlots,
  selectedSlotData,
  onSelectSlot,
  onContinue,
  onChangeDate,
  onChangeProfessional,
  isLoading,
}) {
  const today = startOfToday();

  // Generar los próximos 14 días
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  // Verificar si un día está abierto según businessHours
  function isDayOpen(date) {
    const dayName = format(date, "EEEE").toLowerCase();
    const bh = tenant?.businessHours?.[dayName];
    if (!bh?.isOpen) return false;

    // Verificar que al menos un profesional involucrado trabaja ese día
    const profIds = [...new Set(Object.values(assignments))].filter(
      (id) => id && id !== "any",
    );

    if (!profIds.length) return true;

    return profIds.every((profId) => {
      const prof = professionals.find((p) => p.id === profId);
      if (!prof) return false;

      // Si tiene availability propia
      if (prof.availability !== null && prof.availability !== undefined) {
        return prof.availability[dayName]?.isWorking === true;
      }

      // Hereda del negocio
      return bh.isOpen;
    });
  }

  return (
    <div className="step-date">
      <div className="date-scroll">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const open = isDayOpen(day);
          const selected = selectedDate === dateStr;
          const isToday = dateStr === format(today, "yyyy-MM-dd");

          return (
            <button
              key={dateStr}
              className={[
                "date-chip",
                selected ? "date-chip--selected" : "",
                !open ? "date-chip--disabled" : "",
              ].join(" ")}
              onClick={() => open && onSelectDate(dateStr)}
              disabled={!open}
              aria-pressed={selected}
              aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
            >
              <span className="date-chip__day">
                {isToday ? "Hoy" : format(day, "EEE", { locale: es })}
              </span>
              <span className="date-chip__num">{format(day, "d")}</span>
              <span className="date-chip__month">
                {format(day, "MMM", { locale: es })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mensaje si no hay días disponibles */}
      {days.every((day) => !isDayOpen(day)) && (
        <p className="step-date__empty">
          No hay días disponibles en los próximos 14 días. Contacta al negocio
          directamente.
        </p>
      )}

      {/* Indicación de selección */}
      {selectedDate && (
        <p className="step-date__selected-label">
          Seleccionaste:{" "}
          <strong>
            {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
          </strong>
        </p>
      )}

      {/* Render de horas debajo del selector de fecha (vista unificada) */}
      {selectedDate && (
        <div className="step-date__times">
          <StepTime
            availableSlots={availableSlots}
            selectedSlotData={selectedSlotData}
            onSelectSlot={onSelectSlot}
            onContinue={onContinue}
            onChangeDate={onChangeDate}
            onChangeProfessional={onChangeProfessional}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
