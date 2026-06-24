import { registry } from '@/services/plugin-registry';
import { HealthMetricsPanel } from './Panel';

registry.register({
  id: 'health-metrics',
  name: 'Health Metrics',
  tab: 'personal' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new HealthMetricsPanel(),
});
