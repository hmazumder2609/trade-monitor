import { registry } from '@/services/plugin-registry';
import { DevOpsPanel } from './Panel';

registry.register({
  id: 'devops',
  name: 'Process Monitor',
  tab: 'devops' as const,
  refreshIntervalMs: 60_000,
  dataSource: 'api' as const,
  routePath: '/api/system',
  panel: new DevOpsPanel(),
});
