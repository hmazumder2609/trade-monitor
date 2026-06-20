import { registry } from '@/services/plugin-registry';
import { LiveNewsPanel } from './Panel';

registry.register({
  id: 'live-news',
  name: 'Live News',
  tab: 'news' as const,
  dataSource: 'static' as const,
  panel: new LiveNewsPanel(),
});
