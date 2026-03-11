import { useQuery } from "@tanstack/react-query";
import { getServices } from "../lib/firestore/services.js";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * @param {string | undefined} tenantId - Tenant ID (enabled only when truthy)
 * @param {{ activeOnly?: boolean }} [options] - Si true, solo servicios activos (vista pública)
 */
export function useServices(tenantId, options = {}) {
  const activeOnly = !!options.activeOnly;
  return useQuery({
    queryKey: ["services", tenantId, activeOnly],
    queryFn: () => getServices(tenantId, { activeOnly }),
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
  });
}
