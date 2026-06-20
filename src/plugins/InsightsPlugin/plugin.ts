import { registry } from '@/services/plugin-registry';
import { InsightsPanel } from './Panel';

registry.register({
  id: 'insights',
  name: 'AI Summary',
  tab: 'dashboard' as const,
  dataSource: 'api' as const,
  panel: new InsightsPanel(),
});
