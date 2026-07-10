import { Panel } from '@/components/Panel';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface CityEntry {
  city: string;
  label: string;
  timezone: string;
  marketOpen?: number;
  marketClose?: number;
}

const STORAGE_KEY = 'mdm-world-clock-cities';

const DEFAULT_CITIES: CityEntry[] = [
  { city: 'New York', label: 'NYSE', timezone: 'America/New_York', marketOpen: 9, marketClose: 16 },
  { city: 'London', label: 'LSE', timezone: 'Europe/London', marketOpen: 8, marketClose: 16 },
  { city: 'Shanghai', label: 'SSE', timezone: 'Asia/Shanghai', marketOpen: 9, marketClose: 15 },
  { city: 'Hong Kong', label: 'HKEX', timezone: 'Asia/Hong_Kong', marketOpen: 9, marketClose: 16 },
  { city: 'Tokyo', label: 'TSE', timezone: 'Asia/Tokyo', marketOpen: 9, marketClose: 15 },
  { city: 'Singapore', label: 'SGX', timezone: 'Asia/Singapore', marketOpen: 9, marketClose: 17 },
  { city: 'Frankfurt', label: 'XETRA', timezone: 'Europe/Berlin', marketOpen: 9, marketClose: 17 },
  { city: 'Sydney', label: 'ASX', timezone: 'Australia/Sydney', marketOpen: 10, marketClose: 16 },
  { city: 'Mumbai', label: 'NSE', timezone: 'Asia/Kolkata', marketOpen: 9, marketClose: 15 },
  { city: 'Dubai', label: 'DFM', timezone: 'Asia/Dubai', marketOpen: 10, marketClose: 14 },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Seoul',
  'Asia/Taipei',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Sao_Paulo',
  'America/Toronto',
];

function loadCities(): CityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_CITIES];
}

function saveCities(cities: CityEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
}

export class WorldClockPanel extends Panel {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cities: CityEntry[];

  constructor() {
    super({ id: 'world-clock', title: 'World Clock', showCount: false });
    this.cities = loadCities();
    this.render();
    this.timer = setInterval(() => this.render(), 10_000);
  }

  async refresh(): Promise<void> {
    this.setDataWindow('Real-time');
    this.cities = loadCities();
    this.render();
  }

  private render(): void {
    const now = new Date();
    let firstOpenFound = false;
    const rows = this.cities
      .map(c => {
        const timeStr = now.toLocaleTimeString('en-US', {
          timeZone: c.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const hour = parseInt(
          now.toLocaleTimeString('en-US', { timeZone: c.timezone, hour: 'numeric', hour12: false }),
          10
        );
        const isOpen =
          c.marketOpen != null &&
          c.marketClose != null &&
          hour >= c.marketOpen &&
          hour < c.marketClose;
        const localDay = new Date(now.toLocaleString('en-US', { timeZone: c.timezone })).getDay();
        const isWeekend = localDay === 0 || localDay === 6;
        const status = isWeekend ? 'closed' : isOpen ? 'open' : 'closed';
        const statusColor = status === 'open' ? 'var(--green)' : 'var(--text-muted)';
        const dotColor =
          status === 'open'
            ? 'var(--green)'
            : hour >= 6 && hour < 20
              ? 'var(--yellow)'
              : 'var(--text-ghost)';
        const isToday = isOpen && !firstOpenFound;
        if (isToday) firstOpenFound = true;

        return `
        <div class="wclock-row${isToday ? ' today' : ''}">
          <span class="wclock-dot" style="background:${dotColor}"></span>
          <span class="wclock-city">${c.city}</span>
          <span class="wclock-label">${c.label}</span>
          <span class="wclock-time">${timeStr}</span>
          <span class="wclock-status" style="color:${statusColor}">${status.toUpperCase()}</span>
        </div>`;
      })
      .join('');

    this.setContent(`<div class="wclock-list">${rows}</div>`);
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const tzOptions = TIMEZONES.map(tz => ({ value: tz, label: tz }));
    const schema: SettingSchema<Record<string, unknown>>[] = [
      {
        key: 'cities',
        label: 'Manage Cities',
        type: 'sortable-list',
        itemFields: [
          { key: 'city', label: 'City', type: 'text', placeholder: 'City name' },
          { key: 'label', label: 'Label', type: 'text', placeholder: 'Market label' },
          { key: 'timezone', label: 'Timezone', type: 'select', options: tzOptions },
          { key: 'marketOpen', label: 'Open', type: 'number', min: 0, max: 23, placeholder: '9' },
          {
            key: 'marketClose',
            label: 'Close',
            type: 'number',
            min: 0,
            max: 23,
            placeholder: '16',
          },
        ],
      },
    ];

    return createSettingsForm({
      title: 'World Clock',
      schema,
      initialValues: { cities: this.cities },
      onChange: vals => {
        this.cities = (vals.cities as CityEntry[]) || [];
        saveCities(this.cities);
        this.render();
      },
    });
  }

  public destroy(): void {
    if (this.timer) clearInterval(this.timer);
    super.destroy();
  }
}
