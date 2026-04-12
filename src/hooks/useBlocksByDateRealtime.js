import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase.js";

export function useBlocksByDateRealtime(tenantId, dateStr) {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!tenantId || !dateStr) {
      setBlocks([]);
      return;
    }

    const q = query(
      collection(db, "tenants", tenantId, "blocks"),
      where("dateStr", "==", dateStr),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setBlocks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("useBlocksByDateRealtime onSnapshot error:", err);
      },
    );

    return () => unsub();
  }, [tenantId, dateStr]);

  return blocks;
}
