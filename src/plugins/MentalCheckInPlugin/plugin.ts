import { registry } from '@/services/plugin-registry';
import { MentalCheckInPanel } from './Panel';

registry.register({
  id: 'mental-checkin',
  name: 'Mental Check-In',
  tab: 'personal' as const,
  dataSource: 'local' as const,
  panel: new MentalCheckInPanel(),
});
