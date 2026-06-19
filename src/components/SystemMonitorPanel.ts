import { Panel } from './Panel';

export class SystemMonitorPanel extends Panel {
  constructor() {
    super({ id: 'system-monitor', title: 'System Monitor', className: 'panel-wide' });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '8px';
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const resp = await fetch('/api/health');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.render(data);
    } catch {
      this.showError('Failed to fetch system health', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(data: any): void {
    const cpu = data.cpu ?? 0;
    const mem = data.memoryUsedPercent ?? 0;
    const uptime = data.uptime ?? 0;
    const probes: Array<{ url: string; ok: boolean; latencyMs: number }> = data.probes || [];

    this.content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div class="metric-card">
          <div class="metric-value" style="color:${cpu > 80 ? 'var(--red)' : cpu > 50 ? 'var(--yellow)' : 'var(--green)'}">${cpu.toFixed(1)}%</div>
          <div class="metric-label">CPU</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color:${mem > 80 ? 'var(--red)' : mem > 50 ? 'var(--yellow)' : 'var(--green)'}">${mem.toFixed(1)}%</div>
          <div class="metric-label">Memory</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m</div>
          <div class="metric-label">Uptime</div>
        </div>
      </div>
      ${
        probes.length > 0
          ? `
        <div style="font-size:12px;">
          <div style="color:var(--text-muted);margin-bottom:4px;">Server Probes</div>
          ${probes
            .map(
              p => `
            <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
              <span style="color:${p.ok ? 'var(--green)' : 'var(--red)'}">${p.ok ? '●' : '○'}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escape(p.url)}</span>
              <span style="color:var(--text-muted)">${p.ok ? `${p.latencyMs}ms` : 'DOWN'}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : '<div class="panel-empty">No server probes configured. Add URLs in Settings.</div>'
      }
    `;
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
