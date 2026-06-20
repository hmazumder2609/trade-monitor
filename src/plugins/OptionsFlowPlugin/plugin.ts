import { registry } from '@/services/plugin-registry';
import { OptionsFlowPanel } from './Panel';

registry.register({
  id: 'options-flow',
  name: 'Unusual Options Activity',
  tab: 'trading' as const,
  refreshIntervalMs: 3 * 60_000,
  dataSource: 'api' as const,
  panel: new OptionsFlowPanel(),
});
