import { registry } from '@/services/plugin-registry';
import { HabitTrackerPanel } from './Panel';

registry.register({
  id: 'habit-tracker',
  name: 'Habit Tracker',
  tab: 'habits' as const,
  refreshIntervalMs: 30_000,
  dataSource: 'local' as const,
  panel: HabitTrackerPanel,
});
