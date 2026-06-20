import { registry } from '@/services/plugin-registry';
import { FeishuPanel } from './Panel';

registry.register({
  id: 'feishu',
  name: 'Feishu',
  tab: 'devops' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'api' as const,
  routePath: '/api/feishu',
  panel: new FeishuPanel(),
});
