import { registry } from '@/services/plugin-registry';
import { YieldCurvePanel } from './Panel';

registry.register({
  id: 'yield-curve',
  name: 'Yield Curve',
  tab: 'macro' as const,
  refreshIntervalMs: 15 * 60_000,
  dataSource: 'api' as const,
  routePath: '/api/macro',
  panel: new YieldCurvePanel(),
});
