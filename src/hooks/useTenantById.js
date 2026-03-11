// src/hooks/useTenantById.js

import { useQuery } from "@tanstack/react-query";
import { getTenantById } from "../lib/firestore/tenants.js";

export function useTenantById(tenantId) {
  return useQuery({
    queryKey: ["tenant-by-id", tenantId],
    queryFn: () => getTenantById(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
