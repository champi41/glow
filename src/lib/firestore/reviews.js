// src/lib/firestore/reviews.js
//
// ÍNDICES COMPUESTOS EN FIREBASE CONSOLE (Firestore → Indexes):
// 1. Collection: tenants/{tenantId}/reviews
//    - professionalId (Asc) + status (Asc) + createdAt (Desc)  [legacy, una reseña por pro]
// 2. Collection: tenants/{tenantId}/reviews
//    - professionalIds (Array-contains) + status (Asc) + createdAt (Desc)  [varios pros por reserva]
// 3. Collection: tenants/{tenantId}/reviews
//    - status (Asc) + createdAt (Desc)
// 4. Collection: tenants/{tenantId}/reviews
//    - bookingId (Asc)  [single field, for "review by booking" check]

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase.js";

/**
 * Normaliza profesionales de la reserva: arrays únicos de ids y nombres (orden de aparición).
 * Incluye professionalId/professionalName (primero) para compatibilidad con reseñas antiguas.
 */
function normalizeProfessionalsFromItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { professionalIds: [], professionalNames: [], professionalId: null, professionalName: null };
  }
  const seen = new Set();
  const professionalIds = [];
  const professionalNames = [];
  for (const item of items) {
    const id = item.professionalId;
    const name = item.professionalName ?? "";
    if (id && !seen.has(id)) {
      seen.add(id);
      professionalIds.push(id);
      professionalNames.push(name);
    }
  }
  return {
    professionalIds,
    professionalNames,
    professionalId: professionalIds[0] ?? null,
    professionalName: professionalNames[0] ?? null,
  };
}

export async function createReview(tenantId, reviewData) {
  const existing = await getDocs(
    query(
      collection(db, "tenants", tenantId, "reviews"),
      where("bookingId", "==", reviewData.bookingId)
    )
  );
  if (!existing.empty) throw new Error("Ya existe una reseña para esta reserva.");
  const { professionalIds, professionalNames, professionalId, professionalName } =
    reviewData.professionalIds != null
      ? {
          professionalIds: reviewData.professionalIds,
          professionalNames: reviewData.professionalNames ?? [],
          professionalId: reviewData.professionalIds[0] ?? null,
          professionalName: (reviewData.professionalNames ?? [])[0] ?? null,
        }
      : normalizeProfessionalsFromItems(reviewData.items ?? []);
  const payload = {
    bookingId: reviewData.bookingId,
    clientName: reviewData.clientName,
    clientPhone: reviewData.clientPhone,
    serviceNames: reviewData.serviceNames ?? [],
    rating: reviewData.rating,
    comment: reviewData.comment ?? null,
    date: reviewData.date,
    professionalIds,
    professionalNames,
    professionalId,
    professionalName,
    status: "pending",
    createdAt: serverTimestamp(),
  };
  return addDoc(collection(db, "tenants", tenantId, "reviews"), payload);
}

/**
 * Reseñas aprobadas que corresponden a este profesional (legacy: professionalId;
 * nuevo: professionalIds array-contains). Incluye reservas con varios pros.
 */
export async function getApprovedReviewsByProf(tenantId, professionalId) {
  const coll = collection(db, "tenants", tenantId, "reviews");
  const [legacySnap, newSnap] = await Promise.all([
    getDocs(
      query(
        coll,
        where("professionalId", "==", professionalId),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc")
      )
    ),
    getDocs(
      query(
        coll,
        where("professionalIds", "array-contains", professionalId),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc")
      )
    ),
  ]);
  const byId = new Map();
  for (const d of legacySnap.docs) {
    byId.set(d.id, { id: d.id, ...d.data() });
  }
  for (const d of newSnap.docs) {
    if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...d.data() });
  }
  const list = Array.from(byId.values());
  list.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
    const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
  return list;
}

export async function getApprovedReviews(tenantId) {
  const snap = await getDocs(
    query(
      collection(db, "tenants", tenantId, "reviews"),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPendingReviews(tenantId) {
  const snap = await getDocs(
    query(
      collection(db, "tenants", tenantId, "reviews"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateReviewStatus(tenantId, reviewId, status) {
  return updateDoc(doc(db, "tenants", tenantId, "reviews", reviewId), { status });
}

export async function getBookingById(tenantId, bookingId) {
  const snap = await getDoc(doc(db, "tenants", tenantId, "bookings", bookingId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Devuelve la reseña asociada a un booking si existe (para mostrar "Ya dejaste una reseña"). */
export async function getReviewByBookingId(tenantId, bookingId) {
  const snap = await getDocs(
    query(
      collection(db, "tenants", tenantId, "reviews"),
      where("bookingId", "==", bookingId),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
