// src/lib/firestore/services.js

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../config/firebase.js";

/**
 * @param {string} tenantId
 * @param {{ activeOnly?: boolean }} [options] - Si activeOnly es true, devuelve solo servicios con isActive === true
 */
export async function getServices(tenantId, options = {}) {
  const servicesRef = collection(db, "tenants", tenantId, "services");
  const q = query(servicesRef, orderBy("order"));
  const snapshot = await getDocs(q);
  let list = snapshot.docs.map((d) => ({
    isActive: true,
    ...d.data(),
    id: d.id,
  }));
  if (options.activeOnly) {
    list = list.filter((s) => s.isActive === true);
  }
  return list;
}
