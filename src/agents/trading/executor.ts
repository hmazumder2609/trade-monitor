/**
 * TradingExecutor - Places orders through SnapTrade
 */
import {
  checkOrderImpact,
  placeOrder,
  resolveSymbolId,
  listAccounts,
  getBalances,
  getBrokerCapabilities,
  getConnectionUrl,
  getOptionsChain,
  buildOptionStrategy,
  executeOptionStrategy,
  type SnapTradeOrderRequest,
  type SnapTradeOrderImpact,
  type SnapTradeBalances,
  type OptionExpiration,
  type OptionStrategyQuote,
} from '@/services/snaptrade';

export interface TradeOrder extends SnapTradeOrderRequest {
  accountId: string;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  error?: string;
  impact?: SnapTradeOrderImpact;
}

export interface AccountInfo {
  id: string;
  name: string;
  broker: string;
  balance: number;
  accountNumber?: string;
  currency?: string;
  brokerageId?: string;
}

export class TradingExecutor {
  async getAccounts(): Promise<AccountInfo[]> {
    const accounts = await listAccounts();
    return accounts.map(a => ({
      id: a.id,
      name: a.accountName,
      broker: a.brokerageName,
      balance: a.balance,
      accountNumber: a.accountNumber,
      currency: a.currency,
      brokerageId: a.brokerageId,
    }));
  }

  async getBalances(accountId: string): Promise<SnapTradeBalances> {
    return getBalances(accountId);
  }

  async resolveSymbol(accountId: string, ticker: string): Promise<string | null> {
    return resolveSymbolId(accountId, ticker);
  }

  async checkImpact(order: TradeOrder): Promise<SnapTradeOrderImpact> {
    return checkOrderImpact(order);
  }

  async place(tradeId: string): Promise<void> {
    return placeOrder(tradeId);
  }

  async execute(order: TradeOrder): Promise<TradeResult> {
    try {
      const impact = await checkOrderImpact(order);
      await placeOrder(impact.tradeId);
      return { success: true, orderId: impact.tradeId, impact };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Order failed' };
    }
  }

  async getCapabilities() {
    return getBrokerCapabilities();
  }

  async reconnect(): Promise<string> {
    return getConnectionUrl({ reconnect: true, redirectUri: window.location.origin });
  }

  async getOptionsChain(accountId: string, universalSymbolId: string): Promise<OptionExpiration[]> {
    return getOptionsChain(accountId, universalSymbolId);
  }

  async buildOptionStrategy(
    accountId: string,
    params: {
      underlyingSymbolId: string;
      optionSymbolId: string;
      action: 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE';
      quantity: number;
    }
  ): Promise<OptionStrategyQuote> {
    return buildOptionStrategy(accountId, params);
  }

  async executeOptionStrategy(
    accountId: string,
    strategyId: string,
    params: { orderType: 'Market' | 'Limit'; timeInForce: 'Day' | 'GTC'; price?: number }
  ): Promise<void> {
    return executeOptionStrategy(accountId, strategyId, params);
  }
}

export const tradingExecutor = new TradingExecutor();
