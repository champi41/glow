import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase.js";
import { VAPID_PUBLIC_KEY } from "../config/vapid.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications({ tenantId, professionalId }) {
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    setIsIOS(/iPad|iPhone|iPod/i.test(ua));
    setIsStandalone(window.matchMedia?.("(display-mode: standalone)")?.matches ?? false);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub));
    });
  }, []);

  async function subscribe() {
    if (!tenantId || !professionalId) return;
    setLoading(true);
    setError(null);
    try {
      if (!window.isSecureContext) {
        throw new Error("Las notificaciones push requieren HTTPS (o localhost).");
      }
      if (!("Notification" in window)) {
        throw new Error("Este navegador no soporta notificaciones.");
      }
      if (!VAPID_PUBLIC_KEY || typeof VAPID_PUBLIC_KEY !== "string" || VAPID_PUBLIC_KEY.length < 40) {
        throw new Error("VAPID_PUBLIC_KEY inválida. Revisa `src/config/vapid.js`.");
      }

      const result = await window.Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      let appServerKey;
      try {
        appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      } catch {
        throw new Error("VAPID_PUBLIC_KEY malformada (base64url). Vuelve a copiarla completa.");
      }
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      await updateDoc(
        doc(db, "tenants", tenantId, "professionals", professionalId),
        { pushSubscription: subscription.toJSON() }
      );

      setSubscribed(true);
    } catch (err) {
      console.error("Error al suscribirse a notificaciones:", err);
      const msg = err?.message || "No se pudo activar notificaciones.";
      // Mensaje más guiado para el error típico de Chrome
      if (/push service error/i.test(msg)) {
        setError(
          "Falló el servicio push del navegador. Asegúrate de estar en HTTPS/localhost, no estar en incógnito y vuelve a intentar. Si persiste, borra datos del sitio y vuelve a suscribirte."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await updateDoc(
        doc(db, "tenants", tenantId, "professionals", professionalId),
        { pushSubscription: null }
      );

      setSubscribed(false);
    } catch (err) {
      console.error("Error al desuscribirse:", err);
      setError(err?.message || "No se pudo desactivar notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  const isSupported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext;

  return {
    permission,
    subscribed,
    loading,
    isSupported,
    subscribe,
    unsubscribe,
    error,
    isIOS,
    isStandalone,
  };
}

