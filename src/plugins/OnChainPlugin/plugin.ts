import { registry } from '@/services/plugin-registry';
import { OnChainPanel } from './Panel';

registry.register({
  id: 'onchain',
  name: 'Whale Transactions',
  tab: 'trading' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new OnChainPanel(),
});
