// Agregar a src/utils/format.js

export function formatPrice(n) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(n);
}

const DEFAULT_TBD_TEXT = "A definir";

export function normalizePriceType(priceType) {
  if (priceType === "fixed") return "fixed";
  if (priceType === "range") return "range";
  if (priceType === "free") return "free";
  if (priceType === "tbd") return "tbd";
  return "fixed";
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Devuelve una representación normalizada del precio.
 * Soporta: fijo, rango, gratis, a_definir.
 * @param {object} entity - service o booking item
 * @returns {{ kind: 'fixed', amount: number } | { kind: 'range', min: number, max: number } | { kind: 'tbd', text: string }}
 */
export function getEntityPriceInfo(entity) {
  const type = normalizePriceType(entity?.priceType);

  if (type === "free") {
    return { kind: "fixed", amount: 0 };
  }

  if (type === "range") {
    const min = toFiniteNumber(entity?.priceMin);
    const max = toFiniteNumber(entity?.priceMax);
    if (min != null && max != null) {
      return { kind: "range", min, max };
    }
    // Fallback: si algo quedó a medias, degradar a fijo con price.
  }

  if (type === "tbd") {
    const text = (entity?.priceText || "").trim() || DEFAULT_TBD_TEXT;
    return { kind: "tbd", text };
  }

  return { kind: "fixed", amount: toFiniteNumber(entity?.price) ?? 0 };
}

export function formatPriceInfo(info) {
  if (!info) return "";
  if (info.kind === "fixed") return info.amount === 0 ? "Gratis" : formatPrice(info.amount);
  if (info.kind === "range") return `${formatPrice(info.min)} - ${formatPrice(info.max)}`;
  if (info.kind === "tbd") return info.text || DEFAULT_TBD_TEXT;
  return "";
}

export function formatEntityPrice(entity) {
  return formatPriceInfo(getEntityPriceInfo(entity));
}

/**
 * Calcula el total de una lista de servicios/items.
 * - Si hay algún 'tbd', el total es 'tbd'.
 * - Si hay algún 'range' (y no hay tbd), el total es un rango.
 * - Si todos son fijos/gratis, total fijo.
 */
export function getTotalPriceInfo(entities) {
  const list = Array.isArray(entities) ? entities : [];
  let hasRange = false;
  let minTotal = 0;
  let maxTotal = 0;

  for (const e of list) {
    const info = getEntityPriceInfo(e);
    if (info.kind === "tbd") {
      return { kind: "tbd", text: info.text || DEFAULT_TBD_TEXT };
    }
    if (info.kind === "range") {
      hasRange = true;
      minTotal += info.min;
      maxTotal += info.max;
      continue;
    }
    minTotal += info.amount;
    maxTotal += info.amount;
  }

  return hasRange
    ? { kind: "range", min: minTotal, max: maxTotal }
    : { kind: "fixed", amount: minTotal };
}

export function formatTotalPrice(entities) {
  return formatPriceInfo(getTotalPriceInfo(entities));
}

/**
 * Aplica un abono a un total para mostrar "a pagar después".
 */
export function subtractDepositFromPriceInfo(totalInfo, depositAmount) {
  const dep = toFiniteNumber(depositAmount) ?? 0;
  if (!totalInfo) return { kind: "fixed", amount: 0 };

  if (totalInfo.kind === "tbd") {
    return { kind: "tbd", text: totalInfo.text || DEFAULT_TBD_TEXT };
  }
  if (totalInfo.kind === "range") {
    return {
      kind: "range",
      min: Math.max(0, totalInfo.min - dep),
      max: Math.max(0, totalInfo.max - dep),
    };
  }
  return { kind: "fixed", amount: Math.max(0, (totalInfo.amount || 0) - dep) };
}

export function getFirstName(fullName) {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}
