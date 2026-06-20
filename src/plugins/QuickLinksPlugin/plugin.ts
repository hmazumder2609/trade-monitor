import { registry } from '@/services/plugin-registry';
import { QuickLinksPanel } from './Panel';

registry.register({
  id: 'quick-links',
  name: 'Quick Links',
  tab: 'dashboard' as const,
  dataSource: 'static' as const,
  panel: new QuickLinksPanel(),
});
