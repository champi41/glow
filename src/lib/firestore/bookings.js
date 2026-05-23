import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
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
  const snapshot = await getDocs(q); // ← cambio
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

  const items = Array.isArray(bookingData?.items) ? bookingData.items : [];
  const allItemsFree =
    items.length > 0 && items.every((i) => i?.priceType === "free");
  if (allItemsFree) return defaultFields;

  let amount = 0;
  if (
    tenantDeposit.type === "fixed" &&
    typeof tenantDeposit.amount === "number"
  ) {
    amount = tenantDeposit.amount;
  } else if (tenantDeposit.type === "per_service" && items.length > 0) {
    amount = items.reduce((s, i) => {
      if (i?.priceType === "free") return s;
      return s + (Number(i.depositAmount) || 0);
    }, 0);
  }

  return {
    depositRequired: amount > 0,
    depositAmount: amount,
    depositStatus: amount > 0 ? "pending" : "none",
    depositProofUrl: null,
  };
}

function buildSlotId(dateStr, professionalId, startTime) {
  const safeDate = String(dateStr || "").replace(/[^0-9-]/g, "");
  const safeProf = String(professionalId || "").replace(/[^\w-]/g, "");
  const safeTime = String(startTime || "").replace(/[^0-9:]/g, "");
  return `${safeDate}_${safeProf}_${safeTime}`;
}

function getSlotPayloads(items, dateStr) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => {
      const professionalId = item?.professionalId;
      const startTime = item?.startTime;
      const endTime = item?.endTime;
      if (!professionalId || !startTime) return null;
      return {
        slotId: buildSlotId(dateStr, professionalId, startTime),
        professionalId,
        startTime,
        endTime: endTime || null,
      };
    })
    .filter(Boolean);
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
  const dateStr = bookingData?.dateStr;
  if (!dateStr) {
    throw new Error("booking-missing-date");
  }

  const depositFields = getDepositFields(tenantDeposit, bookingData);
  const slotPayloads = getSlotPayloads(bookingData?.items, dateStr);

  const bookingsRef = collection(db, "tenants", tenantId, "bookings");
  const bookingRef = doc(bookingsRef);
  const slotsRef = collection(db, "tenants", tenantId, "bookingSlots");
  const slotIds = slotPayloads.map((s) => s.slotId);

  const payload = {
    ...bookingData,
    ...depositFields,
    slotIds,
  };

  try {
    await runTransaction(db, async (tx) => {
      for (const slot of slotPayloads) {
        const slotRef = doc(slotsRef, slot.slotId);
        const snap = await tx.get(slotRef);
        if (snap.exists()) {
          const status = snap.data()?.status;
          if (status !== "cancelled") {
            const err = new Error("slot-unavailable");
            err.code = "slot-unavailable";
            throw err;
          }
        }
      }

      tx.set(bookingRef, payload);

      for (const slot of slotPayloads) {
        const slotRef = doc(slotsRef, slot.slotId);
        tx.set(
          slotRef,
          {
            bookingId: bookingRef.id,
            dateStr,
            professionalId: slot.professionalId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: "active",
          },
          { merge: true },
        );
      }
    });
  } catch (err) {
    if (err?.code === "slot-unavailable") throw err;
    const wrapped = new Error("booking-create-failed");
    wrapped.cause = err;
    throw wrapped;
  }

  return {
    id: bookingRef.id,
    depositRequired: depositFields.depositRequired,
    depositAmount: depositFields.depositAmount,
    depositStatus: depositFields.depositStatus,
  };
}

export async function releaseBookingSlots(tenantId, slotIds) {
  if (!tenantId || !Array.isArray(slotIds) || slotIds.length === 0) return;
  const batch = writeBatch(db);
  const slotsRef = collection(db, "tenants", tenantId, "bookingSlots");
  slotIds.forEach((slotId) => {
    if (!slotId) return;
    batch.set(doc(slotsRef, slotId), { status: "cancelled" }, { merge: true });
  });
  await batch.commit();
}
