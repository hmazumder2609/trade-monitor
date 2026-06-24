import { registry } from '@/services/plugin-registry';
import { HabitTrackerPanel } from './Panel';

registry.register({
  id: 'habit-tracker',
  name: 'Habit Tracker',
  tab: 'personal' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new HabitTrackerPanel(),
});
