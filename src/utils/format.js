// Agregar a src/utils/format.js

export function formatPrice(n) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(n);
}

export function getFirstName(fullName) {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}
