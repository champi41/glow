import { collection, getDocsFromServer,  query, where } from "firebase/firestore";
import { db } from "../../config/firebase.js";

/**
 * Get blocks for a tenant on a given date (dateStr YYYY-MM-DD).
 * @param {string} tenantId
 * @param {string} dateStr
 * @returns {Promise<Array<{ id: string, ... }>>}
 */
export async function getBlocksByDate(tenantId, dateStr) {
  const blocksRef = collection(db, "tenants", tenantId, "blocks");
  const q = query(blocksRef, where("dateStr", "==", dateStr));
  const snapshot = await getDocsFromServer(q); // ← cambio
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
