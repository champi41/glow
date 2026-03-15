import { collection, getDocsFromServer, addDoc, query, where } from "firebase/firestore";
import { db } from "../../config/firebase.js";

/**
 * Get bookings for a tenant on a given date (dateStr YYYY-MM-DD).
 * @param {string} tenantId
 * @param {string} dateStr
 * @returns {Promise<Array<{ id: string, ... }>>}
 */
export async function getBookingsByDate(tenantId, dateStr) {
  const bookingsRef = collection(db, "tenants", tenantId, "bookings");
  const q = query(bookingsRef, where("dateStr", "==", dateStr));
  const snapshot = await getDocsFromServer(q); // ← cambio
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Calcula campos de abono según configuración del tenant.
 * @param {object} tenantDeposit - tenant.deposit (puede ser undefined)
 * @param {object} bookingData - { items: Array<{ depositAmount?: number }>, ... }
 * @returns {{ depositRequired: boolean, depositAmount: number, depositStatus: string, depositProofUrl: null }}
 */
function getDepositFields(tenantDeposit, bookingData) {
  const defaultFields = {
    depositRequired: false,
    depositAmount: 0,
    depositStatus: "none",
    depositProofUrl: null,
  };
  if (!tenantDeposit?.enabled) return defaultFields;

  let amount = 0;
  if (tenantDeposit.type === "fixed" && typeof tenantDeposit.amount === "number") {
    amount = tenantDeposit.amount;
  } else if (tenantDeposit.type === "per_service" && Array.isArray(bookingData.items)) {
    amount = bookingData.items.reduce((s, i) => s + (Number(i.depositAmount) || 0), 0);
  }

  return {
    depositRequired: amount > 0,
    depositAmount: amount,
    depositStatus: amount > 0 ? "pending" : "none",
    depositProofUrl: null,
  };
}

/**
 * Create a booking document in the tenant's bookings subcollection.
 * Incluye campos de abono calculados según tenant.deposit.
 * @param {string} tenantId
 * @param {object} bookingData
 * @param {object} [tenantDeposit] - tenant.deposit (opcional)
 * @returns {Promise<{ id: string, depositRequired: boolean, depositAmount: number, depositStatus: string }>}
 */
export async function createBooking(tenantId, bookingData, tenantDeposit) {
  const depositFields = getDepositFields(tenantDeposit, bookingData);
  const payload = {
    ...bookingData,
    ...depositFields,
  };
  const bookingsRef = collection(db, "tenants", tenantId, "bookings");
  const docRef = await addDoc(bookingsRef, payload);
  return {
    id: docRef.id,
    depositRequired: depositFields.depositRequired,
    depositAmount: depositFields.depositAmount,
    depositStatus: depositFields.depositStatus,
  };
}
