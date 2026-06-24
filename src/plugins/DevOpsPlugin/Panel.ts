import { Panel } from '@/components/Panel';
import { escapeHtml, formatTime } from '@/utils';

interface ProcessInfo {
  pid: string;
  label: string;
  command: string;
  pattern: string;
  cpu: number;
  mem: number;
  elapsed: string;
  duration: string;
  status: string;
}

type ExitVerdict = 'normal' | 'crash' | 'oom' | 'timeout' | 'unknown';

interface ExitedProcess {
  id: string;
  label: string;
  command: string;
  duration: string;
  cpu: number;
  mem: number;
  exitedAt: string;
  verdict: ExitVerdict;
  verdictDetail: string;
}

interface TerminalInfo {
  termId: number;
  pid: number | null;
  cwd: string;
  shortCwd: string;
  activeCommand: string | null;
  lastCommand: string | null;
  lastExitCode: number | null;
  isActive: boolean;
  label: string;
  workspace: string;
  outputTail: string;
  outputLineCount: number;
}

type MonitorTab = 'running' | 'terminals' | 'servers' | 'history';

const WATCH_KEY = 'mdm-watch-patterns';
const HISTORY_KEY = 'mdm-process-history';
const PROBES_KEY = 'mdm-server-probes';
const MAX_HISTORY = 50;

function getWatchPatterns(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
  } catch {
    return [];
  }
}
function setWatchPatterns(p: string[]): void {
  localStorage.setItem(WATCH_KEY, JSON.stringify(p));
}
function loadHistory(): ExitedProcess[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveHistory(h: ExitedProcess[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}
function getProbes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PROBES_KEY) || '[]');
  } catch {
    return [];
  }
}
function setProbes(urls: string[]): void {
  localStorage.setItem(PROBES_KEY, JSON.stringify(urls));
}

function processIcon(label: string): string {
  if (label.startsWith('Cursor')) return '\u{1F4BB}';
  if (label.startsWith('VS Code')) return '\u{1F4DD}';
  if (label.startsWith('Python')) return '\u{1F40D}';
  if (label.startsWith('Node')) return '\u{1F7E2}';
  if (label.startsWith('Vite')) return '\u26A1';
  if (label.startsWith('Docker')) return '\u{1F433}';
  if (label.startsWith('SSH')) return '\u{1F517}';
  if (label.startsWith('npm')) return '\u{1F4E6}';
  if (label.startsWith('TSX')) return '\u26A1';
  return '\u2699\uFE0F';
}

function durationToSeconds(dur: string): number {
  let s = 0;
  const d = dur.match(/(\d+)d/);
  if (d) s += parseInt(d[1]) * 86400;
  const h = dur.match(/(\d+)h/);
  if (h) s += parseInt(h[1]) * 3600;
  const m = dur.match(/(\d+)m/);
  if (m) s += parseInt(m[1]) * 60;
  const sec = dur.match(/(\d+)s/);
  if (sec) s += parseInt(sec[1]);
  return s;
}

const BUILD_PATTERNS = [
  'build',
  'compile',
  'make',
  'tsc',
  'webpack',
  'rollup',
  'esbuild',
  'vite build',
  'next build',
];
const SERVER_PATTERNS = ['dev', 'serve', 'start', 'watch', 'listen', 'server'];
const COMPUTE_PATTERNS = ['train', 'fit', 'epoch', 'cuda', 'gpu'];

function classifyExit(proc: {
  label: string;
  command: string;
  duration: string;
  cpu: number;
  mem: number;
}): { verdict: ExitVerdict; detail: string } {
  const cmd = proc.command.toLowerCase();
  const label = proc.label.toLowerCase();
  const secs = durationToSeconds(proc.duration);

  if (proc.mem > 80) {
    return {
      verdict: 'oom',
      detail: `Memory was at ${proc.mem.toFixed(1)}% when exited \u2014 likely out-of-memory kill.`,
    };
  }

  const isServer = SERVER_PATTERNS.some(p => cmd.includes(p));
  if (isServer && secs < 10) {
    return {
      verdict: 'crash',
      detail: `Server process ran only ${secs}s \u2014 likely crashed on startup (port conflict, missing dependency, syntax error).`,
    };
  }
  if (isServer && secs < 60) {
    return {
      verdict: 'crash',
      detail: `Server ran ${proc.duration} then stopped \u2014 possible unhandled error or SIGKILL.`,
    };
  }

  const isBuild = BUILD_PATTERNS.some(p => cmd.includes(p));
  if (isBuild) {
    if (secs < 3) {
      return {
        verdict: 'crash',
        detail: `Build ran only ${secs}s \u2014 likely failed immediately (config error, missing files).`,
      };
    }
    return {
      verdict: 'normal',
      detail: `Build completed in ${proc.duration}. Duration looks reasonable.`,
    };
  }

  const isCompute = COMPUTE_PATTERNS.some(p => cmd.includes(p) || label.includes(p));
  if (isCompute) {
    if (secs < 30 && proc.cpu < 5) {
      return {
        verdict: 'crash',
        detail: `Training ran only ${proc.duration} with low CPU \u2014 likely errored before starting.`,
      };
    }
    if (proc.cpu > 80) {
      return {
        verdict: 'timeout',
        detail: `Compute task ended at high CPU (${proc.cpu.toFixed(0)}%) after ${proc.duration} \u2014 may have hit a limit or was killed.`,
      };
    }
    return {
      verdict: 'normal',
      detail: `Compute task completed in ${proc.duration}. CPU peak was ${proc.cpu.toFixed(1)}%.`,
    };
  }

  if (cmd.includes('ssh') || label.includes('SSH')) {
    return { verdict: 'normal', detail: `SSH session ended after ${proc.duration}.` };
  }

  if (isServer && secs > 300) {
    return {
      verdict: 'normal',
      detail: `Server ran for ${proc.duration} then stopped. Likely intentional shutdown.`,
    };
  }

  if (secs < 5) {
    return {
      verdict: 'crash',
      detail: `Process ran only ${secs}s \u2014 likely crashed immediately.`,
    };
  }

  return {
    verdict: 'unknown',
    detail: `Process ran for ${proc.duration}. CPU ${proc.cpu.toFixed(1)}%, MEM ${proc.mem.toFixed(1)}%.`,
  };
}

const VERDICT_META: Record<ExitVerdict, { icon: string; label: string; color: string }> = {
  normal: { icon: '\u2705', label: 'Normal Exit', color: 'var(--green)' },
  crash: { icon: '\u{1F4A5}', label: 'Likely Crashed', color: 'var(--red)' },
  oom: { icon: '\u{1F9E0}', label: 'Out of Memory', color: 'var(--red)' },
  timeout: { icon: '\u23F1\uFE0F', label: 'Timeout / Kill', color: 'var(--yellow)' },
  unknown: { icon: '\u2753', label: 'Exited', color: 'var(--text-dim)' },
};

export class DevOpsPanel extends Panel {
  private tab: MonitorTab = 'running';
  private tabsEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private knownProcesses = new Map<string, ProcessInfo>();
  private bootstrapped = false;
  private history: ExitedProcess[] = [];
  private terminalsList: TerminalInfo[] = [];
  private expandedTerminal: number | null = null;

  constructor() {
    super({ id: 'devops', title: 'Process Monitor', showCount: true, className: 'panel-wide' });
    this.content.style.padding = '0';
    this.content.style.display = 'flex';
    this.content.style.flexDirection = 'column';
    this.history = loadHistory();
    this.buildLayout();
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 5000);
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.content.appendChild(this.tabsEl);
    this.bodyEl = document.createElement('div');
    this.bodyEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';
    this.content.appendChild(this.bodyEl);
    this.renderTabs();
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    const probeCount = getProbes().length;
    const activeTerms = this.terminalsList.filter(t => t.isActive).length;
    const tabs: { id: MonitorTab; label: string }[] = [
      { id: 'running', label: '\u26A1 Running' },
      {
        id: 'terminals',
        label: `\u{1F5A5} Terminals${activeTerms > 0 ? ` (${activeTerms})` : ''}`,
      },
      { id: 'servers', label: `\u{1F310} Servers${probeCount > 0 ? ` (${probeCount})` : ''}` },
      {
        id: 'history',
        label: `\u{1F4CB} History${this.history.length > 0 ? ` (${this.history.length})` : ''}`,
      },
    ];
    this.tabsEl.innerHTML = '';
    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${t.id === this.tab ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.tab = t.id;
        this.renderTabs();
        this.renderBody();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  async refresh(): Promise<void> {
    if (this.isFetching || !this.bodyEl) return;
    this.setFetching(true);
    try {
      if (this.tab === 'history') {
        this.renderBody();
      } else if (this.tab === 'servers') {
        await this.refreshServers();
      } else if (this.tab === 'terminals') {
        await this.refreshTerminals();
      } else {
        await this.refreshProcesses();
      }
    } catch {
      if (this.bodyEl) this.bodyEl.innerHTML = '<div class="panel-empty">Failed to poll</div>';
    } finally {
      this.setFetching(false);
    }
  }

  private async refreshProcesses(): Promise<void> {
    const custom = getWatchPatterns();
    const patternsParam = custom.length > 0 ? `&patterns=${custom.join('||')}` : '';
    const resp = await fetch(`/api/system?action=jobs${patternsParam}`);
    const data = await resp.json();
    const jobs: ProcessInfo[] = data.jobs || [];
    const currentPids = new Set(jobs.map(j => j.pid));

    if (this.bootstrapped) {
      for (const [pid, proc] of this.knownProcesses) {
        if (!currentPids.has(pid)) this.onProcessExited(proc);
      }
    }

    this.knownProcesses.clear();
    for (const j of jobs) this.knownProcesses.set(j.pid, j);
    this.bootstrapped = true;

    this.setCount(jobs.length);
    this.setDataBadge('live', `${jobs.length} processes`);
    this.renderBody();
  }

  private onProcessExited(proc: ProcessInfo): void {
    const { verdict, detail } = classifyExit(proc);

    const entry: ExitedProcess = {
      id: `${proc.pid}-${Date.now()}`,
      label: proc.label,
      command: proc.command,
      duration: proc.duration || proc.elapsed,
      cpu: proc.cpu,
      mem: proc.mem,
      exitedAt: new Date().toISOString(),
      verdict,
      verdictDetail: detail,
    };

    this.history.unshift(entry);
    if (this.history.length > MAX_HISTORY) this.history.pop();
    saveHistory(this.history);
    this.renderTabs();
    if (this.tab === 'history') this.renderBody();
  }

  private renderBody(): void {
    if (!this.bodyEl) return;
    if (this.tab === 'running') this.renderRunning();
    else if (this.tab === 'terminals') this.renderTerminals();
    else if (this.tab === 'servers') this.renderServersUI();
    else this.renderHistory();
  }

  private renderRunning(): void {
    if (!this.bodyEl) return;
    const custom = getWatchPatterns();
    const inputHtml = `
      <div class="jm-input-bar">
        <input class="ch-search-input" placeholder="Watch a process (e.g. python train.py, npm run dev)..." id="jmWatchInput" />
        <button class="monitor-add-btn" id="jmWatchAdd">+ Watch</button>
      </div>
      ${custom.length > 0 ? `<div class="jm-watch-tags">${custom.map((p, i) => `<span class="jm-watch-tag">${escapeHtml(p)} <button class="jm-watch-rm" data-idx="${i}">\u2715</button></span>`).join('')}</div>` : ''}`;

    const jobs = Array.from(this.knownProcesses.values());
    if (jobs.length === 0) {
      this.bodyEl.innerHTML = `${inputHtml}<div class="panel-empty">No matching processes running.<br><small style="color:var(--text-muted)">Auto-detects: Cursor, VS Code, Node, Python, Vite, SSH<br>Add custom patterns above to track specific programs</small></div>`;
      this.wireWatchInput(custom);
      return;
    }

    const rows = jobs
      .map(j => {
        const cpuColor = j.cpu > 50 ? 'var(--red)' : j.cpu > 10 ? 'var(--yellow)' : 'var(--green)';
        const memColor =
          j.mem > 50 ? 'var(--red)' : j.mem > 10 ? 'var(--yellow)' : 'var(--text-dim)';
        const icon = processIcon(j.label);
        const cpuBarW = Math.min(100, j.cpu);
        const memBarW = Math.min(100, j.mem);
        return `
      <div class="jm-row">
        <span class="jm-icon">${icon}</span>
        <div class="jm-info">
          <div class="jm-label">${escapeHtml(j.label)}</div>
          <div class="jm-cmd">${escapeHtml(j.command)}</div>
          <div class="pm-bars">
            <div class="pm-bar-group">
              <span class="pm-bar-label" style="color:${cpuColor}">CPU ${j.cpu.toFixed(1)}%</span>
              <div class="pm-bar-track"><div class="pm-bar-fill" style="width:${cpuBarW}%;background:${cpuColor}"></div></div>
            </div>
            <div class="pm-bar-group">
              <span class="pm-bar-label" style="color:${memColor}">MEM ${j.mem.toFixed(1)}%</span>
              <div class="pm-bar-track"><div class="pm-bar-fill" style="width:${memBarW}%;background:${memColor}"></div></div>
            </div>
          </div>
        </div>
        <div class="jm-stats">
          <span class="jm-status" style="color:var(--green)">\u25CF RUNNING</span>
          <span class="jm-duration">${j.duration || j.elapsed}</span>
          <span class="pm-pid">PID ${j.pid}</span>
        </div>
      </div>`;
      })
      .join('');

    this.bodyEl.innerHTML = `${inputHtml}<div class="jm-list">${rows}</div>`;
    this.wireWatchInput(custom);
  }

  private async refreshTerminals(): Promise<void> {
    const resp = await fetch('/api/system?action=terminals&lines=25');
    const data = await resp.json();
    this.terminalsList = data.terminals || [];
    this.renderTabs();
    this.renderBody();
  }

  private renderTerminals(): void {
    if (!this.bodyEl) return;

    if (this.terminalsList.length === 0) {
      this.bodyEl.innerHTML = `<div class="panel-empty">No Cursor terminal sessions found.<br><small style="color:var(--text-muted)">Open terminals in Cursor to see them here.</small></div>`;
      return;
    }

    const rows = this.terminalsList
      .map(t => {
        const isExpanded = this.expandedTerminal === t.termId;
        const statusColor = t.isActive ? 'var(--green)' : 'var(--text-muted)';
        const statusText = t.isActive ? '\u25CF ACTIVE' : '\u25CB IDLE';
        const exitBadge =
          !t.isActive && t.lastExitCode !== null && t.lastExitCode !== 0
            ? `<span class="pm-exit-badge" style="background:rgba(255,68,68,0.15);color:var(--red)">EXIT ${t.lastExitCode}</span>`
            : !t.isActive && t.lastExitCode === 0
              ? `<span class="pm-exit-badge" style="background:rgba(68,255,136,0.15);color:var(--green)">EXIT 0</span>`
              : '';

        const cmdDisplay = t.activeCommand || t.lastCommand || '(no command)';
        const cmdShort = cmdDisplay.length > 70 ? cmdDisplay.slice(0, 67) + '...' : cmdDisplay;

        const outputHtml =
          isExpanded && t.outputTail
            ? `<div class="term-output-wrap"><pre class="term-output">${escapeHtml(t.outputTail)}</pre></div>`
            : '';

        return `
      <div class="term-row ${t.isActive ? 'term-active' : ''}" data-tid="${t.termId}">
        <div class="term-header" data-toggle="${t.termId}">
          <span class="term-id">#${t.termId}</span>
          <div class="jm-info">
            <div class="jm-label">${escapeHtml(cmdShort)}</div>
            <div class="jm-cmd">${escapeHtml(t.shortCwd)}${t.pid ? ` \u00B7 PID ${t.pid}` : ''}</div>
          </div>
          <div class="jm-stats">
            <span class="jm-status" style="color:${statusColor}">${statusText}</span>
            ${exitBadge}
          </div>
          <span class="term-expand">${isExpanded ? '\u25BC' : '\u25B6'}</span>
        </div>
        ${outputHtml}
      </div>`;
      })
      .join('');

    this.bodyEl.innerHTML = `<div class="term-list">${rows}</div>`;

    this.bodyEl.querySelectorAll<HTMLElement>('[data-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const tid = parseInt(el.dataset.toggle!, 10);
        this.expandedTerminal = this.expandedTerminal === tid ? null : tid;
        this.renderTerminals();
      });
    });
  }

  private serverResults: any[] = [];

  private async refreshServers(): Promise<void> {
    const probes = getProbes();
    if (probes.length === 0) {
      this.setCount(0);
      this.renderBody();
      return;
    }
    const resp = await fetch(`/api/system?action=probe&urls=${probes.join(',')}`);
    const data = await resp.json();
    this.serverResults = data.probes || [];
    const upCount = this.serverResults.filter((r: any) => r.ok).length;
    this.setCount(upCount);
    this.setDataBadge(
      upCount === probes.length ? 'live' : 'unavailable',
      `${upCount}/${probes.length} up`
    );
    this.renderBody();
  }

  private renderServersUI(): void {
    if (!this.bodyEl) return;
    const probes = getProbes();

    const inputHtml = `
      <div class="jm-input-bar">
        <input class="ch-search-input" placeholder="Add server URL (e.g. https://api.example.com/health)..." id="probeIn" />
        <button class="monitor-add-btn" id="probeAdd">+ Add</button>
      </div>`;

    if (probes.length === 0) {
      this.bodyEl.innerHTML = `${inputHtml}<div class="panel-empty">Add server / API URLs to monitor uptime & latency.<br><small style="color:var(--text-muted)">Supports any HTTP endpoint: cloud servers, APIs, websites<br>Health checks run every 5 seconds</small></div>`;
      this.wireProbe(probes);
      return;
    }

    const rows = (
      this.serverResults.length > 0
        ? this.serverResults
        : probes.map((u: string) => ({ url: u, ok: null }))
    )
      .map((r: any, i: number) => {
        const isUp = r.ok === true;
        const isDown = r.ok === false;
        const isPending = r.ok === null || r.ok === undefined;
        const icon = isPending ? '\u23F3' : isUp ? '\u{1F7E2}' : '\u{1F534}';
        const statusText = isPending ? 'CHECKING...' : isUp ? 'UP' : 'DOWN';
        const statusColor = isPending ? 'var(--text-dim)' : isUp ? 'var(--green)' : 'var(--red)';
        let hostname = r.url || probes[i] || '';
        try {
          hostname = new URL(hostname).hostname;
        } catch {
          /* keep raw */
        }
        const detail = isUp
          ? `${r.status} OK \u00B7 ${r.latencyMs}ms`
          : isDown
            ? escapeHtml(r.error || 'Connection failed')
            : '';

        return `
      <div class="jm-row">
        <span class="jm-icon">${icon}</span>
        <div class="jm-info">
          <div class="jm-label">${escapeHtml(hostname)}</div>
          <div class="jm-cmd">${escapeHtml(r.url || probes[i] || '')}</div>
          ${detail ? `<div class="jm-cmd" style="margin-top:2px;color:${statusColor}">${detail}</div>` : ''}
        </div>
        <div class="jm-stats">
          <span class="jm-status" style="color:${statusColor}">\u25CF ${statusText}</span>
          ${isUp && r.latencyMs ? `<span class="jm-duration">${r.latencyMs}ms</span>` : ''}
        </div>
        <button class="jm-watch-rm" data-pidx="${i}" style="margin-left:4px" title="Remove">\u2715</button>
      </div>`;
      })
      .join('');

    this.bodyEl.innerHTML = `${inputHtml}<div class="jm-list">${rows}</div>`;
    this.wireProbe(probes);
    this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-pidx]').forEach(b => {
      b.addEventListener('click', () => {
        probes.splice(parseInt(b.dataset.pidx!, 10), 1);
        setProbes(probes);
        this.serverResults = [];
        this.renderTabs();
        this.refreshServers();
      });
    });
  }

  private wireProbe(probes: string[]): void {
    const input = this.bodyEl?.querySelector<HTMLInputElement>('#probeIn');
    const btn = this.bodyEl?.querySelector('#probeAdd');
    const add = () => {
      let url = input?.value.trim() || '';
      if (!url) return;
      if (!url.startsWith('http')) url = 'https://' + url;
      probes.push(url);
      setProbes(probes);
      if (input) input.value = '';
      this.renderTabs();
      this.refreshServers();
    };
    btn?.addEventListener('click', add);
    input?.addEventListener('keypress', e => {
      if (e.key === 'Enter') add();
    });
  }

  private renderHistory(): void {
    if (!this.bodyEl) return;

    if (this.history.length === 0) {
      this.bodyEl.innerHTML = `<div class="panel-empty">No process exits detected yet.<br><small style="color:var(--text-muted)">When a monitored process stops running,<br>it will appear here with an exit analysis.</small></div>`;
      return;
    }

    const clearBtn = `<div style="padding:6px 10px;display:flex;justify-content:flex-end">
      <button class="monitor-add-btn" id="pmClearHistory" style="font-size:10px;color:var(--text-muted)">Clear All</button>
    </div>`;

    const rows = this.history
      .map(h => {
        const icon = processIcon(h.label);
        const time = formatTime(new Date(h.exitedAt));
        const meta = VERDICT_META[h.verdict];

        return `
      <div class="pm-history-item">
        <div class="pm-history-header">
          <span class="jm-icon">${icon}</span>
          <div class="pm-history-info">
            <div class="jm-label">${escapeHtml(h.label)}</div>
            <div class="jm-cmd">${escapeHtml(h.command)}</div>
          </div>
          <div class="pm-history-meta">
            <span class="pm-exit-badge" style="background:${meta.color === 'var(--green)' ? 'rgba(68,255,136,0.15)' : meta.color === 'var(--red)' ? 'rgba(255,68,68,0.15)' : meta.color === 'var(--yellow)' ? 'rgba(255,170,0,0.15)' : 'var(--overlay-light)'};color:${meta.color}">${meta.icon} ${meta.label}</span>
            <span class="jm-duration">${h.duration}</span>
            <span class="pm-exit-time">${time}</span>
          </div>
        </div>
        <div class="pm-history-metrics">
          <span>CPU ${h.cpu.toFixed(1)}%</span>
          <span>MEM ${h.mem.toFixed(1)}%</span>
        </div>
        <div class="pm-analysis pm-analysis-done">
          <div class="pm-analysis-text">${escapeHtml(h.verdictDetail)}</div>
        </div>
      </div>`;
      })
      .join('');

    this.bodyEl.innerHTML = `${clearBtn}<div class="pm-history-list">${rows}</div>`;
    this.bodyEl.querySelector('#pmClearHistory')?.addEventListener('click', () => {
      this.history = [];
      saveHistory(this.history);
      this.renderTabs();
      this.renderBody();
    });
  }

  private wireWatchInput(patterns: string[]): void {
    const input = this.bodyEl?.querySelector<HTMLInputElement>('#jmWatchInput');
    const btn = this.bodyEl?.querySelector('#jmWatchAdd');
    const add = () => {
      if (!input?.value.trim()) return;
      patterns.push(input.value.trim());
      setWatchPatterns(patterns);
      input.value = '';
      this.refresh();
    };
    btn?.addEventListener('click', add);
    input?.addEventListener('keypress', e => {
      if (e.key === 'Enter') add();
    });
    this.bodyEl?.querySelectorAll<HTMLButtonElement>('.jm-watch-rm').forEach(b => {
      b.addEventListener('click', () => {
        patterns.splice(parseInt(b.dataset.idx || '0', 10), 1);
        setWatchPatterns(patterns);
        this.refresh();
      });
    });
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    const renderPatterns = () => {
      const list = el.querySelector('#dmPatternsList');
      if (!list) return;
      const patterns = getWatchPatterns();
      if (patterns.length === 0) {
        list.innerHTML =
          '<div class="social-settings-item" style="color:var(--text-muted);justify-content:center;">No watch patterns</div>';
        return;
      }
      list.innerHTML = patterns
        .map(
          (p, i) => `
        <div class="social-settings-item">
          <span class="social-settings-item-name">${escapeHtml(p)}</span>
          <button class="social-settings-item-remove" data-pidx="${i}" title="Remove">&times;</button>
        </div>
      `
        )
        .join('');
      list.querySelectorAll<HTMLButtonElement>('.social-settings-item-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.pidx!, 10);
          const current = getWatchPatterns();
          current.splice(idx, 1);
          setWatchPatterns(current);
          renderPatterns();
        });
      });
    };

    const renderProbes = () => {
      const list = el.querySelector('#dmProbesList');
      if (!list) return;
      const probes = getProbes();
      if (probes.length === 0) {
        list.innerHTML =
          '<div class="social-settings-item" style="color:var(--text-muted);justify-content:center;">No server probes</div>';
        return;
      }
      list.innerHTML = probes
        .map(
          (url, i) => `
        <div class="social-settings-item">
          <span class="social-settings-item-name">${escapeHtml(url)}</span>
          <button class="social-settings-item-remove" data-ridx="${i}" title="Remove">&times;</button>
        </div>
      `
        )
        .join('');
      list.querySelectorAll<HTMLButtonElement>('.social-settings-item-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.ridx!, 10);
          const current = getProbes();
          current.splice(idx, 1);
          setProbes(current);
          renderProbes();
        });
      });
    };

    el.innerHTML = `
      <div class="social-settings-header">Watch Patterns</div>
      <div class="social-settings-list" id="dmPatternsList"></div>
      <div class="social-settings-add">
        <input type="text" class="social-settings-input" id="dmPatternInput" placeholder="e.g. python train.py" />
        <button class="social-settings-add-btn" id="dmPatternAddBtn">Add</button>
      </div>
      <div class="social-settings-header" style="margin-top:12px">Server Probes</div>
      <div class="social-settings-list" id="dmProbesList"></div>
      <div class="social-settings-add">
        <input type="text" class="social-settings-input" id="dmProbeInput" placeholder="https://api.example.com/health" />
        <button class="social-settings-add-btn" id="dmProbeAddBtn">Add</button>
      </div>
    `;

    renderPatterns();
    renderProbes();

    el.querySelector('#dmPatternAddBtn')!.addEventListener('click', () => {
      const input = el.querySelector('#dmPatternInput') as HTMLInputElement;
      const val = input?.value.trim();
      if (!val) return;
      const current = getWatchPatterns();
      current.push(val);
      setWatchPatterns(current);
      input.value = '';
      renderPatterns();
    });

    el.querySelector('#dmPatternInput')!.addEventListener('keypress', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        (el.querySelector('#dmPatternAddBtn') as HTMLElement).click();
      }
    });

    el.querySelector('#dmProbeAddBtn')!.addEventListener('click', () => {
      const input = el.querySelector('#dmProbeInput') as HTMLInputElement;
      let url = input?.value.trim() || '';
      if (!url) return;
      if (!url.startsWith('http')) url = 'https://' + url;
      const current = getProbes();
      current.push(url);
      setProbes(current);
      input.value = '';
      renderProbes();
    });

    el.querySelector('#dmProbeInput')!.addEventListener('keypress', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        (el.querySelector('#dmProbeAddBtn') as HTMLElement).click();
      }
    });

    return el;
  }

  public destroy(): void {
    if (this.timer) clearInterval(this.timer);
    super.destroy();
  }
}
