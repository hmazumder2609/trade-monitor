import { registry } from '@/services/plugin-registry';
import { RoutineSchedulerPanel } from './Panel';

registry.register({
  id: 'routine-scheduler',
  name: 'Routine Scheduler',
  tab: 'personal' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new RoutineSchedulerPanel(),
});
