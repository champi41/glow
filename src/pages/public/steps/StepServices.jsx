// src/pages/public/steps/StepServices.jsx

import { useMemo } from "react";
import SelectableServiceCard from "../../../components/public/SelectableServiceCard.jsx";
import { formatPrice } from "../../../utils/format.js";
import "./StepServices.css";

export default function StepServices({
  services,
  selectedServiceIds,
  onToggle,
  onContinue,
  showServiceDeposit = false,
}) {
  // Agrupar por categoría
  const grouped = useMemo(() => {
    const map = {};
    for (const service of services) {
      const cat = service.category || "Otros";
      if (!map[cat]) map[cat] = [];
      map[cat].push(service);
    }
    return map;
  }, [services]);

  const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));
  const totalPrice = selectedServices.reduce((s, sv) => s + sv.price, 0);
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.duration, 0);
  const count = selectedServiceIds.size;

  if (!services.length) {
    return (
      <p className="step-empty">
        Este negocio aún no tiene servicios disponibles.
      </p>
    );
  }

  return (
    <div className="step-services">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="step-services__group">
          <p className="step-services__category">{category}</p>
          <div className="step-services__list">
            {items.map((service) => (
              <SelectableServiceCard
                key={service.id}
                service={service}
                showDeposit={showServiceDeposit}
                selected={selectedServiceIds.has(service.id)}
                onToggle={() => onToggle(service.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Spacer para que el sticky no tape el último card */}
      <div style={{ height: "80px" }} />

      {/* Barra sticky */}
      {count > 0 && (
        <div className="step-services__sticky">
          <div className="step-services__summary">
            <span className="step-services__count">
              {count} servicio{count > 1 ? "s" : ""}
            </span>
            <span className="step-services__meta">
              {formatPrice(totalPrice)} · {totalDuration} min
            </span>
          </div>
          <button
            className="btn-primary step-services__btn"
            onClick={onContinue}
          >
            Continuar →
          </button>
        </div>
      )}
    </div>
  );
}
