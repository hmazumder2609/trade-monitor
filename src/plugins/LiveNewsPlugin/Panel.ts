import { Panel } from '@/components/Panel';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

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
    const schema: SettingSchema<LiveNewsSettings>[] = [
      { key: 'autoRefresh', label: 'Auto-refresh', type: 'checkbox' },
      {
        key: 'refreshInterval',
        label: 'Refresh interval',
        type: 'select',
        options: [
          { value: '30s', label: '30 seconds' },
          { value: '1m', label: '1 minute' },
          { value: '5m', label: '5 minutes' },
        ],
      },
    ];

    return createSettingsForm<LiveNewsSettings>({
      title: 'Live News Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
      },
    });
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
