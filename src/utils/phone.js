/**
 * Format phone number for display (e.g. +34 612 345 678).
 * @param {string} raw - Raw phone string
 * @returns {string} Formatted phone or original if invalid
 */
export function formatPhone(raw) {
  if (!raw || typeof raw !== "string") return raw || "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return raw;
  if (digits.startsWith("34") && digits.length >= 11) {
    return `+34 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return raw;
}

/**
 * Normaliza teléfonos chilenos móviles a formato internacional +569XXXXXXXX.
 * Acepta variantes como: +56 9 1234 5678, +56912345678, 56912345678, 912345678.
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeChileanPhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");

  // +56 9XXXXXXXX
  if (digits.length === 11 && digits.startsWith("56") && digits[2] === "9") {
    return `+${digits}`;
  }

  // 9XXXXXXXX
  if (digits.length === 9 && digits.startsWith("9")) {
    return `+56${digits}`;
  }

  // 09XXXXXXXX
  if (digits.length === 10 && digits.startsWith("09")) {
    return `+56${digits.slice(1)}`;
  }

  return null;
}
