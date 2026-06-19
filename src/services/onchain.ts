import { createCircuitBreaker } from '@/utils/circuit-breaker';

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

const txnBreaker = createCircuitBreaker<{ transactions: WhaleTransaction[]; source: string }>({
  name: 'OnChainTxns',
  cacheTtlMs: 3 * 60 * 1000,
});

export async function fetchOnChainTransactions(): Promise<{
  transactions: WhaleTransaction[];
  source: string;
}> {
  return txnBreaker.execute(
    async () => {
      const resp = await fetch('/api/onchain?action=transactions');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { transactions: [], source: '' }
  );
}

const statusBreaker = createCircuitBreaker<{ status: string; message?: string }>({
  name: 'OnChainStatus',
  cacheTtlMs: 3 * 60 * 1000,
});

export async function fetchOnChainStatus(): Promise<{ status: string; message?: string }> {
  return statusBreaker.execute(
    async () => {
      const resp = await fetch('/api/onchain?action=status');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { status: 'unknown' }
  );
}
