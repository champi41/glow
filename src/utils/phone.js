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
