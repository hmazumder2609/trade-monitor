import { registry } from '@/services/plugin-registry';
import { TradingPanel } from './Panel';

registry.register({
  id: 'trading',
  name: 'Trading Terminal',
  tab: 'trading' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'api' as const,
  panel: new TradingPanel(),
});
