import { registry } from '@/services/plugin-registry';
import { WeatherPanel } from './Panel';

registry.register({
  id: 'weather',
  name: 'Weather & Time',
  tab: 'dashboard' as const,
  refreshIntervalMs: 30 * 60_000,
  dataSource: 'api' as const,
  panel: new WeatherPanel(),
});
