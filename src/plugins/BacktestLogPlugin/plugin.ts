import { registry } from '@/services/plugin-registry';
import { BacktestLogPanel } from './Panel';

registry.register({
  id: 'backtest-log',
  name: 'Backtest Log',
  tab: 'strategy' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'local' as const,
  panel: new BacktestLogPanel(),
});
