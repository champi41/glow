// src/pages/public/steps/StepClientForm.jsx

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatPrice, getFirstName } from "../../../utils/format.js";
import { normalizeChileanPhone } from "../../../utils/phone.js";
import "./StepClientForm.css";

export default function StepClientForm({
  selectedSlotData,
  selectedDate,
  selectedServices,
  showServiceDeposit = false,
  professionals,
  initialClientData,
  onConfirm,
  isSubmitting,
  submitError,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      clientName: initialClientData?.clientName || "",
      clientPhone: initialClientData?.clientPhone || "",
      clientEmail: initialClientData?.clientEmail || "",
    },
  });

  useEffect(() => {
    reset({
      clientName: initialClientData?.clientName || "",
      clientPhone: initialClientData?.clientPhone || "",
      clientEmail: initialClientData?.clientEmail || "",
    });
  }, [initialClientData, reset]);

  const totalPrice = selectedServices.reduce((s, sv) => s + sv.price, 0);
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.duration, 0);
  // Calcular abonos por servicio y totales
  const depositPerService = {};
  let totalDeposit = 0;
  if (showServiceDeposit) {
    selectedSlotData?.order.forEach((group) => {
      group.services.forEach((service) => {
        const dep = Number(service.depositAmount) || 0;
        depositPerService[service.id] = dep;
        totalDeposit += dep;
      });
    });
  }
  const remainingAmount = showServiceDeposit
    ? totalPrice - totalDeposit
    : totalPrice;

  const formattedDate = selectedDate
    ? format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })
    : "";

  return (
    <div className="step-client">
      {/* Resumen de la reserva */}
      <div className="booking-summary">
        <p className="booking-summary__date">
          {formattedDate} · {selectedSlotData?.startTime}
        </p>

        {selectedSlotData?.order.map((group) => {
          const prof = professionals.find((p) => p.id === group.profId);
          return group.services.map((service) => (
            <div key={service.id} className="booking-summary__item">
              <div className="booking-summary__item-info">
                <span className="booking-summary__item-name">
                  {service.name}
                </span>
                <span className="booking-summary__item-prof">
                  con {prof ? getFirstName(prof.name) : "—"}
                  {" · "}
                  {service.start || group.start} – {service.end || group.end}
                </span>
              </div>
              <div className="booking-summary__item-right">
                <span className="booking-summary__item-price">
                  {formatPrice(service.price)}
                </span>
                {showServiceDeposit && depositPerService[service.id] > 0 && (
                  <span className="booking-summary__item-deposit">
                    Abono: {formatPrice(depositPerService[service.id])}
                  </span>
                )}
              </div>
            </div>
          ));
        })}

        <div className="booking-summary__total">
          <div className="booking-summary__total-info">
            <span>Total</span>
            <span className="booking-summary__total-duration">
              {totalDuration} min
            </span>
          </div>
          <div className="booking-summary__total-prices">
            {showServiceDeposit && (
              <>
                <div className="booking-summary__deposit-now">
                  <span>Abono ahora</span>
                  <span>{formatPrice(totalDeposit)}</span>
                </div>
                <div className="booking-summary__remaining">
                  <span>A pagar después</span>
                  <span>{formatPrice(remainingAmount)}</span>
                </div>
              </>
            )}
            <div className="booking-summary__grand-total">
              <span>Total</span>
              <span className="booking-summary__total-price">
                {formatPrice(totalPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form
        className="client-form"
        onSubmit={handleSubmit(onConfirm)}
        noValidate
      >
        <div className="form-field">
          <label htmlFor="clientName">Nombre y Apellido *</label>
          <input
            id="clientName"
            type="text"
            placeholder="Lola Mento"
            autoComplete="name"
            {...register("clientName", {
              required: "El nombre es obligatorio",
              minLength: {
                value: 2,
                message: "El nombre debe tener al menos 2 caracteres",
              },
            })}
          />
          {errors.clientName && (
            <span className="form-error">{errors.clientName.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="clientPhone">Telefono *</label>
          <input
            id="clientPhone"
            type="tel"
            placeholder="9 1234 5678"
            autoComplete="tel"
            inputMode="tel"
            {...register("clientPhone", {
              required: "El número de Telefono es obligatorio",
              validate: (value) =>
                !!normalizeChileanPhone(value) ||
                "Ingresa un número chileno válido (ej: 9 1234 5678)",
            })}
          />
          {errors.clientPhone && (
            <span className="form-error">{errors.clientPhone.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="clientEmail">Correo electrónico *</label>
          <input
            id="clientEmail"
            type="email"
            placeholder="juan@email.com"
            autoComplete="email"
            {...register("clientEmail", {
              required: "El correo electrónico es obligatorio",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Ingresa un correo válido",
              },
            })}
          />
          {errors.clientEmail && (
            <span className="form-error">{errors.clientEmail.message}</span>
          )}
        </div>

        {/* Error de Firestore */}
        {submitError && <div className="form-submit-error">{submitError}</div>}

        <button
          type="submit"
          className="btn-primary client-form__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando..." : "Confirmar reserva →"}
        </button>
      </form>
    </div>
  );
}
