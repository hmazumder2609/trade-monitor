import { registry } from '@/services/plugin-registry';
import { FinancialNewsPanel } from './Panel';

registry.register({
  id: 'financial-news',
  name: 'Financial News',
  tab: 'news' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new FinancialNewsPanel(),
});
