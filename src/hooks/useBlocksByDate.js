// src/hooks/useBlocksByDate.js

import { useQuery } from "@tanstack/react-query";
import { getBlocksByDate } from "../lib/firestore/blocks.js";

const THIRTY_SECONDS = 30 * 1000;

/**
 * @param {string | undefined} tenantId
 * @param {string | undefined} dateStr - YYYY-MM-DD
 */
export function useBlocksByDate(tenantId, dateStr) {
  return useQuery({
    queryKey: ["blocks-date", tenantId, dateStr],
    queryFn: () => getBlocksByDate(tenantId, dateStr),
    enabled: !!tenantId && !!dateStr,
    staleTime: THIRTY_SECONDS,
  });
}
