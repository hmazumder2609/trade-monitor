import { registry } from '@/services/plugin-registry';
import { RoutineSchedulerPanel } from './Panel';

registry.register({
  id: 'routine-scheduler',
  name: 'Routine Scheduler',
  tab: 'personal' as const,
  dataSource: 'local' as const,
  panel: new RoutineSchedulerPanel(),
});
