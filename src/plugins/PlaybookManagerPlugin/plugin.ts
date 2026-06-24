import { registry } from '@/services/plugin-registry';
import { PlaybookManagerPanel } from './Panel';

registry.register({
  id: 'playbook-manager',
  name: 'Playbook Manager',
  tab: 'strategy' as const,
  dataSource: 'local' as const,
  panel: new PlaybookManagerPanel(),
});
