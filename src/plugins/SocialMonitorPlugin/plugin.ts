import { registry } from '@/services/plugin-registry';
import { SocialMonitorPanel } from './Panel';

registry.register({
  id: 'social-monitor',
  name: 'Social Monitor',
  tab: 'news' as const,
  refreshIntervalMs: 3 * 60_000,
  dataSource: 'api' as const,
  panel: new SocialMonitorPanel(),
});
