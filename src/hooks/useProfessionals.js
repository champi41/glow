import { useQuery } from "@tanstack/react-query";
import { getProfessionals } from "../lib/firestore/professionals.js";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * @param {string | undefined} tenantId - Tenant ID (enabled only when truthy)
 */
export function useProfessionals(tenantId) {
  return useQuery({
    queryKey: ["professionals", tenantId],
    queryFn: () => getProfessionals(tenantId),
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
  });
}
