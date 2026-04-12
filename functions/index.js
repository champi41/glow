require("dotenv").config();

const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const webpush = require("web-push");

initializeApp();

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// ─── Helper: obtener suscripción del profesional ──────────────
async function getPushSubscription(tenantId, professionalId) {
  const snap = await getFirestore()
    .doc(`tenants/${tenantId}/professionals/${professionalId}`)
    .get();
  if (!snap.exists) return null;
  return snap.data()?.pushSubscription || null;
}

// ─── Helper: enviar notificación ─────────────────────────────
async function sendPushNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log("Suscripción expirada:", err.statusCode);
    } else {
      console.error("Error enviando push:", err);
    }
  }
}

// ─── Trigger: nueva reserva ───────────────────────────────────
exports.onBookingCreated = onDocumentCreated(
  "tenants/{tenantId}/bookings/{bookingId}",
  async (event) => {
    const booking = event.data.data();
    const tenantId = event.params.tenantId;

    const profIds = [
      ...new Set(
        (booking.items || []).map((i) => i.professionalId).filter(Boolean),
      ),
    ];

    const serviceNames = (booking.items || [])
      .map((i) => i.serviceName)
      .join(", ");
    const timeStr = booking.items?.[0]?.startTime || "";
    const dateStr = booking.dateStr || booking.date || "";

    for (const profId of profIds) {
      const subscription = await getPushSubscription(tenantId, profId);
      if (!subscription) continue;

      await sendPushNotification(subscription, {
        title: "📅 Nueva reserva",
        body: `${booking.clientName} · ${serviceNames}${dateStr ? ` el ${dateStr}` : ""}${timeStr ? ` a las ${timeStr}` : ""}`,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        data: { url: "/admin/reservas" },
      });
    }
  },
);

// ─── Trigger: reserva cancelada ──────────────────────────────
exports.onBookingCancelled = onDocumentUpdated(
  "tenants/{tenantId}/bookings/{bookingId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const tenantId = event.params.tenantId;

    if (before.status === after.status) return null;
    if (after.status !== "cancelled") return null;

    const profIds = [
      ...new Set(
        (after.items || []).map((i) => i.professionalId).filter(Boolean),
      ),
    ];

    const serviceNames = (after.items || [])
      .map((i) => i.serviceName)
      .join(", ");
    const timeStr = after.items?.[0]?.startTime || "";
    const dateStr = after.dateStr || after.date || "";

    for (const profId of profIds) {
      const subscription = await getPushSubscription(tenantId, profId);
      if (!subscription) continue;

      await sendPushNotification(subscription, {
        title: "❌ Reserva cancelada",
        body: `${after.clientName} canceló · ${serviceNames}${dateStr ? ` el ${dateStr}` : ""}${timeStr ? ` a las ${timeStr}` : ""}`,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        data: { url: "/admin/reservas" },
      });
    }

    return null;
  },
);

// ─── Trigger: cliente subió comprobante de abono ──────────────
exports.onDepositProofUploaded = onDocumentUpdated(
  "tenants/{tenantId}/bookings/{bookingId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const tenantId = event.params.tenantId;

    if (before.depositStatus === after.depositStatus) return null;
    if (after.depositStatus !== "uploaded") return null;

    const profIds = [
      ...new Set(
        (after.items || []).map((i) => i.professionalId).filter(Boolean),
      ),
    ];

    const serviceNames = (after.items || [])
      .map((i) => i.serviceName)
      .join(", ");
    const timeStr = after.items?.[0]?.startTime || "";

    for (const profId of profIds) {
      const subscription = await getPushSubscription(tenantId, profId);
      if (!subscription) continue;

      await sendPushNotification(subscription, {
        title: "📎 Comprobante de abono",
        body: `${after.clientName} subió el comprobante · ${serviceNames} a las ${timeStr}`,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        data: { url: "/admin/reservas" },
      });
    }

    return null;
  },
);
