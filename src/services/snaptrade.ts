/**
 * SnapTrade service - handles auth, account management, and order placement.
 * API docs: https://docs.snaptrade.com
 *
 * Flow: clientId + consumerKey → register user → get redirect URL → user connects brokerage
 * Then: list accounts, get holdings, place orders via the proxy.
 */
import { getSecret } from './settings-store';

const SNAPTRADE_USER_KEY = 'mdm-snaptrade-user';
const API_BASE = '/api/snaptrade';

export class SnapTradeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'SnapTradeError';
  }
}

export type BrokerCapability = 'read' | 'trade';

export const BROKER_IDS = {
  ibkr: 'IBKR',
  wealthsimple: 'Wealthsimple',
  questrade: 'Questrade',
  alpaca: 'Alpaca',
} as const;

export type BrokerName = (typeof BROKER_IDS)[keyof typeof BROKER_IDS];

export interface BrokerAuthorization {
  brokerageId: string;
  brokerageName: string;
  connectionType: BrokerCapability;
  isDisabled: boolean;
  accountIds: string[];
}

export interface BrokerCapabilities {
  brokerages: BrokerAuthorization[];
  canTrade: boolean; // true if ANY brokerage has trade permissions
}

export interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

export interface SnapTradeAccount {
  id: string;
  brokerageId: string;
  brokerageName: string;
  accountName: string;
  accountNumber: string;
  balance: number;
  currency: string;
}

export interface SnapTradeBalances {
  cash: number;
  cashCurrency: string;
  buyingPower: number;
  buyingPowerCurrency: string;
  portfolioValue: number;
  currency: string;
}

export interface SnapTradeHolding {
  symbol: string;
  description: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface SnapTradeOrderRequest {
  accountId: string;
  action: 'BUY' | 'SELL';
  orderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit';
  timeInForce: 'Day' | 'GTC' | 'FOK' | 'IOC';
  symbol: string;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  // Options fields
  isOption?: boolean;
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expirationDate?: string;
  contracts?: number;
}

export interface SnapTradeOrderImpact {
  tradeId: string;
  estimatedCommission: number;
  estimatedValue: number;
  buyingPower: number;
  buyingPowerEffect: number;
  warnings: string[];
}

// ---- User management ----

export function getSnapTradeUser(): SnapTradeUser | null {
  try {
    const raw = localStorage.getItem(SNAPTRADE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSnapTradeUser(user: SnapTradeUser): void {
  localStorage.setItem(SNAPTRADE_USER_KEY, JSON.stringify(user));
}

export function clearSnapTradeUser(): void {
  localStorage.removeItem(SNAPTRADE_USER_KEY);
}

/**
 * Fully reset the SnapTrade user - deletes the user on SnapTrade's side
 * (freeing the personal-key quota), clears it from .env server-side, and
 * removes it from localStorage. Use this to recover from orphaned-user state.
 */
export async function resetSnapTradeUser(): Promise<void> {
  const user = getSnapTradeUser();
  try {
    await snapFetch('/deleteUser', {
      method: 'POST',
      body: JSON.stringify(user ? { userId: user.userId } : {}),
    });
  } catch {
    /* ignore - proceed with local cleanup either way */
  }
  clearSnapTradeUser();
}

export function isSnapTradeConfigured(): boolean {
  return !!getSecret('SNAPTRADE_CLIENT_ID') && !!getSecret('SNAPTRADE_CONSUMER_KEY');
}

// ---- API calls (proxied through server) ----

async function snapFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const user = getSnapTradeUser();
  const clientId = getSecret('SNAPTRADE_CLIENT_ID');
  const consumerKey = getSecret('SNAPTRADE_CONSUMER_KEY');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (user) {
    headers['X-SnapTrade-UserId'] = user.userId;
    headers['X-SnapTrade-UserSecret'] = user.userSecret;
  }
  if (clientId) {
    headers['X-SnapTrade-ClientId'] = clientId;
  }
  if (consumerKey) {
    headers['X-SnapTrade-ConsumerKey'] = consumerKey;
  }

  const resp = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new SnapTradeError(
      `SnapTrade API error ${resp.status}: ${errText}`,
      undefined,
      resp.status
    );
  }

  return resp.json();
}

/**
 * Register a new SnapTrade user, or reuse the one already stored server-side.
 * Personal keys can only register a single user, so the server returns the
 * existing userId/userSecret if one exists in .env instead of re-registering.
 */
export async function registerUser(userId: string): Promise<SnapTradeUser> {
  const data = await snapFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  // Server is authoritative: it may return a reused userId different from the one we sent.
  const user: SnapTradeUser = {
    userId: data.userId || userId,
    userSecret: data.userSecret,
  };
  saveSnapTradeUser(user);
  return user;
}

export interface ConnectionOptions {
  redirectUri?: string;
  reconnect?: boolean;
  broker?: string;
}

export async function getConnectionUrl(options?: ConnectionOptions): Promise<string> {
  const body: Record<string, unknown> = {};
  if (options?.redirectUri) body.redirectUri = options.redirectUri;
  if (options?.reconnect) body.reconnect = true;
  if (options?.broker) body.broker = options.broker;
  const data = await snapFetch('/connect', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.redirectURI || data.url;
}

export async function getBrokerCapabilities(): Promise<BrokerCapabilities> {
  const data = await snapFetch('/authorizations');
  const auths = data?.authorizations || data || [];
  const brokerList: BrokerAuthorization[] = (Array.isArray(auths) ? auths : [auths]).map(
    (a: any) => ({
      brokerageId: a.brokerageId || a.institution_id || '',
      brokerageName: a.brokerageName || a.institution_name || 'Unknown',
      connectionType: (a.connectionType || a.connection_type || 'read') as BrokerCapability,
      isDisabled: a.isDisabled === true || a.is_disabled === true,
      accountIds: a.accountIds || a.account_ids || (a.accounts ? Object.keys(a.accounts) : []),
    })
  );
  return {
    brokerages: brokerList,
    canTrade: brokerList.some(b => b.connectionType === 'trade' && !b.isDisabled),
  };
}

/** List connected brokerage accounts. */
export async function listAccounts(): Promise<SnapTradeAccount[]> {
  const data = await snapFetch('/accounts');
  return (data || []).map((a: any) => {
    // SnapTrade response shape: { id, name, number, institution_name,
    //   brokerage_authorization, balance: { total: { amount, currency } }, meta, is_paper, ... }
    const brokerName =
      a.institution_name ||
      a.meta?.institution_name ||
      a.brokerage?.name ||
      a.brokerageName ||
      'Unknown';
    const isPaper = a.is_paper === true;
    return {
      id: a.id || a.accountId,
      brokerageId: a.brokerage_authorization || a.brokerage?.id || '',
      brokerageName: isPaper && !/paper/i.test(brokerName) ? `${brokerName} (Paper)` : brokerName,
      accountName: a.meta?.type || a.name || a.accountName || 'Trading Account',
      accountNumber: a.number || a.accountNumber || '',
      balance: a.balance?.total?.amount ?? a.balance?.cash ?? a.cash ?? 0,
      currency: a.balance?.total?.currency || a.currency?.code || a.currency || 'USD',
    };
  });
}

export async function getBalances(accountId: string): Promise<SnapTradeBalances> {
  const data = await snapFetch(`/accounts/${accountId}/balances`);
  return {
    cash: data?.cash?.amount ?? data?.cash ?? 0,
    cashCurrency: data?.cash?.currency ?? data?.cashCurrency ?? 'USD',
    buyingPower: data?.buyingPower?.amount ?? data?.buying_power ?? 0,
    buyingPowerCurrency: data?.buyingPower?.currency ?? data?.buyingPowerCurrency ?? 'USD',
    portfolioValue: data?.portfolioValue?.amount ?? data?.portfolio_value ?? 0,
    currency: data?.cash?.currency ?? data?.cashCurrency ?? 'USD',
  };
}

export async function getHoldings(accountId: string): Promise<SnapTradeHolding[]> {
  const data = await snapFetch(`/accounts/${accountId}/holdings`);
  const positions = data?.positions ?? data ?? [];
  return (Array.isArray(positions) ? positions : [positions]).filter(Boolean).map((p: any) => ({
    symbol: p.symbol?.symbol || p.symbol || '',
    description: p.symbol?.description || p.description || '',
    quantity: p.units ?? p.quantity ?? 0,
    averagePrice: p.averagePurchasePrice ?? p.averagePrice ?? 0,
    currentPrice: p.currentPrice ?? p.price ?? 0,
    marketValue: p.currentMarketValue ?? p.marketValue ?? 0,
    unrealizedPnl: p.openPnl ?? p.unrealizedPnl ?? 0,
    unrealizedPnlPercent: p.openPnlPercent ?? 0,
  }));
}

/** Check order impact (validate before placing). order.symbol must be a universal_symbol_id (UUID). */
export async function checkOrderImpact(
  order: SnapTradeOrderRequest
): Promise<SnapTradeOrderImpact> {
  const data = await snapFetch('/trade/impact', {
    method: 'POST',
    body: JSON.stringify({
      account_id: order.accountId,
      action: order.action,
      order_type: order.orderType,
      time_in_force: order.timeInForce,
      universal_symbol_id: order.symbol,
      units: order.isOption ? order.contracts : order.quantity,
      price: order.limitPrice ?? null,
      stop: order.stopPrice ?? null,
    }),
  });
  // SnapTrade response: { trade: { id, account, symbol, units, price, ... }, trade_impacts: [...], combined_remaining_balance: { amount, currency } }
  const trade = data?.trade || {};
  const remaining = data?.combined_remaining_balance || data?.combinedRemainingBalance || {};
  return {
    tradeId: trade.id || data?.tradeId || '',
    estimatedCommission: data?.estimated_commissions ?? data?.estimatedCommission ?? 0,
    estimatedValue: (trade.units || 0) * (trade.price || 0),
    buyingPower: remaining.amount ?? remaining.buyingPower ?? 0,
    buyingPowerEffect: data?.buying_power_effect ?? data?.buyingPowerEffect ?? 0,
    warnings: data?.warnings || [],
  };
}

/** Place a previously validated order by tradeId. */
export async function placeOrder(tradeId: string): Promise<any> {
  return snapFetch(`/trade/${tradeId}/place`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Search symbols available to a specific account/brokerage. Returns universal symbols
 * with id (universal_symbol_id) needed for /trade/impact.
 */
export async function searchAccountSymbols(
  accountId: string,
  query: string
): Promise<Array<{ id: string; symbol: string; description: string; type: string }>> {
  const data = await snapFetch(
    `/symbols/searchAccount?accountId=${encodeURIComponent(accountId)}&q=${encodeURIComponent(query)}`
  );
  return (data || []).map((s: any) => ({
    id: s.id || s.universal_symbol_id || '',
    symbol: s.symbol?.symbol || s.symbol || '',
    description: s.description || s.symbol?.description || s.name || '',
    type: s.symbol?.type?.code || s.type || 'equity',
  }));
}

/** Resolve a ticker (e.g. "AAPL") to a universal_symbol_id for the given account. */
export async function resolveSymbolId(accountId: string, ticker: string): Promise<string | null> {
  const matches = await searchAccountSymbols(accountId, ticker);
  const upper = ticker.toUpperCase();
  const exact = matches.find(m => (m.symbol || '').toUpperCase() === upper);
  return (exact || matches[0])?.id || null;
}

// ---- Options ----

export interface OptionStrike {
  strikePrice: number;
  callSymbolId: string;
  putSymbolId: string;
}

export interface OptionExpiration {
  expiryDate: string; // ISO date
  optionRoot: string; // e.g. "AAPL"
  strikes: OptionStrike[];
}

export interface OptionStrategyQuote {
  strategyId: string;
  estimatedCost: number;
  bid: number;
  ask: number;
  mid: number;
  openInterest: number;
  volatility: number; // implied vol if broker returned it
  greeks: { delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number } | null;
  raw: unknown;
}

/**
 * Fetch the live options chain for a universal symbol on a specific account.
 * SnapTrade returns a list of expirations; each expiration has chainPerRoot →
 * chainPerStrikePrice with separate call/put symbol IDs that we later use for
 * impact + execute.
 */
export async function getOptionsChain(
  accountId: string,
  universalSymbolId: string
): Promise<OptionExpiration[]> {
  const data = await snapFetch(
    `/options/chain?accountId=${encodeURIComponent(accountId)}&symbol=${encodeURIComponent(universalSymbolId)}`
  );
  return (data || []).map((exp: any) => {
    const root = exp.chainPerRoot?.[0] || {};
    return {
      expiryDate: exp.expiryDate || exp.expiry_date || '',
      optionRoot: root.optionRoot || root.option_root || '',
      strikes: (root.chainPerStrikePrice || root.chain_per_strike_price || []).map((s: any) => ({
        strikePrice: s.strikePrice ?? s.strike_price ?? 0,
        callSymbolId: s.callSymbolId || s.call_symbol_id || '',
        putSymbolId: s.putSymbolId || s.put_symbol_id || '',
      })),
    };
  });
}

/**
 * Build a single-leg option strategy at SnapTrade. Returns a strategyId that can
 * be executed. SnapTrade actions for options:
 *   BUY_TO_OPEN  | SELL_TO_OPEN  | BUY_TO_CLOSE | SELL_TO_CLOSE
 */
export async function buildOptionStrategy(
  accountId: string,
  params: {
    underlyingSymbolId: string;
    optionSymbolId: string;
    action: 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE';
    quantity: number;
  }
): Promise<OptionStrategyQuote> {
  const data = await snapFetch(`/options/strategy?accountId=${encodeURIComponent(accountId)}`, {
    method: 'POST',
    body: JSON.stringify({
      underlying_symbol_id: params.underlyingSymbolId,
      legs: [
        {
          action: params.action,
          option_symbol_id: params.optionSymbolId,
          quantity: params.quantity,
        },
      ],
      strategy_type: 'SINGLE',
    }),
  });
  // SnapTrade option strategy response is loosely shaped - pick fields defensively.
  const id = data?.id || data?.strategyId || '';
  const bid = data?.bid ?? data?.bid_price ?? 0;
  const ask = data?.ask ?? data?.ask_price ?? 0;
  return {
    strategyId: id,
    estimatedCost: data?.estimated_cost ?? data?.estimatedCost ?? ((bid + ask) / 2 || 0),
    bid,
    ask,
    mid: bid && ask ? (bid + ask) / 2 : 0,
    openInterest: data?.open_interest ?? data?.openInterest ?? 0,
    volatility: data?.implied_volatility ?? data?.iv ?? 0,
    greeks: data?.greeks ?? null,
    raw: data,
  };
}

/** Place a previously built option strategy at the broker. */
export async function executeOptionStrategy(
  accountId: string,
  strategyId: string,
  params: { orderType: 'Market' | 'Limit'; timeInForce: 'Day' | 'GTC'; price?: number }
): Promise<any> {
  return snapFetch(
    `/options/execute?accountId=${encodeURIComponent(accountId)}&strategyId=${encodeURIComponent(strategyId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        order_type: params.orderType,
        time_in_force: params.timeInForce,
        price: params.price ?? null,
      }),
    }
  );
}

export async function searchSymbol(
  query: string
): Promise<Array<{ symbol: string; description: string; type: string }>> {
  const data = await snapFetch(`/symbols/search?query=${encodeURIComponent(query)}`);
  return (data || []).map((s: any) => ({
    symbol: s.symbol || '',
    description: s.description || s.name || '',
    type: s.type || s.securityType || 'equity',
  }));
}
