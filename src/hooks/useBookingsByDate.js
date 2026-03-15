// src/hooks/useBookingsByDate.js

import { useQuery } from "@tanstack/react-query";
import { getBookingsByDate } from "../lib/firestore/bookings.js";

const THIRTY_SECONDS = 30 * 1000;

/**
 * @param {string | undefined} tenantId
 * @param {string | undefined} dateStr - YYYY-MM-DD
 */
export function useBookingsByDate(tenantId, dateStr) {
  return useQuery({
    queryKey: ["bookings-date", tenantId, dateStr],
    queryFn: () => getBookingsByDate(tenantId, dateStr),
    enabled: !!tenantId && !!dateStr,
    staleTime: 0, // ← cambiar a 0
    gcTime: 0, // ← agregar esto — no guardar en cache
  });
}
