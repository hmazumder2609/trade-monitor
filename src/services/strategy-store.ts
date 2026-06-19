export interface StrategyEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  linkedTradeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeReview {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: string;
  exitDate: string;
  pnl: number;
  pnlPercent: number;
  tags: string[];
  notes: string;
  strategyId?: string;
  createdAt: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  setup: string;
  entryCriteria: string;
  exitCriteria: string;
  riskManagement: string;
  tags: string[];
  effectivenessScore: number;
  tradesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BacktestLog {
  id: string;
  strategyName: string;
  parameters: Record<string, string | number | boolean>;
  startDate: string;
  endDate: string;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  tradesCount: number;
  equityCurve: number[];
  notes: string;
  createdAt: string;
}

type StoreType = 'strategies' | 'trades' | 'playbooks' | 'backtests';

type StoreMap = {
  strategies: StrategyEntry;
  trades: TradeReview;
  playbooks: Playbook;
  backtests: BacktestLog;
};

function storageKey(type: StoreType): string {
  return `mdm-strategy-${type}`;
}

function getAll<T>(type: StoreType): T[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(type)) || '[]');
  } catch {
    return [];
  }
}

function saveAll<T>(type: StoreType, items: T[]): void {
  localStorage.setItem(storageKey(type), JSON.stringify(items));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Migrate all localStorage data to IndexedDB. Call once on startup. */
export async function migrateStrategyStore(): Promise<void> {
  try {
    const { idbPut } = await import('./idb-store');
    const stores: StoreType[] = ['strategies', 'trades', 'playbooks', 'backtests'];
    for (const type of stores) {
      const raw = localStorage.getItem(storageKey(type));
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          await idbPut(
            type === 'backtests'
              ? 'backtests'
              : type === 'trades'
                ? 'trades'
                : type === 'playbooks'
                  ? 'playbooks'
                  : 'strategies',
            item
          );
        }
      }
    }
  } catch (err) {
    console.warn('[migrateStrategyStore] IndexedDB migration failed:', err);
  }
}

// --- Strategies ---
export function getStrategies(): StrategyEntry[] {
  return getAll<StrategyEntry>('strategies');
}

export function getStrategy(id: string): StrategyEntry | undefined {
  return getStrategies().find(s => s.id === id);
}

export function saveStrategy(
  data: Omit<StrategyEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): StrategyEntry {
  if (data.id) {
    const existing = getStrategy(data.id);
    if (existing) {
      const updated = {
        ...existing,
        ...data,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      };
      const all = getStrategies().map(s => (s.id === updated.id ? updated : s));
      saveAll('strategies', all);
      return updated;
    }
  }
  const entry: StrategyEntry = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const all = getStrategies();
  all.unshift(entry);
  saveAll('strategies', all);
  return entry;
}

export function deleteStrategy(id: string): void {
  saveAll(
    'strategies',
    getStrategies().filter(s => s.id !== id)
  );
}

// --- Trades ---
export function getTrades(): TradeReview[] {
  return getAll<TradeReview>('trades');
}

export function getTrade(id: string): TradeReview | undefined {
  return getTrades().find(t => t.id === id);
}

export function saveTrade(data: Omit<TradeReview, 'id' | 'createdAt'>): TradeReview {
  const trade: TradeReview = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const all = getTrades();
  all.unshift(trade);
  saveAll('trades', all);
  return trade;
}

export function deleteTrade(id: string): void {
  saveAll(
    'trades',
    getTrades().filter(t => t.id !== id)
  );
}

// --- Playbooks ---
export function getPlaybooks(): Playbook[] {
  return getAll<Playbook>('playbooks');
}

export function getPlaybook(id: string): Playbook | undefined {
  return getPlaybooks().find(p => p.id === id);
}

export function savePlaybook(data: Omit<Playbook, 'id' | 'createdAt' | 'updatedAt'>): Playbook {
  const entry: Playbook = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const all = getPlaybooks();
  all.unshift(entry);
  saveAll('playbooks', all);
  return entry;
}

export function updatePlaybook(id: string, data: Partial<Playbook>): Playbook | undefined {
  const all = getPlaybooks();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  saveAll('playbooks', all);
  return all[idx];
}

export function deletePlaybook(id: string): void {
  saveAll(
    'playbooks',
    getPlaybooks().filter(p => p.id !== id)
  );
}

// --- Backtests ---
export function getBacktests(): BacktestLog[] {
  return getAll<BacktestLog>('backtests');
}

export function getBacktest(id: string): BacktestLog | undefined {
  return getBacktests().find(b => b.id === id);
}

export function saveBacktest(data: Omit<BacktestLog, 'id' | 'createdAt'>): BacktestLog {
  const entry: BacktestLog = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const all = getBacktests();
  all.unshift(entry);
  saveAll('backtests', all);
  return entry;
}

export function deleteBacktest(id: string): void {
  saveAll(
    'backtests',
    getBacktests().filter(b => b.id !== id)
  );
}
