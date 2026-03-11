import { useQuery } from "@tanstack/react-query";
import {
  getApprovedReviewsByProf,
  getApprovedReviews,
  getPendingReviews,
} from "../lib/firestore/reviews.js";

export function useApprovedReviewsByProf(tenantId, professionalId) {
  return useQuery({
    queryKey: ["reviews-prof", tenantId, professionalId],
    queryFn: () => getApprovedReviewsByProf(tenantId, professionalId),
    enabled: !!tenantId && !!professionalId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useApprovedReviews(tenantId) {
  return useQuery({
    queryKey: ["reviews", tenantId],
    queryFn: () => getApprovedReviews(tenantId),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePendingReviews(tenantId) {
  return useQuery({
    queryKey: ["reviews-pending", tenantId],
    queryFn: () => getPendingReviews(tenantId),
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });
}
