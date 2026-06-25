import { Panel } from '@/components/Panel';

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
    const el = document.createElement('div');
    el.className = 'wclock-settings';

    const tzOptions = TIMEZONES.map(tz => `<option value="${tz}">${tz}</option>`).join('');

    const renderList = () => {
      const list = el.querySelector('.wclock-settings-list');
      if (!list) return;
      list.innerHTML = this.cities
        .map(
          (c, i) => `
        <div class="wclock-settings-item" data-idx="${i}">
          <span class="wclock-settings-drag" title="Drag to reorder">⠿</span>
          <span class="wclock-settings-city">${c.city}</span>
          <span class="wclock-settings-label">${c.label}</span>
          <span class="wclock-settings-tz">${c.timezone}</span>
          <button class="wclock-settings-remove" data-idx="${i}" title="Remove">&times;</button>
        </div>
      `
        )
        .join('');

      // Wire remove buttons
      list.querySelectorAll<HTMLButtonElement>('.wclock-settings-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx!, 10);
          this.cities.splice(idx, 1);
          saveCities(this.cities);
          renderList();
          this.render();
        });
      });

      // Wire drag to reorder
      let dragIdx: number | null = null;
      list.querySelectorAll<HTMLElement>('.wclock-settings-item').forEach(item => {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', () => {
          dragIdx = parseInt(item.dataset.idx!, 10);
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
          dragIdx = null;
          item.classList.remove('dragging');
        });
        item.addEventListener('dragover', e => {
          e.preventDefault();
          const targetIdx = parseInt(item.dataset.idx!, 10);
          if (dragIdx === null || dragIdx === targetIdx) return;
          const dragged = this.cities.splice(dragIdx, 1)[0];
          this.cities.splice(targetIdx, 0, dragged);
          dragIdx = targetIdx;
          saveCities(this.cities);
          renderList();
          this.render();
        });
      });
    };

    el.innerHTML = `
      <div class="wclock-settings-header">Manage Cities</div>
      <div class="wclock-settings-list"></div>
      <div class="wclock-settings-add">
        <input type="text" class="wclock-settings-input" id="wcCity" placeholder="City name" />
        <input type="text" class="wclock-settings-input" id="wcLabel" placeholder="Market label (e.g., NYSE)" />
        <select class="wclock-settings-select" id="wcTimezone">${tzOptions}</select>
        <input type="number" class="wclock-settings-input wclock-settings-num" id="wcOpen" placeholder="Open (hour)" min="0" max="23" />
        <input type="number" class="wclock-settings-input wclock-settings-num" id="wcClose" placeholder="Close (hour)" min="0" max="23" />
        <button class="wclock-settings-add-btn" id="wcAddBtn">Add</button>
      </div>
    `;

    renderList();

    // Wire add button
    const addBtn = el.querySelector('#wcAddBtn')!;
    addBtn.addEventListener('click', () => {
      const city = (el.querySelector('#wcCity') as HTMLInputElement).value.trim();
      const label = (el.querySelector('#wcLabel') as HTMLInputElement).value.trim();
      const timezone = (el.querySelector('#wcTimezone') as HTMLSelectElement).value;
      const openStr = (el.querySelector('#wcOpen') as HTMLInputElement).value;
      const closeStr = (el.querySelector('#wcClose') as HTMLInputElement).value;

      if (!city || !timezone) return;

      const marketOpen = openStr ? parseInt(openStr, 10) : undefined;
      const marketClose = closeStr ? parseInt(closeStr, 10) : undefined;

      this.cities.push({
        city,
        label: label || city.toUpperCase(),
        timezone,
        marketOpen,
        marketClose,
      });
      saveCities(this.cities);

      // Clear inputs
      (el.querySelector('#wcCity') as HTMLInputElement).value = '';
      (el.querySelector('#wcLabel') as HTMLInputElement).value = '';
      (el.querySelector('#wcOpen') as HTMLInputElement).value = '';
      (el.querySelector('#wcClose') as HTMLInputElement).value = '';

      renderList();
      this.render();
    });

    // Allow Enter key to add
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '.wclock-settings-input, .wclock-settings-select'
    ).forEach(input => {
      input.addEventListener('keydown', e => {
        if ((e as KeyboardEvent).key === 'Enter') (addBtn as HTMLElement).click();
      });
    });

    return el;
  }

  public destroy(): void {
    if (this.timer) clearInterval(this.timer);
    super.destroy();
  }
}
