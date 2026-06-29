import { Panel } from '@/components/Panel';
import { getTrades, saveTrade, deleteTrade, type TradeReview } from '@/services/strategy-store';
import { getSecret } from '@/services/settings-store';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface TradeReviewSettings {
  sortBy: 'date' | 'symbol' | 'return' | 'duration';
  showPnL: boolean;
  groupBy: 'none' | 'symbol' | 'strategy';
}

const DEFAULT_TRADE_REVIEW_SETTINGS: TradeReviewSettings = {
  sortBy: 'date',
  showPnL: true,
  groupBy: 'none',
};

function loadTradeReviewSettings(): TradeReviewSettings {
  try {
    const raw = localStorage.getItem('mdm-trade-review-settings');
    if (raw) return { ...DEFAULT_TRADE_REVIEW_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_TRADE_REVIEW_SETTINGS };
}

function saveTradeReviewSettings(settings: TradeReviewSettings): void {
  localStorage.setItem('mdm-trade-review-settings', JSON.stringify(settings));
}

export class TradeReviewPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private filterEl: HTMLElement | null = null;
  private filter: 'all' | 'win' | 'loss' = 'all';
  private settings: TradeReviewSettings = loadTradeReviewSettings();

  constructor() {
    super({ id: 'trade-review', title: 'Trade Review', showCount: true });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    this.filterEl = document.createElement('div');
    this.filterEl.className = 'panel-tabs';
    this.filterEl.innerHTML = ['all', 'win', 'loss']
      .map(
        f =>
          `<button class="panel-tab ${f === this.filter ? 'active' : ''}" data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
      )
      .join('');
    this.filterEl.querySelectorAll('.panel-tab').forEach(btn =>
      btn.addEventListener('click', () => {
        this.filter = (btn as HTMLElement).dataset.filter as 'all' | 'win' | 'loss';
        this.refresh();
      })
    );
    this.content.appendChild(this.filterEl);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;padding:6px 8px;';
    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ Add Trade';
    addBtn.addEventListener('click', () => this.showEditor());
    btnRow.appendChild(addBtn);

    const importBtn = document.createElement('button');
    importBtn.className = 'trading-btn trading-btn-outline';
    importBtn.textContent = '📥 SnapTrade';
    importBtn.style.cssText = 'padding:4px 10px;font-size:12px;';
    importBtn.addEventListener('click', () => this.importFromSnapTrade());
    btnRow.appendChild(importBtn);

    this.content.appendChild(btnRow);

    const patternEl = document.createElement('div');
    patternEl.className = 'trade-patterns';
    patternEl.style.cssText = 'padding:8px;font-size:12px;';
    this.content.appendChild(patternEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'trade-review-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      let trades = getTrades();
      if (this.filter === 'win') trades = trades.filter(t => t.pnl > 0);
      else if (this.filter === 'loss') trades = trades.filter(t => t.pnl <= 0);
      this.render(trades);
      this.renderPatterns(trades);
      this.setCount(trades.length);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load trades', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(trades: TradeReview[]): void {
    if (!this.listEl) return;
    if (trades.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No trades recorded. Click "+ Add Trade" to log your first trade.</div>';
      return;
    }
    this.listEl.innerHTML = trades
      .map(t => {
        const isWin = t.pnl > 0;
        return `
        <div class="trade-card ${isWin ? 'trade-win' : 'trade-loss'}">
          <div class="trade-card-header">
            <span class="trade-symbol">${t.symbol}</span>
            <span class="trade-direction trade-${t.direction}">${t.direction.toUpperCase()}</span>
            <span class="trade-pnl ${isWin ? 'positive' : 'negative'}">${isWin ? '+' : ''}$${t.pnl.toFixed(2)}</span>
          </div>
          <div class="trade-card-details">
            <span>Entry: $${t.entryPrice.toFixed(2)}</span>
            <span>Exit: $${t.exitPrice.toFixed(2)}</span>
            <span>Qty: ${t.quantity}</span>
            <span>${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%</span>
          </div>
          <div class="trade-card-dates">
            <span>${new Date(t.entryDate).toLocaleDateString()}</span>
            <span>→</span>
            <span>${new Date(t.exitDate).toLocaleDateString()}</span>
          </div>
          ${t.notes ? `<div class="trade-card-notes">${this.escape(t.notes)}</div>` : ''}
          <div class="trade-card-tags">${t.tags.map(tag => `<span class="strategy-tag">${this.escape(tag)}</span>`).join('')}</div>
          <div class="trade-card-actions">
            <button class="trade-del-btn" data-id="${t.id}">Delete</button>
          </div>
        </div>`;
      })
      .join('');

    this.listEl.querySelectorAll('.trade-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this trade?')) {
          deleteTrade(id);
          this.refresh();
        }
      })
    );
  }

  private showEditor(): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal trade-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Log Trade</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="tradeSymbol" placeholder="Symbol (e.g. AAPL)" />
          <select class="settings-input" id="tradeDirection" style="padding:6px 8px;">
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="tradeEntry" type="number" step="0.01" placeholder="Entry price" />
          <input class="settings-input" id="tradeExit" type="number" step="0.01" placeholder="Exit price" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="tradeQty" type="number" step="1" placeholder="Quantity" />
          <input class="settings-input" id="tradeTags" placeholder="Tags (comma-sep)" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="tradeEntryDate" type="date" />
          <input class="settings-input" id="tradeExitDate" type="date" />
        </div>
        <textarea class="settings-input strategy-textarea" id="tradeNotes" placeholder="Notes / lessons learned"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="tradeCancel">Cancel</button>
          <button class="settings-save-btn" id="tradeSave">Save Trade</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const today = new Date().toISOString().slice(0, 10);
    (modal.querySelector('#tradeEntryDate') as HTMLInputElement).value = today;
    (modal.querySelector('#tradeExitDate') as HTMLInputElement).value = today;

    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#tradeCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#tradeSave')!.addEventListener('click', () => {
      const symbol = (modal.querySelector('#tradeSymbol') as HTMLInputElement).value
        .trim()
        .toUpperCase();
      const direction = (modal.querySelector('#tradeDirection') as HTMLSelectElement).value as
        | 'long'
        | 'short';
      const entryPrice = parseFloat((modal.querySelector('#tradeEntry') as HTMLInputElement).value);
      const exitPrice = parseFloat((modal.querySelector('#tradeExit') as HTMLInputElement).value);
      const quantity = parseInt((modal.querySelector('#tradeQty') as HTMLInputElement).value, 10);
      const entryDate = (modal.querySelector('#tradeEntryDate') as HTMLInputElement).value;
      const exitDate = (modal.querySelector('#tradeExitDate') as HTMLInputElement).value;
      const tags = (modal.querySelector('#tradeTags') as HTMLInputElement).value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const notes = (modal.querySelector('#tradeNotes') as HTMLTextAreaElement).value.trim();

      if (!symbol || isNaN(entryPrice) || isNaN(exitPrice) || isNaN(quantity)) return;

      const pnl =
        direction === 'long'
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;
      const pnlPercent =
        direction === 'long'
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

      saveTrade({
        symbol,
        direction,
        entryPrice,
        exitPrice,
        quantity,
        entryDate,
        exitDate,
        pnl,
        pnlPercent,
        tags,
        notes,
      });
      overlay.remove();
      this.refresh();
    });
  }

  private async importFromSnapTrade(): Promise<void> {
    const clientId = getSecret('SNAPTRADE_CLIENT_ID');
    const consumerKey = getSecret('SNAPTRADE_CONSUMER_KEY');
    const userId = getSecret('SNAPTRADE_USER_ID');
    if (!clientId || !consumerKey || !userId) {
      alert('Configure SnapTrade credentials in Settings first.');
      return;
    }

    try {
      const accountsResp = await fetch('/api/snaptrade/accounts', {
        headers: {
          'x-snaptrade-clientid': clientId,
          'x-snaptrade-consumerkey': consumerKey,
          'x-snaptrade-userid': userId,
          'x-snaptrade-usersecret': getSecret('SNAPTRADE_USER_SECRET') || '',
        },
      });
      if (!accountsResp.ok) throw new Error('Failed to fetch SnapTrade accounts');
      const accounts = await accountsResp.json();
      if (!Array.isArray(accounts) || accounts.length === 0) {
        alert('No SnapTrade accounts found. Connect a brokerage in Settings first.');
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
      });

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-header">
          <span class="modal-title">Import Trades from SnapTrade</span>
          <button class="modal-close">&times;</button>
        </div>
        <div style="padding:16px;">
          <p style="margin:0 0 12px;color:var(--text-muted);">Select an account to import trade history:</p>
          ${accounts
            .map(
              (a: any) =>
                `<button class="snaptrade-account-btn" data-id="${a.id}" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text);">
                  <strong>${this.escape(a.name || a.id || '')}</strong>
                  <span style="display:block;font-size:12px;color:var(--text-muted);">${a.number || ''} ${a.brokerage_name || ''}</span>
                </button>`
            )
            .join('')}
          <div id="snaptradeImportStatus" style="margin-top:12px;color:var(--text-muted);font-size:13px;"></div>
        </div>`;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());

      modal.querySelectorAll('.snaptrade-account-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const accountId = (btn as HTMLElement).dataset.id!;
          const statusEl = modal.querySelector('#snaptradeImportStatus')!;
          statusEl.textContent = 'Fetching orders...';

          try {
            const ordersResp = await fetch(`/api/snaptrade/accounts/${accountId}/orders`, {
              headers: {
                'x-snaptrade-clientid': clientId,
                'x-snaptrade-consumerkey': consumerKey,
                'x-snaptrade-userid': userId,
                'x-snaptrade-usersecret': getSecret('SNAPTRADE_USER_SECRET') || '',
              },
            });
            if (!ordersResp.ok) throw new Error('Failed to fetch orders');
            const orders = await ordersResp.json();
            const orderList = Array.isArray(orders) ? orders : [];

            let imported = 0;
            for (const order of orderList) {
              if (!order.symbol?.symbol && !order.symbol?.brokerage_symbol) continue;
              const symbol = (
                order.symbol?.symbol ||
                order.symbol?.brokerage_symbol ||
                ''
              ).toUpperCase();
              const qty = Math.abs(parseFloat(order.quantity) || 0);
              const price = parseFloat(order.price) || 0;
              const filledQty = parseFloat(order.filled_quantity) || qty;
              if (!symbol || qty === 0) continue;

              const existing = getTrades();
              const isDuplicate = existing.some(
                t => t.symbol === symbol && Math.abs(t.pnl) === Math.abs(filledQty * price * 0.01)
              );
              if (isDuplicate) continue;

              const orderSide = (order.side || '').toLowerCase();
              const direction = orderSide === 'sell' ? 'short' : 'long';
              const orderDate = order.created_at || order.order_date || new Date().toISOString();
              const orderPrice = price > 0 ? price : parseFloat(order.average_price) || 0;
              const totalValue = orderPrice > 0 ? filledQty * orderPrice : 0;

              saveTrade({
                symbol,
                direction,
                entryPrice: orderSide === 'sell' ? orderPrice : orderPrice,
                exitPrice: orderSide === 'sell' ? orderPrice : orderPrice,
                quantity: filledQty,
                entryDate: orderDate.slice(0, 10),
                exitDate: (order.updated_at || orderDate).slice(0, 10),
                pnl: 0,
                pnlPercent: 0,
                tags: ['snaptrade', orderSide],
                notes: `Imported from SnapTrade ${order.order_type || 'market'} order #${order.id || ''}`,
              });
              imported++;
            }

            overlay.remove();
            if (imported > 0) {
              this.refresh();
            }
            alert(`Imported ${imported} trade(s) from SnapTrade.`);
          } catch (err: any) {
            statusEl.textContent = `Error: ${err.message}`;
          }
        });
      });
    } catch (err: any) {
      alert(`SnapTrade import failed: ${err.message}`);
    }
  }

  private renderPatterns(trades: TradeReview[]): void {
    const el = this.content.querySelector('.trade-patterns');
    if (!el) return;
    if (trades.length < 3) {
      (el as HTMLElement).innerHTML = '';
      return;
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const total = trades.length;
    const winRate = total > 0 ? ((wins.length / total) * 100).toFixed(0) : '0';

    const bySymbol = new Map<string, { wins: number; losses: number; totalPnl: number }>();
    for (const t of trades) {
      if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, { wins: 0, losses: 0, totalPnl: 0 });
      const d = bySymbol.get(t.symbol)!;
      d.totalPnl += t.pnl;
      if (t.pnl > 0) d.wins++;
      else d.losses++;
    }
    const bestSymbol = [...bySymbol.entries()]
      .sort((a, b) => b[1].totalPnl - a[1].totalPnl)
      .slice(0, 3);

    const longTrades = trades.filter(t => t.direction === 'long');
    const shortTrades = trades.filter(t => t.direction === 'short');
    const longWinRate =
      longTrades.length > 0
        ? ((longTrades.filter(t => t.pnl > 0).length / longTrades.length) * 100).toFixed(0)
        : '0';
    const shortWinRate =
      shortTrades.length > 0
        ? ((shortTrades.filter(t => t.pnl > 0).length / shortTrades.length) * 100).toFixed(0)
        : '0';

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss =
      losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length : 0;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);

    (el as HTMLElement).innerHTML = `
      <div class="trade-pattern-header">📊 Pattern Analysis</div>
      <div class="trade-pattern-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;">
        <div class="trade-pattern-stat"><span class="trade-pat-label">Win Rate</span><span class="trade-pat-value" style="color:${+winRate >= 50 ? 'var(--green)' : 'var(--red)'}">${winRate}%</span></div>
        <div class="trade-pattern-stat"><span class="trade-pat-label">Total P&L</span><span class="trade-pat-value" style="color:${totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span></div>
        <div class="trade-pattern-stat"><span class="trade-pat-label">Avg Win</span><span class="trade-pat-value" style="color:var(--green)">+$${avgWin.toFixed(2)}</span></div>
        <div class="trade-pattern-stat"><span class="trade-pat-label">Avg Loss</span><span class="trade-pat-value" style="color:var(--red)">-$${avgLoss.toFixed(2)}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
        <div>
          <div style="color:var(--text-muted);margin-bottom:2px;">Long: ${longWinRate}% win rate (${longTrades.length} trades)</div>
          <div style="color:var(--text-muted);">Short: ${shortWinRate}% win rate (${shortTrades.length} trades)</div>
        </div>
        <div>
          <div style="color:var(--text-muted);margin-bottom:2px;">Best: ${bestSymbol.map(([s, d]) => `${s} ${d.totalPnl >= 0 ? '+' : ''}$${d.totalPnl.toFixed(0)}`).join(', ')}</div>
        </div>
      </div>`;
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<TradeReviewSettings>[] = [
      {
        key: 'sortBy',
        label: 'Sort by',
        type: 'select',
        options: [
          { value: 'date', label: 'Date' },
          { value: 'symbol', label: 'Symbol' },
          { value: 'return', label: 'Return' },
          { value: 'duration', label: 'Duration' },
        ],
      },
      {
        key: 'groupBy',
        label: 'Group by',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'symbol', label: 'Symbol' },
          { value: 'strategy', label: 'Strategy' },
        ],
      },
      {
        key: 'showPnL',
        label: 'Show P&L column',
        type: 'checkbox',
      },
    ];

    return createSettingsForm<TradeReviewSettings>({
      title: 'Trade Review Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        saveTradeReviewSettings(this.settings);
        this.refresh();
      },
    });
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
