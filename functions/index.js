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

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function getPublicAppBaseUrl() {
  const explicit = normalizeBaseUrl(process.env.APP_BASE_URL);
  if (explicit) return explicit;

  const vercel = normalizeBaseUrl(process.env.VERCEL_URL);
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  return "";
}

function getBookingStatusUrl(tenantSlug, bookingId) {
  const baseUrl = getPublicAppBaseUrl();
  if (!baseUrl || !tenantSlug || !bookingId) return null;
  return `${baseUrl}/${tenantSlug}/reserva/${bookingId}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStatusEmailTemplate({
  tenantName,
  clientName,
  status,
  dateStr,
  timeStr,
  serviceNames,
  statusUrl,
}) {
  const isConfirmed = status === "confirmed";
  const title = isConfirmed
    ? "Tu reserva fue confirmada"
    : "Tu reserva fue cancelada";
  const intro = isConfirmed
    ? `${tenantName} confirmó tu reserva.`
    : `${tenantName} actualizó tu reserva como cancelada.`;
  const actionLabel = isConfirmed
    ? "Ver estado de tu reserva"
    : "Ver detalle de la reserva";

  const safeTenant = escapeHtml(tenantName);
  const safeClient = escapeHtml(clientName);
  const safeIntro = escapeHtml(intro);
  const safeDate = escapeHtml(dateStr || "");
  const safeTime = escapeHtml(timeStr || "");
  const safeServices = escapeHtml(serviceNames || "");

  const detailsLine = [
    safeDate ? `Fecha: ${safeDate}` : "",
    safeTime ? `Hora: ${safeTime}` : "",
    safeServices ? `Servicios: ${safeServices}` : "",
  ]
    .filter(Boolean)
    .join("<br />");

  const actionBlock = statusUrl
    ? `<p style="margin:24px 0 8px;"><a href="${statusUrl}" style="display:inline-block;background:#1f7a5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">${actionLabel}</a></p>
       <p style="margin:0;color:#6b7280;font-size:12px;">Si el botón no funciona, copia este enlace:<br /><span style="word-break:break-all;">${statusUrl}</span></p>`
    : "";

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;background:#f7f7f8;padding:24px;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <h2 style="margin:0 0 12px;font-size:22px;">${title}</h2>
        <p style="margin:0 0 10px;">Hola ${safeClient || ""},</p>
        <p style="margin:0 0 14px;">${safeIntro}</p>
        <div style="margin:0 0 10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;line-height:1.55;">
          ${detailsLine || "Sin detalles adicionales."}
        </div>
        ${actionBlock}
        <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">Este correo fue enviado por ${safeTenant}.</p>
      </div>
    </div>
  `;

  const textContent = [
    title,
    `Hola ${clientName || ""},`,
    intro,
    dateStr ? `Fecha: ${dateStr}` : "",
    timeStr ? `Hora: ${timeStr}` : "",
    serviceNames ? `Servicios: ${serviceNames}` : "",
    statusUrl ? `Estado de reserva: ${statusUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `${isConfirmed ? "Reserva confirmada" : "Reserva cancelada"} · ${tenantName}`,
    htmlContent,
    textContent,
  };
}

async function getTenantPublicData(tenantId) {
  const snap = await getFirestore().doc(`tenants/${tenantId}`).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  return {
    name: data.name || "Tu negocio",
    slug: data.slug || null,
  };
}

async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Reservas";

  if (!apiKey || !senderEmail || !toEmail) return;

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName || "" }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Brevo SMTP error (${res.status}): ${errText}`);
  }
}

async function sendBookingStatusEmailToClient({
  tenantId,
  bookingId,
  booking,
  status,
}) {
  const clientEmail = (booking.clientEmail || "").trim();
  if (!clientEmail) return;

  const tenant = await getTenantPublicData(tenantId);
  if (!tenant) return;

  const serviceNames = (booking.items || [])
    .map((i) => i.serviceName)
    .filter(Boolean)
    .join(", ");
  const timeStr = booking.items?.[0]?.startTime || "";
  const dateStr = booking.dateStr || booking.date || "";
  const statusUrl = getBookingStatusUrl(tenant.slug, bookingId);

  const emailData = buildStatusEmailTemplate({
    tenantName: tenant.name,
    clientName: booking.clientName || "",
    status,
    dateStr,
    timeStr,
    serviceNames,
    statusUrl,
  });

  await sendBrevoEmail({
    toEmail: clientEmail,
    toName: booking.clientName || "",
    ...emailData,
  });
}

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
    const bookingId = event.params.bookingId;

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

    // Si la reserva se creó ya confirmada (auto-confirmación), enviar correo al cliente.
    if (booking.status === "confirmed") {
      try {
        await sendBookingStatusEmailToClient({
          tenantId,
          bookingId,
          booking,
          status: "confirmed",
        });
      } catch (err) {
        console.error("Error enviando correo de confirmación (create):", err);
      }
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
    const bookingId = event.params.bookingId;

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

    try {
      await sendBookingStatusEmailToClient({
        tenantId,
        bookingId,
        booking: after,
        status: "cancelled",
      });
    } catch (err) {
      console.error("Error enviando correo de cancelación:", err);
    }

    return null;
  },
);

// ─── Trigger: reserva confirmada ─────────────────────────────
exports.onBookingConfirmed = onDocumentUpdated(
  "tenants/{tenantId}/bookings/{bookingId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const tenantId = event.params.tenantId;
    const bookingId = event.params.bookingId;

    if (before.status === after.status) return null;
    if (after.status !== "confirmed") return null;

    try {
      await sendBookingStatusEmailToClient({
        tenantId,
        bookingId,
        booking: after,
        status: "confirmed",
      });
    } catch (err) {
      console.error("Error enviando correo de confirmación:", err);
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
