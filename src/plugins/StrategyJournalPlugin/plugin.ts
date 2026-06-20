import { registry } from '@/services/plugin-registry';
import { StrategyJournalPanel } from './Panel';

registry.register({
  id: 'strategy-journal',
  name: 'Strategy Journal',
  tab: 'strategy' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'local' as const,
  panel: new StrategyJournalPanel(),
});
