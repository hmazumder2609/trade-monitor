import { registry } from '@/services/plugin-registry';
import { WorldClockPanel } from './Panel';

registry.register({
  id: 'world-clock',
  name: 'World Clock',
  tab: 'dashboard' as const,
  dataSource: 'static' as const,
  panel: new WorldClockPanel(),
});
