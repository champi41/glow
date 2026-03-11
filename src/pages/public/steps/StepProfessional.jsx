// src/pages/public/steps/StepProfessional.jsx

import { useMemo } from "react";
import { Shuffle } from "lucide-react";
import { getFirstName } from "../../../utils/format.js";
import "./StepProfessional.css";

export default function StepProfessional({
  selectedServices,
  professionals,
  assignments,
  onAssign,
  onContinue,
}) {
  // Servicios que necesitan selector (más de 1 profesional disponible
  // y no tienen asignación automática previa)
  const servicesNeedingSelection = useMemo(() => {
    return selectedServices.filter((service) => {
      const available = professionals.filter(
        (p) => p.isActive && service.professionalIds?.includes(p.id),
      );
      return available.length > 1;
    });
  }, [selectedServices, professionals]);

  // Servicios ya resueltos automáticamente (1 solo profesional)
  const autoAssigned = useMemo(() => {
    return selectedServices
      .filter((service) => {
        const available = professionals.filter(
          (p) => p.isActive && service.professionalIds?.includes(p.id),
        );
        return available.length === 1;
      })
      .map((service) => {
        const prof = professionals.find(
          (p) => p.isActive && service.professionalIds?.includes(p.id),
        );
        return { service, prof };
      });
  }, [selectedServices, professionals]);

  // Profesionales disponibles por servicio
  function getAvailableProfs(service) {
    return professionals.filter(
      (p) => p.isActive && service.professionalIds?.includes(p.id),
    );
  }

  // Botón continuar habilitado cuando todos tienen asignación
  const allAssigned = servicesNeedingSelection.every(
    (s) => !!assignments[s.id],
  );

  return (
    <div className="step-prof">
      {/* Servicios que necesitan selección */}
      {servicesNeedingSelection.map((service) => (
        <div key={service.id} className="prof-selector">
          <p className="prof-selector__label">{service.name}</p>

          <div className="prof-selector__options">
            {/* Opción: sin preferencia */}
            <button
              className={[
                "prof-option",
                assignments[service.id] === "any"
                  ? "prof-option--selected"
                  : "",
              ].join(" ")}
              onClick={() => onAssign(service.id, "any")}
            >
              <div className="prof-option__avatar prof-option__avatar--any">
                <Shuffle size={16} />
              </div>
              <span>Sin preferencia</span>
            </button>

            {/* Un botón por profesional disponible */}
            {getAvailableProfs(service).map((prof) => (
              <button
                key={prof.id}
                className={[
                  "prof-option",
                  assignments[service.id] === prof.id
                    ? "prof-option--selected"
                    : "",
                ].join(" ")}
                onClick={() => onAssign(service.id, prof.id)}
              >
                <div className="prof-option__avatar">
                  {prof.photoUrl ? (
                    <img src={prof.photoUrl} alt={prof.name} />
                  ) : (
                    <span>{prof.name.charAt(0)}</span>
                  )}
                </div>
                <span>{getFirstName(prof.name)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Servicios auto-asignados — solo informativos */}
      {autoAssigned.length > 0 && (
        <div className="prof-auto">
          <p className="prof-auto__label">Asignados automáticamente</p>
          {autoAssigned.map(({ service, prof }) => (
            <div key={service.id} className="prof-auto__row">
              <span className="prof-auto__service">{service.name}</span>
              <span className="prof-auto__prof">
                {prof
                  ? `con ${getFirstName(prof.name)}`
                  : "Sin profesional disponible"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Botón continuar */}
      <div className="step-prof__footer">
        <button
          className="btn-primary"
          onClick={onContinue}
          disabled={!allAssigned}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
