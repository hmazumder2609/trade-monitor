export interface Habit {
  id: string;
  name: string;
  category: string;
  targetDuration: number;
  unit: string;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  duration: number;
  quality: number;
  notes: string;
  createdAt: string;
}

export interface HealthMetric {
  id: string;
  type: string;
  value: number;
  unit: string;
  date: string;
  notes: string;
  createdAt: string;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  timeOfDay: string;
  daysOfWeek: number[];
  habitIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MentalCheckIn {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  notes: string;
  createdAt: string;
}

type StoreType = 'habits' | 'habit-logs' | 'health-metrics' | 'routines' | 'checkins';

function storageKey(type: StoreType): string {
  return `mdm-${type}`;
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Migrate all habit localStorage data to IndexedDB. Call once on startup. */
export async function migrateHabitStore(): Promise<void> {
  try {
    const { idbPut } = await import('./idb-store');
    const stores: { lsKey: string; storeName: string }[] = [
      { lsKey: 'mdm-habits', storeName: 'habits' },
      { lsKey: 'mdm-habit-logs', storeName: 'habit-logs' },
      { lsKey: 'mdm-health-metrics', storeName: 'health-metrics' },
      { lsKey: 'mdm-routines', storeName: 'routines' },
      { lsKey: 'mdm-checkins', storeName: 'checkins' },
    ];
    for (const { lsKey, storeName } of stores) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          await idbPut(storeName, item);
        }
      }
    }
  } catch (err) {
    console.warn('[migrateHabitStore] IndexedDB migration failed:', err);
  }
}

export function getHabits(): Habit[] {
  return getAll<Habit>('habits');
}

export function saveHabit(data: Omit<Habit, 'id' | 'createdAt'>): Habit {
  const entry: Habit = { ...data, id: generateId(), createdAt: new Date().toISOString() };
  const all = getHabits();
  all.unshift(entry);
  saveAll('habits', all);
  return entry;
}

export function deleteHabit(id: string): void {
  saveAll(
    'habits',
    getHabits().filter(h => h.id !== id)
  );
  saveAll(
    'habit-logs',
    getHabitLogs().filter(l => l.habitId !== id)
  );
}

export function getHabitLogs(): HabitLog[] {
  return getAll<HabitLog>('habit-logs');
}

export function getLogsForHabit(habitId: string): HabitLog[] {
  return getHabitLogs().filter(l => l.habitId === habitId);
}

export function getTodayLogs(): HabitLog[] {
  const d = today();
  return getHabitLogs().filter(l => l.date === d);
}

export function saveHabitLog(data: Omit<HabitLog, 'id' | 'createdAt'>): HabitLog {
  const entry: HabitLog = { ...data, id: generateId(), createdAt: new Date().toISOString() };
  const all = getHabitLogs();
  all.unshift(entry);
  saveAll('habit-logs', all);
  return entry;
}

export function getHealthMetrics(): HealthMetric[] {
  return getAll<HealthMetric>('health-metrics');
}

export function saveHealthMetric(data: Omit<HealthMetric, 'id' | 'createdAt'>): HealthMetric {
  const entry: HealthMetric = { ...data, id: generateId(), createdAt: new Date().toISOString() };
  const all = getHealthMetrics();
  all.unshift(entry);
  saveAll('health-metrics', all);
  return entry;
}

export function deleteHealthMetric(id: string): void {
  saveAll(
    'health-metrics',
    getHealthMetrics().filter(m => m.id !== id)
  );
}

export function getRoutines(): Routine[] {
  return getAll<Routine>('routines');
}

export function saveRoutine(data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>): Routine {
  const entry: Routine = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const all = getRoutines();
  all.unshift(entry);
  saveAll('routines', all);
  return entry;
}

export function deleteRoutine(id: string): void {
  saveAll(
    'routines',
    getRoutines().filter(r => r.id !== id)
  );
}

export function getCheckIns(): MentalCheckIn[] {
  return getAll<MentalCheckIn>('checkins');
}

export function getTodayCheckIn(): MentalCheckIn | undefined {
  const d = today();
  return getCheckIns().find(c => c.date === d);
}

export function saveCheckIn(data: Omit<MentalCheckIn, 'id' | 'createdAt'>): MentalCheckIn {
  const existing = getCheckIns().find(c => c.date === data.date);
  if (existing) {
    const updated = { ...existing, ...data, createdAt: existing.createdAt };
    saveAll(
      'checkins',
      getCheckIns().map(c => (c.id === updated.id ? updated : c))
    );
    return updated;
  }
  const entry: MentalCheckIn = { ...data, id: generateId(), createdAt: new Date().toISOString() };
  const all = getCheckIns();
  all.unshift(entry);
  saveAll('checkins', all);
  return entry;
}
