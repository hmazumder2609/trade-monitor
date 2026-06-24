import { Panel } from '@/components/Panel';

interface LiveChannel {
  id: string;
  name: string;
  videoId: string;
}

const CHANNELS: LiveChannel[] = [
  { id: 'bloomberg', name: 'Bloomberg', videoId: 'iEpJwprxDdk' },
  { id: 'sky', name: 'Sky News', videoId: 'uvviIF4725I' },
  { id: 'euronews', name: 'Euronews', videoId: 'pykpO5kQJ98' },
  { id: 'dw', name: 'DW News', videoId: 'LuKwFajn37U' },
  { id: 'cnbc', name: 'CNBC', videoId: '9NyxcX3rhQs' },
  { id: 'france24', name: 'France 24', videoId: 'u9foWyMSETk' },
  { id: 'aljazeera', name: 'Al Jazeera', videoId: 'gCNeDWCI0vo' },
  { id: 'cna', name: 'CNA Asia', videoId: 'XWq5kBlakcQ' },
];

interface LiveNewsSettings {
  autoRefresh: boolean;
  refreshInterval: '30s' | '1m' | '5m';
}

const SETTINGS_KEY = 'mdm-live-news-settings';
const DEFAULT_SETTINGS: LiveNewsSettings = { autoRefresh: false, refreshInterval: '1m' };

export class LiveNewsPanel extends Panel {
  private activeChannel = 0;
  private iframeEl: HTMLIFrameElement | null = null;
  private settings: LiveNewsSettings;

  constructor() {
    super({ id: 'live-news', title: 'Live News', className: 'panel-wide', showCount: false });
    this.settings = this.loadSettings();
    this.content.style.padding = '0';
    this.content.style.display = 'flex';
    this.content.style.flexDirection = 'column';
    this.content.style.overflow = 'hidden';
    this.buildUI();
  }

  private loadSettings(): LiveNewsSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Live News Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="lnAutoRefresh" ${this.settings.autoRefresh ? 'checked' : ''} />
        Auto-refresh
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Refresh interval:
        <select class="social-settings-select" id="lnRefreshInterval">
          <option value="30s" ${this.settings.refreshInterval === '30s' ? 'selected' : ''}>30 seconds</option>
          <option value="1m" ${this.settings.refreshInterval === '1m' ? 'selected' : ''}>1 minute</option>
          <option value="5m" ${this.settings.refreshInterval === '5m' ? 'selected' : ''}>5 minutes</option>
        </select>
      </label>
    `;

    el.querySelector('#lnAutoRefresh')!.addEventListener('change', e => {
      this.settings.autoRefresh = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    el.querySelector('#lnRefreshInterval')!.addEventListener('change', e => {
      this.settings.refreshInterval = (e.target as HTMLSelectElement)
        .value as LiveNewsSettings['refreshInterval'];
      this.saveSettings();
    });

    return el;
  }

  private buildUI(): void {
    this.content.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'panel-tabs';
    CHANNELS.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${i === 0 ? 'active' : ''}`;
      btn.textContent = ch.name;
      btn.addEventListener('click', () => this.switchChannel(i, tabs));
      tabs.appendChild(btn);
    });
    this.content.appendChild(tabs);

    this.iframeEl = document.createElement('iframe');
    this.iframeEl.style.cssText = 'flex:1;border:none;width:100%;min-height:0;background:#000;';
    this.iframeEl.setAttribute('allow', 'autoplay; encrypted-media');
    this.iframeEl.setAttribute('allowfullscreen', '');
    this.iframeEl.src = this.embedUrl(CHANNELS[0].videoId);
    this.content.appendChild(this.iframeEl);

    this.setDataBadge('live');
  }

  private switchChannel(idx: number, tabs: HTMLElement): void {
    this.activeChannel = idx;
    tabs.querySelectorAll('.panel-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
    if (this.iframeEl) {
      this.iframeEl.src = this.embedUrl(CHANNELS[idx].videoId);
    }
  }

  private embedUrl(videoId: string): string {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=1&rel=0`;
  }

  async refresh(): Promise<void> {}
}
