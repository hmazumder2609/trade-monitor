import { registry } from '@/services/plugin-registry';
import { HealthMetricsPanel } from './Panel';

registry.register({
  id: 'health-metrics',
  name: 'Health Metrics',
  tab: 'habits' as const,
  refreshIntervalMs: 30_000,
  dataSource: 'local' as const,
  panel: new HealthMetricsPanel(),
});
