import { registry } from '@/services/plugin-registry';
import { CodeStatusPanel } from './Panel';

registry.register({
  id: 'code-status',
  name: 'Coding Hub',
  tab: 'devops' as const,
  refreshIntervalMs: 2 * 60_000,
  dataSource: 'api' as const,
  routePath: '/api/github',
  panel: new CodeStatusPanel(),
});
