import { registry } from '@/services/plugin-registry';
import { TradeReviewPanel } from './Panel';

registry.register({
  id: 'trade-review',
  name: 'Trade Review',
  tab: 'strategy' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new TradeReviewPanel(),
});
