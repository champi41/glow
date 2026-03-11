import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
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
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Create a booking document in the tenant's bookings subcollection.
 * @param {string} tenantId
 * @param {object} bookingData
 * @returns {Promise<string>} Document ID
 */
export async function createBooking(tenantId, bookingData) {
  const bookingsRef = collection(db, "tenants", tenantId, "bookings");
  const docRef = await addDoc(bookingsRef, bookingData);
  return docRef.id;
}
