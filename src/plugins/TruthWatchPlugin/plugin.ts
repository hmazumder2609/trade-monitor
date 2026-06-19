import { registry } from '@/services/plugin-registry';
import { TruthWatchPanel } from './Panel';

registry.register({
  id: 'truth-watch',
  name: 'TruthWatch',
  tab: 'news',
  refreshIntervalMs: 180_000,
  dataSource: 'api',
  routePath: '/api/truthwatch',
  panel: new TruthWatchPanel(),
});
