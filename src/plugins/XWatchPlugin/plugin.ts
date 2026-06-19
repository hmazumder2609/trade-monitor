import { registry } from '@/services/plugin-registry';
import { XWatchPanel } from './Panel';

registry.register({
  id: 'x-watch',
  name: 'XWatch',
  tab: 'news',
  refreshIntervalMs: 180_000,
  dataSource: 'api',
  routePath: '/api/xwatch',
  panel: new XWatchPanel(),
});
