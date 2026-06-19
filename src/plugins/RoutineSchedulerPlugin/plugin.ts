import { registry } from '@/services/plugin-registry';
import { RoutineSchedulerPanel } from './Panel';

registry.register({
  id: 'routine-scheduler',
  name: 'Routine Scheduler',
  tab: 'habits' as const,
  refreshIntervalMs: 30_000,
  dataSource: 'local' as const,
  panel: RoutineSchedulerPanel,
});
