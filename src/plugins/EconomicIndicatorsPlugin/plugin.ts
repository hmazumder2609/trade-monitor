import { registry } from '@/services/plugin-registry';
import { EconomicIndicatorsPanel } from './Panel';

registry.register({
  id: 'economic-indicators',
  name: 'Economic Indicators',
  tab: 'macro' as const,
  refreshIntervalMs: 15 * 60_000,
  dataSource: 'api' as const,
  routePath: '/api/macro',
  panel: new EconomicIndicatorsPanel(),
});
