import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase.js";

export function useBookingsByDateRealtime(tenantId, dateStr) {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!tenantId || !dateStr) {
      setBookings([]);
      return;
    }

    const q = query(
      collection(db, "tenants", tenantId, "bookings"),
      where("dateStr", "==", dateStr),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("useBookingsByDateRealtime onSnapshot error:", err);
      },
    );

    return () => unsub();
  }, [tenantId, dateStr]);

  return bookings;
}
