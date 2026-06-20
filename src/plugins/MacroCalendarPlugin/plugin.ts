import { registry } from '@/services/plugin-registry';
import { MacroCalendarPanel } from './Panel';

registry.register({
  id: 'macro-calendar',
  name: 'Macro Calendar',
  tab: 'macro' as const,
  refreshIntervalMs: 15 * 60_000,
  dataSource: 'api' as const,
  routePath: '/api/macro',
  panel: new MacroCalendarPanel(),
});
