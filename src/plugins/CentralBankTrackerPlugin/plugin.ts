import { registry } from '@/services/plugin-registry';
import { CentralBankTrackerPanel } from './Panel';

registry.register({
  id: 'central-bank-tracker',
  name: 'Central Bank Tracker',
  tab: 'macro' as const,
  refreshIntervalMs: 15 * 60_000,
  dataSource: 'api' as const,
  routePath: '/api/macro',
  panel: new CentralBankTrackerPanel(),
});
