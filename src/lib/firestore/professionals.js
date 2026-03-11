import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../config/firebase.js";

/**
 * Get professional by slug in tenant's professionals subcollection.
 * @param {string} tenantId - Tenant ID
 * @param {string} profSlug - Professional slug
 * @returns {Promise<{ id: string, ... } | null>} Professional doc with id or null
 */
export async function getProfessionalBySlug(tenantId, profSlug) {
  const professionalsRef = collection(db, "tenants", tenantId, "professionals");
  const q = query(professionalsRef, where("slug", "==", profSlug));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Get active professionals for a tenant, ordered by order field.
 * Requires composite index: tenants/{tenantId}/professionals — isActive (Asc), order (Asc)
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array<{ id: string, ... }>>} Array of professionals with id
 */
export async function getProfessionals(tenantId) {
  const professionalsRef = collection(db, "tenants", tenantId, "professionals");
  const q = query(
    professionalsRef,
    where("isActive", "==", true),
    orderBy("order")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
