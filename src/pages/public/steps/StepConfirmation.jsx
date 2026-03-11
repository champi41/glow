// src/pages/public/steps/StepConfirmation.jsx

import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, CalendarPlus, ArrowLeft } from "lucide-react";
import { formatPrice, getFirstName } from "../../../utils/format.js";
import { generateICS } from "../../../utils/ics.js";
import "./StepConfirmation.css";

export default function StepConfirmation({ booking, tenant, slug }) {
  const navigate = useNavigate();

  const formattedDate = booking.dateStr
    ? format(parseISO(booking.dateStr), "EEEE d 'de' MMMM 'de' yyyy", {
        locale: es,
      })
    : "";

  function handleDownloadICS() {
    generateICS(booking, tenant);
  }

  return (
    <div className="step-confirmation">
      {/* Ícono de éxito */}
      <div className="confirmation__icon">
        <CheckCircle2 size={56} strokeWidth={1.5} />
      </div>

      {/* Título */}
      <div className="confirmation__header">
        <h2 className="confirmation__title">¡Reserva confirmada!</h2>
        <p className="confirmation__subtitle">
          Te contactaremos por WhatsApp para confirmar tu hora.
        </p>
      </div>

      {/* Resumen */}
      <div className="confirmation__summary">
        <p className="confirmation__summary-date">{formattedDate}</p>

        {booking.items?.map((item, i) => (
          <div key={i} className="confirmation__item">
            <div className="confirmation__item-left">
              <span className="confirmation__item-name">
                {item.serviceName}
              </span>
              <span className="confirmation__item-meta">
                con {getFirstName(item.professionalName)}
                {" · "}
                {item.startTime} – {item.endTime}
              </span>
            </div>
            <span className="confirmation__item-price">
              {formatPrice(item.price)}
            </span>
          </div>
        ))}

        <div className="confirmation__total">
          <div className="confirmation__total-left">
            <span>Total</span>
            <span className="confirmation__total-duration">
              {booking.totalDuration} min
            </span>
          </div>
          <span className="confirmation__total-price">
            {formatPrice(booking.totalPrice)}
          </span>
        </div>

        {/* Datos del cliente */}
        <div className="confirmation__client">
          <span className="confirmation__client-name">
            {booking.clientName}
          </span>
          <span className="confirmation__client-phone">
            {booking.clientPhone}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="confirmation__actions">
        <button
          className="btn-outline confirmation__ics"
          onClick={handleDownloadICS}
        >
          <CalendarPlus size={16} />
          Agregar al calendario
        </button>

        <button className="btn-ghost" onClick={() => navigate(`/${slug}`)}>
          <ArrowLeft size={14} />
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
