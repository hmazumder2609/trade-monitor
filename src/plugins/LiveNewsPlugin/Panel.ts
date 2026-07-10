import { Panel } from '@/components/Panel';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';
import { createSourceBadge, createDataLink } from '@/utils/data-display';

interface LiveChannel {
  id: string;
  name: string;
  videoId: string;
  url: string;
}

const CHANNELS: LiveChannel[] = [
  {
    id: 'bloomberg',
    name: 'Bloomberg',
    videoId: 'iEpJwprxDdk',
    url: 'https://www.youtube.com/@bloomberg',
  },
  { id: 'sky', name: 'Sky News', videoId: 'uvviIF4725I', url: 'https://www.youtube.com/@skynews' },
  {
    id: 'euronews',
    name: 'Euronews',
    videoId: 'pykpO5kQJ98',
    url: 'https://www.youtube.com/@euronews',
  },
  { id: 'dw', name: 'DW News', videoId: 'LuKwFajn37U', url: 'https://www.youtube.com/@dwnews' },
  { id: 'cnbc', name: 'CNBC', videoId: '9NyxcX3rhQs', url: 'https://www.youtube.com/@CNBC' },
  {
    id: 'france24',
    name: 'France 24',
    videoId: 'u9foWyMSETk',
    url: 'https://www.youtube.com/@france24',
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    videoId: 'gCNeDWCI0vo',
    url: 'https://www.youtube.com/@aljazeeraenglish',
  },
  {
    id: 'cna',
    name: 'CNA Asia',
    videoId: 'XWq5kBlakcQ',
    url: 'https://www.youtube.com/@channelnewsasia',
  },
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

    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

    const tabs = document.createElement('div');
    tabs.className = 'panel-tabs';
    tabs.style.flex = '1';
    CHANNELS.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${i === 0 ? 'active' : ''}`;
      btn.textContent = ch.name;
      btn.addEventListener('click', () => this.switchChannel(i, tabs));
      tabs.appendChild(btn);
    });
    headerRow.appendChild(tabs);

    const badge = createSourceBadge('youtube');
    badge.style.cssText = 'font-size:10px;padding:2px 6px;';
    headerRow.appendChild(badge);

    const channelLink = createDataLink(CHANNELS[0].url, 'Channel');
    channelLink.className = 'data-link';
    channelLink.style.cssText = 'font-size:11px;padding:4px 8px;opacity:0.7;white-space:nowrap;';
    headerRow.appendChild(channelLink);

    this.content.appendChild(headerRow);

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
    const link = this.content.querySelector('.data-link') as HTMLAnchorElement | null;
    if (link) link.href = CHANNELS[idx].url;
  }

  private embedUrl(videoId: string): string {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=1&rel=0`;
  }

  async refresh(): Promise<void> {}
}
