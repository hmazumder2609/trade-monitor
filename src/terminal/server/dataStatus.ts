export type DataFreshness = "current" | "delayed" | "daily" | "reference" | "feed" | "schedule" | "snapshot";

export interface DataStatus {
  provider: string;
  freshness: DataFreshness;
  asOf: string | null;
  delayLabel: string;
  isFallback: boolean;
}

const DEFAULT_DELAY_LABELS: Record<DataFreshness, string> = {
  current: "Current session",
  delayed: "Delayed feed",
  daily: "Daily close data",
  reference: "Reference only",
  feed: "Feed-based publication metadata",
  schedule: "Scheduled release calendar",
  snapshot: "Snapshot / mixed-source view",
};

export function buildDataStatus(input: {
  provider: string;
  freshness: DataFreshness;
  asOf?: string | null;
  delayLabel?: string;
  isFallback?: boolean;
}): DataStatus {
  return {
    provider: input.provider,
    freshness: input.freshness,
    asOf: input.asOf ?? null,
    delayLabel: input.delayLabel ?? DEFAULT_DELAY_LABELS[input.freshness],
    isFallback: input.isFallback ?? false,
  };
}
