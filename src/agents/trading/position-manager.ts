/**
 * PositionManager - Track and manage positions across accounts
 */
import {
  getBalances,
  getHoldings,
  listAccounts,
  type SnapTradeBalances,
} from '@/services/snaptrade';

export interface Position {
  symbol: string;
  description: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface AccountPositions {
  accountId: string;
  accountName: string;
  brokerName: string;
  balances: SnapTradeBalances;
  positions: Position[];
}

export class PositionManager {
  async getAllPositions(): Promise<AccountPositions[]> {
    const accounts = await listAccounts();
    const results: AccountPositions[] = [];

    for (const acct of accounts) {
      const [positions, balances] = await Promise.all([getHoldings(acct.id), getBalances(acct.id)]);

      results.push({
        accountId: acct.id,
        accountName: acct.accountName,
        brokerName: acct.brokerageName,
        balances,
        positions: positions.map(p => ({
          symbol: p.symbol,
          description: p.description,
          qty: p.quantity,
          avgCost: p.averagePrice,
          currentPrice: p.currentPrice,
          value: p.marketValue,
          unrealizedPnl: p.unrealizedPnl,
          unrealizedPnlPct: p.unrealizedPnlPercent,
        })),
      });
    }

    return results;
  }

  async getPositionsForAccount(accountId: string): Promise<Position[]> {
    const positions = await getHoldings(accountId);
    return positions.map(p => ({
      symbol: p.symbol,
      description: p.description,
      qty: p.quantity,
      avgCost: p.averagePrice,
      currentPrice: p.currentPrice,
      value: p.marketValue,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPct: p.unrealizedPnlPercent,
    }));
  }

  async getBalancesForAccount(accountId: string): Promise<SnapTradeBalances> {
    return getBalances(accountId);
  }
}

export const positionManager = new PositionManager();
