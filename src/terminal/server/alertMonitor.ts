import { evaluateAlerts } from "./alertsEngine";

interface AlertRecord {
  id: number;
  symbol: string;
  condition: "above" | "below";
  price: number;
  triggered: boolean;
}

interface QuoteRecord {
  symbol: string;
  price: number;
}

interface AlertMonitorDependencies {
  loadAlerts: () => Promise<AlertRecord[]>;
  fetchQuotes: (symbols: string[]) => Promise<QuoteRecord[]>;
  triggerAlert: (id: number, details: { triggerPrice: number; triggeredAt: Date }) => Promise<void>;
  now?: () => Date;
}

export async function runAlertEvaluationCycle(deps: AlertMonitorDependencies) {
  const alerts = await deps.loadAlerts();
  const pending = alerts.filter((alert) => !alert.triggered);
  if (!pending.length) return 0;

  const quotes = await deps.fetchQuotes(pending.map((alert) => alert.symbol));
  const triggered = evaluateAlerts(pending, quotes);
  if (!triggered.length) return 0;

  const now = deps.now?.() ?? new Date();
  await Promise.all(triggered.map((item) => deps.triggerAlert(item.id, {
    triggerPrice: item.triggerPrice,
    triggeredAt: now,
  })));

  return triggered.length;
}

export function createAlertMonitor(startCycle: () => Promise<number>, intervalMs: number) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await startCycle();
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();
  void tick();

  return () => clearInterval(timer);
}
