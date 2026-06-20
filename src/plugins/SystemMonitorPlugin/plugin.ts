import { registry } from '@/services/plugin-registry';
import { SystemMonitorPanel } from './Panel';

registry.register({
  id: 'system-monitor',
  name: 'System Monitor',
  tab: 'devops' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'api' as const,
  routePath: '/api/health',
  panel: new SystemMonitorPanel(),
});
