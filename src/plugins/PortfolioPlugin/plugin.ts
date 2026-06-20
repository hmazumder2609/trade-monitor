import { registry } from '@/services/plugin-registry';
import { PortfolioPanel } from './Panel';

registry.register({
  id: 'finance',
  name: 'Portfolio',
  tab: 'trading' as const,
  refreshIntervalMs: 10 * 60_000,
  dataSource: 'api' as const,
  panel: new PortfolioPanel(),
});
