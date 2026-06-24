/**
 * Portfolio data source — positions, exposure, and P&L from brokerage accounts.
 *
 * Integrates with SnapTrade API to fetch real portfolio data.
 * Provides per-symbol portfolio context (weight, P&L contribution).
 */

import { dataLayer } from '../DataLayer';
import { getSecret } from '@/services/settings-store';

export interface PortfolioPosition {
  symbol: string;
  /** Number of shares/units held. */
  quantity: number;
  /** Average cost basis per share. */
  averageCost: number;
  /** Current market price per share. */
  currentPrice: number;
  /** Total market value of position. */
  marketValue: number;
  /** Unrealized P&L in USD. */
  unrealizedPnl: number;
  /** Unrealized P&L as percentage. */
  unrealizedPnlPercent: number;
  /** Weight of this position in total portfolio (%). */
  weight: number;
  /** Day P&L in USD. */
  dayPnl: number;
  /** Day P&L as percentage. */
  dayPnlPercent: number;
}

export interface PortfolioSummary {
  /** Total portfolio market value. */
  totalValue: number;
  /** Total unrealized P&L. */
  totalPnl: number;
  /** Total unrealized P&L percentage. */
  totalPnlPercent: number;
  /** Total day P&L. */
  totalDayPnl: number;
  /** Total day P&L percentage. */
  totalDayPnlPercent: number;
  /** Number of positions. */
  positionCount: number;
  /** Positions sorted by weight (descending). */
  positions: PortfolioPosition[];
  /** When this data was fetched. */
  fetchedAt: number;
}

export const PORTFOLIO_SOURCE_ID = 'portfolio';

/**
 * Fetch portfolio data from SnapTrade API.
 */
export async function fetchPortfolio(): Promise<PortfolioSummary> {
  const clientId = getSecret('SNAPTRADE_CLIENT_ID');
  const consumerKey = getSecret('SNAPTRADE_CONSUMER_KEY');

  const base: PortfolioSummary = {
    totalValue: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    totalDayPnl: 0,
    totalDayPnlPercent: 0,
    positionCount: 0,
    positions: [],
    fetchedAt: Date.now(),
  };

  if (!clientId || !consumerKey) return base;

  try {
    // Fetch accounts first
    const accountsResp = await fetch('/api/snaptrade?action=accounts');
    if (!accountsResp.ok) return base;

    const accountsData = await accountsResp.json();
    const accounts = accountsData.accounts || [];
    if (accounts.length === 0) return base;

    // Fetch positions from the first account (or aggregate all)
    const allPositions: PortfolioPosition[] = [];
    let totalValue = 0;

    for (const account of accounts) {
      const positionsResp = await fetch(`/api/snaptrade?action=positions&account=${account.id}`);
      if (!positionsResp.ok) continue;

      const positionsData = await positionsResp.json();
      const positions = positionsData.positions || [];

      for (const pos of positions) {
        const marketValue = pos.quantity * pos.currentPrice;
        totalValue += marketValue;

        allPositions.push({
          symbol: pos.symbol,
          quantity: pos.quantity,
          averageCost: pos.averageCost || 0,
          currentPrice: pos.currentPrice || 0,
          marketValue,
          unrealizedPnl: pos.unrealizedPnl || 0,
          unrealizedPnlPercent: pos.unrealizedPnlPercent || 0,
          weight: 0, // Calculated after total is known
          dayPnl: pos.dayPnl || 0,
          dayPnlPercent: pos.dayPnlPercent || 0,
        });
      }
    }

    // Calculate weights
    for (const pos of allPositions) {
      pos.weight = totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0;
    }

    // Sort by weight descending
    allPositions.sort((a, b) => b.weight - a.weight);

    // Calculate totals
    const totalPnl = allPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalDayPnl = allPositions.reduce((sum, p) => sum + p.dayPnl, 0);

    return {
      totalValue,
      totalPnl,
      totalPnlPercent: totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0,
      totalDayPnl,
      totalDayPnlPercent: totalValue > 0 ? (totalDayPnl / totalValue) * 100 : 0,
      positionCount: allPositions.length,
      positions: allPositions,
      fetchedAt: Date.now(),
    };
  } catch {
    return base;
  }
}

/**
 * Get portfolio context for a specific symbol.
 * Returns null if portfolio not loaded or symbol not held.
 */
export function getSymbolPortfolioContext(symbol: string): PortfolioPosition | null {
  const portfolio = dataLayer.getData<PortfolioSummary>(PORTFOLIO_SOURCE_ID);
  if (!portfolio) return null;
  return portfolio.positions.find(p => p.symbol === symbol) || null;
}

/**
 * Get all symbols held in the portfolio.
 */
export function getPortfolioSymbols(): string[] {
  const portfolio = dataLayer.getData<PortfolioSummary>(PORTFOLIO_SOURCE_ID);
  if (!portfolio) return [];
  return portfolio.positions.map(p => p.symbol);
}

/**
 * Register portfolio as a DataLayer source.
 */
export function registerPortfolioSource(): void {
  dataLayer.registerSource<PortfolioSummary>({
    id: PORTFOLIO_SOURCE_ID,
    fetch: async () => fetchPortfolio(),
    cache: {
      ttlMs: 300_000, // 5min — portfolio updates less frequently than quotes
    },
  });
}
