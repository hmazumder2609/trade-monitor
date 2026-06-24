// ---- Persistence helpers ----
const PANEL_SPANS_KEY = 'mdm-panel-spans';
const PANEL_COL_SPANS_KEY = 'mdm-panel-col-spans';
const PANEL_ORDER_KEY = 'mdm-panel-order';
const ROW_RESIZE_STEP_PX = 80;
const COL_RESIZE_STEP_PX = 80;
const PANELS_GRID_MIN_TRACK_PX = 280;

function loadMap(key: string): Record<string, number> {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function saveMap(key: string, id: string, val: number): void {
  const m = loadMap(key);
  m[id] = val;
  localStorage.setItem(key, JSON.stringify(m));
}

function deleteMapKey(key: string, id: string): void {
  const m = loadMap(key);
  delete m[id];
  Object.keys(m).length
    ? localStorage.setItem(key, JSON.stringify(m))
    : localStorage.removeItem(key);
}

// ---- Span utilities ----
function getRowSpan(el: HTMLElement): number {
  if (el.classList.contains('span-4')) return 4;
  if (el.classList.contains('span-3')) return 3;
  if (el.classList.contains('span-2')) return 2;
  return 1;
}

function setRowSpanClass(el: HTMLElement, span: number): void {
  el.classList.remove('span-1', 'span-2', 'span-3', 'span-4');
  el.classList.add(`span-${span}`);
  el.classList.add('resized');
}

function deltaToRowSpan(start: number, dy: number): number {
  const d = dy > 0 ? Math.floor(dy / ROW_RESIZE_STEP_PX) : Math.ceil(dy / ROW_RESIZE_STEP_PX);
  return Math.max(1, Math.min(4, start + d));
}

function getColSpan(el: HTMLElement): number {
  if (el.classList.contains('col-span-3')) return 3;
  if (el.classList.contains('col-span-2')) return 2;
  if (el.classList.contains('col-span-1')) return 1;
  return el.classList.contains('panel-wide') ? 2 : 1;
}

function setColSpanClass(el: HTMLElement, span: number): void {
  el.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
  el.classList.add(`col-span-${span}`);
}

function clearColSpanClass(el: HTMLElement): void {
  el.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
}

function getGridColumnCount(el: HTMLElement): number {
  const grid = el.closest('.panels-grid') as HTMLElement | null;
  if (!grid) return 3;
  const style = window.getComputedStyle(grid);
  const tpl = style.gridTemplateColumns;
  if (!tpl || tpl === 'none') return 3;
  if (tpl.includes('repeat(')) {
    const m = tpl.match(/repeat\(\s*auto-(fill|fit)\s*,/i);
    if (m) {
      const gap = parseFloat(style.columnGap || '0') || 0;
      const w = grid.getBoundingClientRect().width;
      if (w > 0) return Math.max(1, Math.floor((w + gap) / (PANELS_GRID_MIN_TRACK_PX + gap)));
    }
  }
  const cols = tpl.trim().split(/\s+/).filter(Boolean);
  return cols.length > 0 ? cols.length : 3;
}

function getMaxColSpan(el: HTMLElement): number {
  return Math.max(1, Math.min(3, getGridColumnCount(el)));
}
function clampColSpan(span: number, max: number): number {
  return Math.max(1, Math.min(max, span));
}

function deltaToColSpan(start: number, dx: number, max = 3): number {
  const d = dx > 0 ? Math.floor(dx / COL_RESIZE_STEP_PX) : Math.ceil(dx / COL_RESIZE_STEP_PX);
  return clampColSpan(start + d, max);
}

// ---- Panel class ----
export type PanelMode = 'monitoring' | 'research';

export interface PanelOptions {
  id: string;
  title: string;
  showCount?: boolean;
  className?: string;
  trackActivity?: boolean;
  infoTooltip?: string;
}

export class Panel {
  protected element: HTMLElement;
  protected content: HTMLElement;
  protected header: HTMLElement;
  protected headerLeft: HTMLElement;
  protected countEl: HTMLElement | null = null;
  protected statusBadgeEl: HTMLElement | null = null;
  protected newBadgeEl: HTMLElement | null = null;
  protected panelId: string;

  private _fetching = false;
  private retryCallback: (() => void) | null = null;
  private retryCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private retryAttempt = 0;
  private _mode: PanelMode = 'monitoring';
  private _gearBtn: HTMLElement | null = null;
  private _settingsPopover: HTMLElement | null = null;
  private _symbolUnsub: (() => void) | null = null;

  // Row resize state
  private resizeHandle: HTMLElement | null = null;
  private isResizing = false;
  private startY = 0;
  private startRowSpan = 1;

  // Col resize state
  private colResizeHandle: HTMLElement | null = null;
  private isColResizing = false;
  private startX = 0;
  private startColSpan = 1;

  // Bound handlers for cleanup
  private onRowMouseMove: ((e: MouseEvent) => void) | null = null;
  private onRowMouseUp: (() => void) | null = null;
  private onColMouseMove: ((e: MouseEvent) => void) | null = null;
  private onColMouseUp: (() => void) | null = null;

  constructor(options: PanelOptions) {
    this.panelId = options.id;
    this.element = document.createElement('div');
    this.element.className = `panel ${options.className || ''}`.trim();
    this.element.dataset.panel = options.id;

    // ---- Header ----
    this.header = document.createElement('div');
    this.header.className = 'panel-header';

    this.headerLeft = document.createElement('div');
    this.headerLeft.className = 'panel-header-left';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = options.title;
    this.headerLeft.appendChild(title);

    // New badge
    if (options.trackActivity !== false) {
      this.newBadgeEl = document.createElement('span');
      this.newBadgeEl.className = 'panel-new-badge';
      this.newBadgeEl.style.display = 'none';
      this.headerLeft.appendChild(this.newBadgeEl);
    }

    this.header.appendChild(this.headerLeft);

    // Status badge
    this.statusBadgeEl = document.createElement('span');
    this.statusBadgeEl.className = 'panel-data-badge';
    this.statusBadgeEl.style.display = 'none';
    this.header.appendChild(this.statusBadgeEl);

    // Count badge
    if (options.showCount) {
      this.countEl = document.createElement('span');
      this.countEl.className = 'panel-count';
      this.countEl.textContent = '0';
      this.header.appendChild(this.countEl);
    }

    // Move handle (drag to reorder)
    const moveHandle = document.createElement('button');
    moveHandle.className = 'panel-move-handle';
    moveHandle.title = 'Drag to reorder';
    moveHandle.innerHTML = '⠿';
    moveHandle.setAttribute('aria-label', 'Drag to reorder panel');
    this.header.appendChild(moveHandle);
    this.setupDragReorder(moveHandle);

    // Settings gear button
    this._gearBtn = document.createElement('button');
    this._gearBtn.className = 'panel-settings-btn';
    this._gearBtn.title = 'Panel settings';
    this._gearBtn.innerHTML = '⚙';
    this._gearBtn.setAttribute('aria-label', 'Panel settings');
    this._gearBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.toggleSettingsPopover();
    });
    this.header.appendChild(this._gearBtn);

    // ---- Content ----
    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.content.id = `${options.id}Content`;

    this.element.appendChild(this.header);
    this.element.appendChild(this.content);

    // Retry click delegation
    this.content.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest('[data-panel-retry]');
      if (!target || this._fetching) return;
      this.retryCallback?.();
    });

    // ---- Resize handles ----
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.resizeHandle.title = 'Drag to resize height';
    this.element.appendChild(this.resizeHandle);
    this.setupRowResize();

    this.colResizeHandle = document.createElement('div');
    this.colResizeHandle.className = 'panel-col-resize-handle';
    this.colResizeHandle.title = 'Drag to resize width';
    this.element.appendChild(this.colResizeHandle);
    this.setupColResize();

    // Restore saved spans
    const savedRow = loadMap(PANEL_SPANS_KEY)[this.panelId];
    if (savedRow && savedRow > 1) setRowSpanClass(this.element, savedRow);
    const savedCol = loadMap(PANEL_COL_SPANS_KEY)[this.panelId];
    if (typeof savedCol === 'number' && savedCol >= 1) setColSpanClass(this.element, savedCol);

    this.showLoading();
  }

  // ---- Row resize ----
  private setupRowResize(): void {
    if (!this.resizeHandle) return;

    this.onRowMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      setRowSpanClass(this.element, deltaToRowSpan(this.startRowSpan, e.clientY - this.startY));
    };
    this.onRowMouseUp = () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.element.classList.remove('resizing');
      document.body.classList.remove('panel-resize-active');
      this.resizeHandle?.classList.remove('active');
      document.removeEventListener('mousemove', this.onRowMouseMove!);
      document.removeEventListener('mouseup', this.onRowMouseUp!);
      saveMap(PANEL_SPANS_KEY, this.panelId, getRowSpan(this.element));
    };

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.startY = e.clientY;
      this.startRowSpan = getRowSpan(this.element);
      this.element.classList.add('resizing');
      document.body.classList.add('panel-resize-active');
      this.resizeHandle?.classList.add('active');
      document.addEventListener('mousemove', this.onRowMouseMove!);
      document.addEventListener('mouseup', this.onRowMouseUp!);
    });
    this.resizeHandle.addEventListener('dblclick', () => this.resetHeight());
  }

  // ---- Col resize ----
  private setupColResize(): void {
    if (!this.colResizeHandle) return;

    this.onColMouseMove = (e: MouseEvent) => {
      if (!this.isColResizing) return;
      const max = getMaxColSpan(this.element);
      setColSpanClass(
        this.element,
        deltaToColSpan(this.startColSpan, e.clientX - this.startX, max)
      );
    };
    this.onColMouseUp = () => {
      if (!this.isColResizing) return;
      this.isColResizing = false;
      this.element.classList.remove('col-resizing');
      document.body.classList.remove('panel-resize-active');
      this.colResizeHandle?.classList.remove('active');
      document.removeEventListener('mousemove', this.onColMouseMove!);
      document.removeEventListener('mouseup', this.onColMouseUp!);
      const final = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      if (final !== this.startColSpan) saveMap(PANEL_COL_SPANS_KEY, this.panelId, final);
    };

    this.colResizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isColResizing = true;
      this.startX = e.clientX;
      this.startColSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      this.element.classList.add('col-resizing');
      document.body.classList.add('panel-resize-active');
      this.colResizeHandle?.classList.add('active');
      document.addEventListener('mousemove', this.onColMouseMove!);
      document.addEventListener('mouseup', this.onColMouseUp!);
    });
    this.colResizeHandle.addEventListener('dblclick', () => this.resetWidth());
  }

  // ---- Public API ----
  public getElement(): HTMLElement {
    return this.element;
  }

  /** Subclasses override to fetch and render data. */
  public async refresh(): Promise<void> {
    // no-op base
  }

  public showLoading(message = 'Loading...'): void {
    this.clearRetryCountdown();
    this.setErrorState(false);
    this.content.innerHTML = `
      <div class="panel-loading">
        <div class="panel-loading-radar">
          <div class="panel-radar-sweep"></div>
          <div class="panel-radar-dot"></div>
        </div>
        <div class="panel-loading-text">${message}</div>
      </div>`;
  }

  public showError(
    message = 'Failed to load',
    onRetry?: () => void,
    autoRetrySeconds?: number
  ): void {
    this.clearRetryCountdown();
    this.setErrorState(true);
    if (onRetry !== undefined) this.retryCallback = onRetry;

    let countdownHtml = '';
    if (this.retryCallback) {
      const backoff = autoRetrySeconds ?? Math.min(15 * Math.pow(2, this.retryAttempt), 180);
      this.retryAttempt++;
      let remaining = Math.round(backoff);
      countdownHtml = `<div class="panel-error-countdown" id="${this.panelId}-countdown">Retrying (${remaining}s)</div>`;
      setTimeout(() => {
        const el = document.getElementById(`${this.panelId}-countdown`);
        if (!el) return;
        this.retryCountdownTimer = setInterval(() => {
          remaining--;
          if (remaining <= 0) {
            this.clearRetryCountdown();
            this.retryCallback?.();
            return;
          }
          el.textContent = `Retrying (${remaining}s)`;
        }, 1000);
      }, 0);
    }

    this.content.innerHTML = `
      <div class="panel-error-state">
        <div class="panel-loading-radar panel-error-radar">
          <div class="panel-radar-sweep"></div>
          <div class="panel-radar-dot error"></div>
        </div>
        <div class="panel-error-msg">${message}</div>
        ${countdownHtml}
      </div>`;
  }

  public setContent(html: string): void {
    this.setErrorState(false);
    this.clearRetryCountdown();
    this.retryAttempt = 0;
    this.content.innerHTML = html;
  }

  public setCount(count: number): void {
    if (!this.countEl) return;
    const prev = parseInt(this.countEl.textContent ?? '0', 10);
    this.countEl.textContent = count.toString();
    if (count > prev) {
      this.countEl.classList.remove('bump');
      void this.countEl.offsetWidth; // force reflow
      this.countEl.classList.add('bump');
    }
  }

  protected setDataBadge(state: 'live' | 'cached' | 'unavailable', detail?: string): void {
    if (!this.statusBadgeEl) return;
    const labels = { live: 'LIVE', cached: 'CACHED', unavailable: 'UNAVAILABLE' } as const;
    this.statusBadgeEl.textContent = detail ? `${labels[state]} · ${detail}` : labels[state];
    this.statusBadgeEl.className = `panel-data-badge ${state}`;
    this.statusBadgeEl.style.display = 'inline-flex';
  }

  protected clearDataBadge(): void {
    if (!this.statusBadgeEl) return;
    this.statusBadgeEl.style.display = 'none';
  }

  public setNewBadge(count: number, pulse = false): void {
    if (!this.newBadgeEl) return;
    if (count <= 0) {
      this.newBadgeEl.style.display = 'none';
      this.newBadgeEl.classList.remove('pulse');
      this.element.classList.remove('has-new');
      return;
    }
    this.newBadgeEl.textContent = count > 99 ? '99+' : `${count} NEW`;
    this.newBadgeEl.style.display = 'inline-flex';
    this.element.classList.add('has-new');
    this.newBadgeEl.classList.toggle('pulse', pulse);
  }

  public clearNewBadge(): void {
    this.setNewBadge(0);
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }
  public hide(): void {
    this.element.classList.add('hidden');
  }

  // ---- Mode (monitoring / research) ----

  public getMode(): PanelMode {
    return this._mode;
  }

  public setMode(mode: PanelMode): void {
    if (this._mode === mode) return;
    this._mode = mode;
    this.element.classList.toggle('panel-research', mode === 'research');
    this.onModeChange(mode);
  }

  /** Override in subclass to react to mode changes. */
  protected onModeChange(_mode: PanelMode): void {}

  // ---- Cross-panel symbol selection ----

  /** Override in subclass to react to symbol selection from other panels. */
  public onSymbolSelect(_symbol: string): void {}

  // ---- Settings popover ----

  /** Override in subclass to return settings UI content. */
  public getSettingsPopover(): HTMLElement | null {
    return null;
  }

  /** Override in subclass to react to settings open/close. */
  protected onSettingsClick(): void {}

  public toggleSettingsPopover(): void {
    if (this._settingsPopover) {
      this.closeSettingsPopover();
      return;
    }

    const content = this.getSettingsPopover();
    if (!content) return;

    this.onSettingsClick();

    this._settingsPopover = document.createElement('div');
    this._settingsPopover.className = 'panel-settings-popover';
    this._settingsPopover.appendChild(content);
    document.body.appendChild(this._settingsPopover);

    // Position relative to the gear button
    const gearRect = this._gearBtn?.getBoundingClientRect();
    if (gearRect) {
      const popW = 260;
      const popH = this._settingsPopover.offsetHeight || 300;
      let left = gearRect.right - popW;
      let top = gearRect.bottom + 4;

      // Keep within viewport
      if (left < 8) left = 8;
      if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
      if (top + popH > window.innerHeight - 8) top = gearRect.top - popH - 4;

      this._settingsPopover.style.left = `${left}px`;
      this._settingsPopover.style.top = `${top}px`;
    }

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!this._settingsPopover) return;
      if (!this._settingsPopover.contains(e.target as Node) && e.target !== this._gearBtn) {
        this.closeSettingsPopover();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  public closeSettingsPopover(): void {
    if (this._settingsPopover) {
      this._settingsPopover.remove();
      this._settingsPopover = null;
    }
  }

  protected setFetching(v: boolean): void {
    this._fetching = v;
    const btn = this.content.querySelector<HTMLButtonElement>('[data-panel-retry]');
    if (btn) btn.disabled = v;
  }
  protected get isFetching(): boolean {
    return this._fetching;
  }

  protected setRetryCallback(fn: (() => void) | null): void {
    this.retryCallback = fn;
  }

  public resetRetryBackoff(): void {
    this.retryAttempt = 0;
  }

  public setErrorState(hasError: boolean): void {
    this.header.classList.toggle('panel-header-error', hasError);
  }

  public resetHeight(): void {
    this.element.classList.remove('resized', 'span-1', 'span-2', 'span-3', 'span-4');
    deleteMapKey(PANEL_SPANS_KEY, this.panelId);
  }

  public resetWidth(): void {
    clearColSpanClass(this.element);
    deleteMapKey(PANEL_COL_SPANS_KEY, this.panelId);
  }

  private clearRetryCountdown(): void {
    if (this.retryCountdownTimer) {
      clearInterval(this.retryCountdownTimer);
      this.retryCountdownTimer = null;
    }
  }

  // ---- Drag to reorder ----
  private setupDragReorder(handle: HTMLElement): void {
    let dragEl: HTMLElement | null = null;
    let placeholder: HTMLElement | null = null;
    let startRect: DOMRect | null = null;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragEl || !startRect) return;
      dragEl.style.left = `${e.clientX - offsetX}px`;
      dragEl.style.top = `${e.clientY - offsetY}px`;

      // Find the panel we're hovering over
      const grid = this.element.parentElement;
      if (!grid) return;
      const panels = [...grid.querySelectorAll<HTMLElement>('.panel:not(.drag-ghost)')];
      for (const panel of panels) {
        if (panel === placeholder) continue;
        const rect = panel.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = rect.top + rect.height / 2;
        if (
          e.clientX > rect.left &&
          e.clientX < rect.right &&
          e.clientY > rect.top &&
          e.clientY < rect.bottom
        ) {
          // Determine if we should insert before or after
          const before = e.clientY < midY || (e.clientY >= midY && e.clientX < midX);
          if (placeholder) {
            if (before) {
              grid.insertBefore(placeholder, panel);
            } else {
              grid.insertBefore(placeholder, panel.nextSibling);
            }
          }
          break;
        }
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('panel-drag-active');

      if (dragEl) {
        dragEl.remove();
        dragEl = null;
      }
      if (placeholder) {
        // Replace placeholder with the real element
        const grid = placeholder.parentElement;
        if (grid) {
          grid.insertBefore(this.element, placeholder);
          placeholder.remove();
          // Save new order
          Panel.savePanelOrder(grid);
        }
        placeholder = null;
      }
      this.element.style.opacity = '';
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const grid = this.element.parentElement;
      if (!grid) return;

      startRect = this.element.getBoundingClientRect();
      offsetX = e.clientX - startRect.left;
      offsetY = e.clientY - startRect.top;

      // Create floating ghost
      dragEl = this.element.cloneNode(true) as HTMLElement;
      dragEl.classList.add('drag-ghost');
      dragEl.style.position = 'fixed';
      dragEl.style.width = `${startRect.width}px`;
      dragEl.style.height = `${startRect.height}px`;
      dragEl.style.left = `${startRect.left}px`;
      dragEl.style.top = `${startRect.top}px`;
      dragEl.style.zIndex = '10001';
      dragEl.style.pointerEvents = 'none';
      dragEl.style.opacity = '0.85';
      dragEl.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
      dragEl.style.transform = 'scale(1.02)';
      dragEl.style.transition = 'none';
      document.body.appendChild(dragEl);

      // Create placeholder
      placeholder = document.createElement('div');
      placeholder.className = 'panel-drag-placeholder';
      placeholder.style.minHeight = `${startRect.height}px`;
      // Copy grid spans
      if (this.element.classList.contains('panel-wide')) placeholder.classList.add('panel-wide');
      for (let i = 1; i <= 4; i++) {
        if (this.element.classList.contains(`span-${i}`)) placeholder.classList.add(`span-${i}`);
      }
      for (let i = 1; i <= 3; i++) {
        if (this.element.classList.contains(`col-span-${i}`))
          placeholder.classList.add(`col-span-${i}`);
      }

      grid.insertBefore(placeholder, this.element);
      this.element.style.opacity = '0';
      // Move element off-grid temporarily (keep in DOM for reference)
      grid.appendChild(this.element);

      document.body.classList.add('panel-drag-active');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /** Save panel order within a grid to localStorage */
  public static savePanelOrder(grid: HTMLElement): void {
    const gridId = grid.id || 'default';
    const order = [...grid.querySelectorAll<HTMLElement>('.panel')]
      .map(p => p.dataset.panel)
      .filter(Boolean);
    const allOrders = Panel.loadAllOrders();
    allOrders[gridId] = order as string[];
    localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(allOrders));
  }

  /** Restore panel order within a grid */
  public static restorePanelOrder(grid: HTMLElement): void {
    const gridId = grid.id || 'default';
    const allOrders = Panel.loadAllOrders();
    const order = allOrders[gridId];
    if (!order || !order.length) return;

    const panels = [...grid.querySelectorAll<HTMLElement>('.panel')];
    const panelMap = new Map(panels.map(p => [p.dataset.panel, p]));

    for (const id of order) {
      const panel = panelMap.get(id);
      if (panel) grid.appendChild(panel); // re-appending moves to end, preserving order
    }
  }

  private static loadAllOrders(): Record<string, string[]> {
    try {
      return JSON.parse(localStorage.getItem(PANEL_ORDER_KEY) || '{}');
    } catch {
      return {};
    }
  }

  public destroy(): void {
    this.clearRetryCountdown();
    this.closeSettingsPopover();
    this._symbolUnsub?.();
    if (this.onRowMouseMove) document.removeEventListener('mousemove', this.onRowMouseMove);
    if (this.onRowMouseUp) document.removeEventListener('mouseup', this.onRowMouseUp);
    if (this.onColMouseMove) document.removeEventListener('mousemove', this.onColMouseMove);
    if (this.onColMouseUp) document.removeEventListener('mouseup', this.onColMouseUp);
    this.element.classList.remove('resizing', 'col-resizing');
    document.body.classList.remove('panel-resize-active');
    this.element.remove();
  }
}
