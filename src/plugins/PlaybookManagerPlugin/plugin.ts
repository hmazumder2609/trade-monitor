import { registry } from '@/services/plugin-registry';
import { PlaybookManagerPanel } from './Panel';

registry.register({
  id: 'playbook-manager',
  name: 'Playbook Manager',
  tab: 'strategy' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new PlaybookManagerPanel(),
});
