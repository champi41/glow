// src/utils/ics.js

import { parseISO, format } from "date-fns";

/**
 * Convierte "YYYY-MM-DD" + "HH:mm" a formato ICS: "YYYYMMDDTHHmmss"
 */
function toICSDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-");
  const [hour, min] = timeStr.split(":");
  return `${year}${month}${day}T${hour}${min}00`;
}

/**
 * Escapa caracteres especiales para el formato ICS.
 */
function escapeICS(str) {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Genera y descarga un archivo .ics con los datos de la reserva.
 *
 * @param {object} booking - documento de booking de Firestore
 * @param {object} tenant  - documento del tenant
 */
export function generateICS(booking, tenant) {
  const items = booking.items || [];
  if (!items.length) return;

  // Hora de inicio: primer ítem
  const firstItem = items[0];
  // Hora de fin: último ítem
  const lastItem = items[items.length - 1];

  const dtStart = toICSDate(booking.dateStr, firstItem.startTime);
  const dtEnd = toICSDate(booking.dateStr, lastItem.endTime);

  // Descripción: lista de servicios con profesional y horario
  const descLines = items.map(
    (item) =>
      `${item.serviceName} con ${item.professionalName} (${item.startTime}–${item.endTime})`,
  );
  const description = escapeICS(descLines.join("\\n"));

  // Título del evento
  const summary = escapeICS(
    `${tenant.name} · ${items.map((i) => i.serviceName).join(", ")}`,
  );

  const location = escapeICS(tenant.address || "");

  // UID único para evitar duplicados en el calendario
  const uid = `reserva-${booking.id || Date.now()}@${tenant.slug || "app"}`;

  const now = format(new Date(), "yyyyMMdd'T'HHmmss");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reservas App//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Santiago:${dtStart}`,
    `DTEND;TZID=America/Santiago:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : null,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de tu reserva",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean) // eliminar nulls (location vacío)
    .join("\r\n"); // ICS requiere CRLF

  // Crear blob y descargar
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `reserva-${booking.dateStr}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Liberar memoria
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
