import { Panel } from '@/components/Panel';
import { fetchOnChainTransactions, type WhaleTransaction } from '@/services/onchain';
import { formatTime, escapeHtml } from '@/utils';
import { hasSecret } from '@/services/settings-store';

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

  constructor() {
    super({ id: 'onchain', title: 'Whale Transactions', className: 'panel-wide' });
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
      const result = await fetchOnChainTransactions();
      this.transactions = result.transactions || [];
      this.dataSource = result.source || '';
      const isDemo = !hasSecret('WHALE_ALERT_API_KEY') || this.dataSource === 'demo';
      if (isDemo) {
        this.setDataBadge('live', 'Demo Data');
      } else if (this.dataSource) {
        this.setDataBadge('live', this.dataSource);
      }
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
          <span class="onchain-time">${timeAgo}</span>
        </div>`;
      })
      .join('');

    this.setContent(`<div class="onchain-list">${html}</div>`);
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">On-Chain Settings</div>
      <label class="social-settings-label">
        <input type="checkbox" id="ocWhaleAlerts" ${this.settings.showWhaleAlerts ? 'checked' : ''} />
        Show Whale Alerts
      </label>
      <label class="social-settings-label">
        Time Range
        <select class="social-settings-select" id="ocTimeRange">
          <option value="1h" ${this.settings.timeRange === '1h' ? 'selected' : ''}>1 Hour</option>
          <option value="24h" ${this.settings.timeRange === '24h' ? 'selected' : ''}>24 Hours</option>
          <option value="7d" ${this.settings.timeRange === '7d' ? 'selected' : ''}>7 Days</option>
        </select>
      </label>
    `;

    el.addEventListener('change', () => {
      this.settings.showWhaleAlerts = (
        el.querySelector('#ocWhaleAlerts') as HTMLInputElement
      ).checked;
      this.settings.timeRange = (el.querySelector('#ocTimeRange') as HTMLSelectElement).value;
      this.saveSettings();
      this.refresh();
    });

    return el;
  }
}
