import { registry } from '@/services/plugin-registry';
import { EmailPanel } from './Panel';

registry.register({
  id: 'email',
  name: 'Email',
  tab: 'dashboard' as const,
  refreshIntervalMs: 2 * 60_000,
  dataSource: 'api' as const,
  panel: new EmailPanel(),
});
