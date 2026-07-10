import { Panel } from '@/components/Panel';
import { fetchOnChainTransactions, type WhaleTransaction } from '@/services/onchain';
import { formatTime, escapeHtml } from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';
import { formatTimestamp } from '@/utils/data-display';

const BLOCKCHAIN_COLORS: Record<string, string> = {
  Bitcoin: '#f7931a',
  Ethereum: '#627eea',
};

const TYPE_COLORS: Record<string, string> = {
  exchange_out: '#ff9800',
  exchange_in: '#4caf50',
  transfer: '#2196f3',
  unknown: '#9e9e9e',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function getExplorerUrl(blockchain: string, txHash: string): string {
  const explorers: Record<string, string> = {
    Bitcoin: `https://blockchair.com/bitcoin/transaction/${txHash}`,
    Ethereum: `https://etherscan.io/tx/${txHash}`,
    Solana: `https://solscan.io/tx/${txHash}`,
    BSC: `https://bscscan.com/tx/${txHash}`,
    Arbitrum: `https://arbiscan.io/tx/${txHash}`,
    Optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
    Polygon: `https://polygonscan.com/tx/${txHash}`,
    Avalanche: `https://snowtrace.io/tx/${txHash}`,
  };
  return explorers[blockchain] || `https://blockchair.com/search?q=${txHash}`;
}

function formatUsd(usd: number | null): string {
  if (usd == null) return '';
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface OnChainSettings {
  showWhaleAlerts: boolean;
  timeRange: string;
}

const DEFAULT_SETTINGS: OnChainSettings = { showWhaleAlerts: true, timeRange: '24h' };

export class OnChainPanel extends Panel {
  private transactions: WhaleTransaction[] = [];
  private dataSource: string = '';
  private settings: OnChainSettings;
  private lastUpdated: Date | null = null;

  constructor() {
    super({ id: 'onchain', title: 'Whale Transactions' });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): OnChainSettings {
    try {
      const raw = localStorage.getItem('mdm-onchain-settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('mdm-onchain-settings', JSON.stringify(this.settings));
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      this.setDataWindow('Last 24h');
      this.lastUpdated = new Date();
      const result = await fetchOnChainTransactions();
      this.transactions = result.transactions || [];
      this.dataSource = result.source || '';
      this.setDataBadge('live');
      this.renderTransactions();
      this.setCount(this.transactions.length);
    } catch {
      this.showError('Failed to load on-chain data', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private renderTransactions(): void {
    if (this.transactions.length === 0) {
      this.setContent('<div class="onchain-empty">No whale transactions detected.</div>');
      return;
    }

    const html = this.transactions
      .map(tx => {
        const blockchainColor = BLOCKCHAIN_COLORS[tx.blockchain] || '#666';
        const typeColor = TYPE_COLORS[tx.type] || '#9e9e9e';
        const timeAgo = formatTime(new Date(tx.timestamp));
        const usdDisplay = formatUsd(tx.usdAmount);
        const fromLabel = tx.fromLabel
          ? `<span class="onchain-label exchange">${escapeHtml(tx.fromLabel)}</span>`
          : '<span class="onchain-label null">Unknown</span>';
        const toLabel = tx.toLabel
          ? `<span class="onchain-label exchange">${escapeHtml(tx.toLabel)}</span>`
          : '<span class="onchain-label null">Unknown</span>';
        const explorerUrl = getExplorerUrl(tx.blockchain, tx.txHash);

        return `
        <div class="onchain-row" style="border-left:3px solid ${typeColor}">
          <span class="onchain-bc-dot" style="color:${blockchainColor}">●</span>
          <span class="onchain-symbol-pill">${escapeHtml(tx.symbol)}</span>
          <span class="onchain-amount">${formatAmount(tx.amount)}</span>
          ${usdDisplay ? `<span class="onchain-usd">${usdDisplay}</span>` : ''}
          <span class="onchain-from">
            <code class="onchain-addr">${truncateAddress(tx.fromAddress)}</code>
            ${fromLabel}
          </span>
          <span class="onchain-arrow">→</span>
          <span class="onchain-to">
            <code class="onchain-addr">${truncateAddress(tx.toAddress)}</code>
            ${toLabel}
          </span>
          <a href="${explorerUrl}" target="_blank" rel="noopener" class="onchain-time data-link" title="View on block explorer">${timeAgo}</a>
        </div>`;
      })
      .join('');

    this.setContent(`<div class="onchain-list">${html}</div>
      <div class="data-meta" style="padding:4px 8px;border-top:1px solid var(--border-color,#333);font-size:11px;opacity:0.7;">
        <span class="data-source-badge data-source-api">Whale Alert</span>
        Updated ${this.lastUpdated ? formatTimestamp(this.lastUpdated) : ''}
      </div>`);
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<OnChainSettings>[] = [
      { key: 'showWhaleAlerts', label: 'Show Whale Alerts', type: 'checkbox' },
      {
        key: 'timeRange',
        label: 'Time Range',
        type: 'select',
        options: [
          { value: '1h', label: '1 Hour' },
          { value: '24h', label: '24 Hours' },
          { value: '7d', label: '7 Days' },
        ],
      },
    ];

    return createSettingsForm<OnChainSettings>({
      title: 'On-Chain Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.refresh();
      },
    });
  }
}
