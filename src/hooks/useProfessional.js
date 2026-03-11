import { useQuery } from "@tanstack/react-query";
import { getProfessionalBySlug } from "../lib/firestore/professionals.js";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * @param {string | undefined} tenantId
 * @param {string | undefined} profSlug
 */
export function useProfessional(tenantId, profSlug) {
  return useQuery({
    queryKey: ["professional", tenantId, profSlug],
    queryFn: () => getProfessionalBySlug(tenantId, profSlug),
    enabled: !!tenantId && !!profSlug,
    staleTime: FIVE_MINUTES,
  });
}
