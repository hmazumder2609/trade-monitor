import { registry } from '@/services/plugin-registry';
import { StockPanel } from './Panel';

registry.register({
  id: 'stocks',
  name: 'Markets',
  tab: 'trading' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'api' as const,
  panel: new StockPanel(),
});
