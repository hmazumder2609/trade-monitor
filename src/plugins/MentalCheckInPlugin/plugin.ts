import { registry } from '@/services/plugin-registry';
import { MentalCheckInPanel } from './Panel';

registry.register({
  id: 'mental-checkin',
  name: 'Mental Check-In',
  tab: 'personal' as const,
  refreshIntervalMs: 30_000,
  dataSource: 'local' as const,
  panel: new MentalCheckInPanel(),
});
