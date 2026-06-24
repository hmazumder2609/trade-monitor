import { registry } from '@/services/plugin-registry';
import { StrategyJournalPanel } from './Panel';

registry.register({
  id: 'strategy-journal',
  name: 'Strategy Journal',
  tab: 'strategy' as const,
  dataSource: 'local' as const,
  panel: new StrategyJournalPanel(),
});
