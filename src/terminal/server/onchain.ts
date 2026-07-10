const WHALE_ALERT_BASE = 'https://api.whale-alert.io/v1';

export interface WhaleTransaction {
  id: string;
  blockchain: string;
  symbol: string;
  amount: number;
  usdAmount: number | null;
  fromAddress: string;
  fromLabel: string | null;
  toAddress: string;
  toLabel: string | null;
  timestamp: string;
  txHash: string;
  type: 'transfer' | 'exchange_in' | 'exchange_out' | 'unknown';
}

export interface OnChainResponse {
  transactions: WhaleTransaction[];
  source: string;
}

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 3 * 60_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data as T);
  return fn().then(data => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

async function fetchWhaleTransactions(apiKey: string): Promise<WhaleTransaction[]> {
  const resp = await fetch(`${WHALE_ALERT_BASE}/transactions?api_key=${apiKey}&limit=20`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Whale Alert HTTP ${resp.status}`);
  const json = (await resp.json()) as any;
  return (json.transactions || []).map((tx: any) => ({
    id: String(tx.id),
    blockchain: tx.blockchain || '',
    symbol: tx.symbol || '',
    amount: parseFloat(tx.amount) || 0,
    usdAmount: tx.usd_amount != null ? parseFloat(tx.usd_amount) : null,
    fromAddress: tx.from?.address || tx.from_address || '',
    fromLabel: tx.from?.label || null,
    toAddress: tx.to?.address || tx.to_address || '',
    toLabel: tx.to?.label || null,
    timestamp: tx.timestamp
      ? new Date(tx.timestamp * 1000).toISOString()
      : new Date().toISOString(),
    txHash: tx.hash || '',
    type: tx.transaction_type || 'unknown',
  }));
}

function getDemoTransactions(): WhaleTransaction[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 1850.42,
      usdAmount: 98500000,
      fromAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      fromLabel: 'Binance Cold Wallet',
      toAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      toLabel: 'Kraken Hot Wallet',
      timestamp: new Date(now - 2 * 60_000).toISOString(),
      txHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
      type: 'exchange_out',
    },
    {
      id: 'demo-2',
      blockchain: 'ethereum',
      symbol: 'ETH',
      amount: 45200,
      usdAmount: 84500000,
      fromAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      fromLabel: 'Coinbase Custody',
      toAddress: '0x28C6c06298d514Db0899348913E5C6B10B92bE7a',
      toLabel: 'Uniswap V3 Router',
      timestamp: new Date(now - 5 * 60_000).toISOString(),
      txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      type: 'exchange_in',
    },
    {
      id: 'demo-3',
      blockchain: 'ethereum',
      symbol: 'USDT',
      amount: 150000000,
      usdAmount: 150000000,
      fromAddress: '0x3cD751E6b0078Be393132286c442345e5DC49699',
      fromLabel: 'Tether Treasury',
      toAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      toLabel: 'Bitfinex Hot Wallet',
      timestamp: new Date(now - 8 * 60_000).toISOString(),
      txHash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
      type: 'transfer',
    },
    {
      id: 'demo-4',
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 920.15,
      usdAmount: 48900000,
      fromAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      fromLabel: null,
      toAddress: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      toLabel: 'OKX Deposit',
      timestamp: new Date(now - 12 * 60_000).toISOString(),
      txHash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
      type: 'exchange_in',
    },
    {
      id: 'demo-5',
      blockchain: 'ethereum',
      symbol: 'ETH',
      amount: 28100,
      usdAmount: 52300000,
      fromAddress: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C245E7e7c3F5',
      fromLabel: 'Lido Staking Contract',
      toAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      toLabel: 'stETH Contract',
      timestamp: new Date(now - 15 * 60_000).toISOString(),
      txHash: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
      type: 'transfer',
    },
    {
      id: 'demo-6',
      blockchain: 'ethereum',
      symbol: 'USDC',
      amount: 75000000,
      usdAmount: 75000000,
      fromAddress: '0x55fE002aefF02F77364de339F1292E9F5C7bA86a',
      fromLabel: 'Circle Mint',
      toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      toLabel: 'Coinbase Exchange',
      timestamp: new Date(now - 20 * 60_000).toISOString(),
      txHash: '0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
      type: 'transfer',
    },
    {
      id: 'demo-7',
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 2500,
      usdAmount: 132500000,
      fromAddress: 'bc1qmal80qref5ve4fz5vy7fj9dfh0t82gmj7x7f4j',
      fromLabel: 'Unknown Whale',
      toAddress: '1KFHE7w8BhaENAswwryaTTxAJpA94M5Fjf',
      toLabel: null,
      timestamp: new Date(now - 30 * 60_000).toISOString(),
      txHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7',
      type: 'unknown',
    },
  ];
}

export async function handleOnChainRequest(
  query: Record<string, string>
): Promise<OnChainResponse> {
  const apiKey = process.env.WHALE_ALERT_API_KEY || '';
  const symbol = query.symbol ? query.symbol.toUpperCase() : undefined;

  if (!apiKey) {
    const txs = getDemoTransactions();
    return { transactions: symbol ? txs.filter(t => t.symbol === symbol) : txs, source: 'demo' };
  }

  try {
    const transactions = await cached('whale:transactions', () => fetchWhaleTransactions(apiKey));
    const filtered = symbol ? transactions.filter(t => t.symbol === symbol) : transactions;
    return { transactions: filtered, source: 'whale-alert' };
  } catch (err: any) {
    const txs = getDemoTransactions();
    return { transactions: symbol ? txs.filter(t => t.symbol === symbol) : txs, source: 'demo' };
  }
}
