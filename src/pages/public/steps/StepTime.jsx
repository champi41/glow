// src/pages/public/steps/StepTime.jsx

import { Loader2 } from "lucide-react";
import "./StepTime.css";

export default function StepTime({
  availableSlots,
  selectedSlotData,
  onSelectSlot,
  onContinue,
  onChangeDate,
  onChangeProfessional,
  isLoading,
}) {
  if (isLoading) {
    return (
      <div className="step-time__loading">
        <Loader2 size={20} className="step-time__spinner" />
        <p>Cargando horarios disponibles...</p>
      </div>
    );
  }

  if (!availableSlots.length) {
    return (
      <div className="step-time__empty">
        <p className="step-time__empty-text">
          No encontramos disponibilidad para esta combinación.
        </p>
        <div className="step-time__empty-actions">
          <button className="btn-outline" onClick={onChangeDate}>
            Cambiar día
          </button>
          {onChangeProfessional && (
            <button className="btn-outline" onClick={onChangeProfessional}>
              Cambiar profesional
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="step-time">
      <div className="slots-grid">
        {availableSlots.map((slotData) => {
          const isSelected = selectedSlotData?.startTime === slotData.startTime;
          return (
            <button
              key={slotData.startTime}
              className={[
                "slot-btn",
                isSelected ? "slot-btn--selected" : "",
              ].join(" ")}
              onClick={() => onSelectSlot(slotData)}
              aria-pressed={isSelected}
            >
              {slotData.startTime}
            </button>
          );
        })}
      </div>

      {/* Detalle del slot seleccionado */}
      {selectedSlotData && (
        <div className="slot-detail">
          <p className="slot-detail__label">Resumen del horario</p>
          {selectedSlotData.order.map((group) => (
            <div key={group.profId} className="slot-detail__row">
              <div className="slot-detail__time">
                {group.start} – {group.end}
              </div>
              <div className="slot-detail__info">
                <span className="slot-detail__services">
                  {group.services.map((s) => s.name).join(", ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón continuar */}
      <div className="step-time__footer">
        <button
          className="btn-primary"
          onClick={onContinue}
          disabled={!selectedSlotData}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
