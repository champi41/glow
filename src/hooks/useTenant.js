import { useQuery } from "@tanstack/react-query";
import { getTenantBySlug, getTenantById } from "../lib/firestore/tenants.js";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * @param {string} slug - Tenant slug from URL
 */
export function useTenant(slug) {
  return useQuery({
    queryKey: ["tenant", slug],
    queryFn: () => getTenantBySlug(slug),
    staleTime: FIVE_MINUTES,
  });
}
export function useTenantById(tenantId) {
  return useQuery({
    queryKey: ["tenant-by-id", tenantId],
    queryFn: () => getTenantById(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}