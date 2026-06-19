import { registry } from '@/services/plugin-registry';
import { RedditPulsePanel } from './Panel';

registry.register({
  id: 'reddit-pulse',
  name: 'RedditPulse',
  tab: 'news',
  refreshIntervalMs: 180_000,
  dataSource: 'api',
  routePath: '/api/reddit-pulse',
  panel: new RedditPulsePanel(),
});
