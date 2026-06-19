import { useQuery } from "@tanstack/react-query";
import type { Alert } from "@shared/schema";

export const alertsQueryKey = ["/api/alerts"] as const;

export function useAlerts() {
  return useQuery<Alert[]>({
    queryKey: alertsQueryKey,
    queryFn: async () => {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
