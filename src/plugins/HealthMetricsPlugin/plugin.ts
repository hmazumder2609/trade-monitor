import { registry } from '@/services/plugin-registry';
import { HealthMetricsPanel } from './Panel';

registry.register({
  id: 'health-metrics',
  name: 'Health Metrics',
  tab: 'personal' as const,
  dataSource: 'local' as const,
  panel: new HealthMetricsPanel(),
});
