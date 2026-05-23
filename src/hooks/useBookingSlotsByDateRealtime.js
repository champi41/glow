import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase.js";

export function useBookingSlotsByDateRealtime(tenantId, dateStr) {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (!tenantId || !dateStr) {
      setSlots([]);
      return;
    }

    const q = query(
      collection(db, "tenants", tenantId, "bookingSlots"),
      where("dateStr", "==", dateStr),
      where("status", "==", "active"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("useBookingSlotsByDateRealtime onSnapshot error:", err);
      },
    );

    return () => unsub();
  }, [tenantId, dateStr]);

  return slots;
}
