// src/lib/firestore/tenants.js

import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";

export async function getTenantBySlug(slug) {
  const q = query(collection(db, "tenants"), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getTenantById(tenantId) {
  console.log("getTenantById llamado con:", tenantId);
  const snap = await getDoc(doc(db, "tenants", tenantId));
  console.log("snap exists:", snap.exists(), snap.data());
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
