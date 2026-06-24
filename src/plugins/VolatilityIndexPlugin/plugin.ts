import { registry } from '@/services/plugin-registry';
import { VixGaugePanel, VolatilityIndexPanel } from './Panel';

registry.register({
  id: 'vix-gauge',
  name: 'VIX Fear Gauge',
  tab: 'dashboard' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new VixGaugePanel(),
});

registry.register({
  id: 'volatility-index',
  name: 'Volatility Index',
  tab: 'trading' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new VolatilityIndexPanel(),
});
