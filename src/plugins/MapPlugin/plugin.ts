import { registry } from '@/services/plugin-registry';
import { MapPanel } from './Panel';

registry.register({
  id: 'map',
  name: 'Global Map',
  tab: 'dashboard' as const,
  dataSource: 'api' as const,
  panel: new MapPanel(),
});
