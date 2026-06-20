import { registry } from '@/services/plugin-registry';
import { SocialPanel } from './Panel';

registry.register({
  id: 'social',
  name: 'Tech Community',
  tab: 'dashboard' as const,
  refreshIntervalMs: 3 * 60_000,
  dataSource: 'api' as const,
  panel: new SocialPanel(),
});
