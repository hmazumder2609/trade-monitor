import { registry } from '@/services/plugin-registry';
import { BacktestLogPanel } from './Panel';

registry.register({
  id: 'backtest-log',
  name: 'Backtest Log',
  tab: 'strategy' as const,
  dataSource: 'local' as const,
  panel: new BacktestLogPanel(),
});
