import { registry } from '@/services/plugin-registry';
import { SchedulePanel } from './Panel';

registry.register({
  id: 'schedule',
  name: 'Schedule',
  tab: 'dashboard' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  masterPanel: 'email',
  panel: new SchedulePanel(),
});
