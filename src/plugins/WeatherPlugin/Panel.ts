import { Panel } from '@/components/Panel';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse';
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  timezone: string;
  daily: Array<{ date: string; tempMax: number; tempMin: number; code: number }>;
}

interface WeatherSettings {
  lat: number;
  lon: number;
  cityName: string;
  unit: 'celsius' | 'fahrenheit';
  useAutoLocation: boolean;
}

const STORAGE_KEY = 'mdm-weather-settings';

const DEFAULT_SETTINGS: WeatherSettings = {
  lat: 0,
  lon: 0,
  cityName: '',
  unit: 'celsius',
  useAutoLocation: true,
};

function loadSettings(): WeatherSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: WeatherSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function weatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 3) return isDay ? '⛅' : '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌧️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '❄️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function weatherDesc(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export class WeatherPanel extends Panel {
  private settings: WeatherSettings;
  private locationReady = false;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ id: 'weather', title: 'Weather & Time', showCount: false });
    this.settings = loadSettings();

    if (this.settings.useAutoLocation) {
      this.showLoading('Detecting location...');
      this.detectLocation();
    } else if (this.settings.lat && this.settings.lon) {
      this.locationReady = true;
      this.refresh();
    } else {
      this.showLoading('Set your location in settings');
    }

    this.clockTimer = setInterval(() => this.updateClocks(), 1000);
  }

  private detectLocation(): void {
    if (!('geolocation' in navigator)) {
      this.showError('Geolocation not available. Set location in settings.', () =>
        this.detectLocation()
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        this.settings.lat = pos.coords.latitude;
        this.settings.lon = pos.coords.longitude;
        this.locationReady = true;

        try {
          const resp = await fetch(
            `${NOMINATIM_API}?lat=${this.settings.lat}&lon=${this.settings.lon}&format=json&zoom=10`,
            { headers: { 'User-Agent': 'MyDailyMonitor/1.0' } }
          );
          if (resp.ok) {
            const data = (await resp.json()) as any;
            this.settings.cityName =
              data.address?.city ||
              data.address?.town ||
              data.address?.county ||
              data.address?.state ||
              '';
            saveSettings(this.settings);
          }
        } catch {}

        this.refresh();
      },
      () => this.fallbackIPLocation(),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  private async fallbackIPLocation(): Promise<void> {
    try {
      const resp = await fetch('https://ipapi.co/json/');
      if (resp.ok) {
        const data = (await resp.json()) as any;
        this.settings.lat = data.latitude;
        this.settings.lon = data.longitude;
        this.settings.cityName = data.city || '';
        this.locationReady = true;
        saveSettings(this.settings);
        this.refresh();
      } else {
        this.showError('Could not detect location. Set location in settings.', () =>
          this.detectLocation()
        );
      }
    } catch {
      this.showError('Could not detect location.', () => this.detectLocation());
    }
  }

  private async searchCity(
    query: string
  ): Promise<Array<{ name: string; country: string; lat: number; lon: number }>> {
    try {
      const resp = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}&count=5`);
      if (resp.ok) {
        const data = (await resp.json()) as any;
        return data.results || [];
      }
    } catch {}
    return [];
  }

  async refresh(): Promise<void> {
    if (!this.locationReady) return;
    if (this.isFetching) return;
    this.setFetching(true);
    try {
      const tempUnit = this.settings.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
      const url = `${OPEN_METEO_API}?latitude=${this.settings.lat}&longitude=${this.settings.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5&temperature_unit=${tempUnit}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as any;

      const data: WeatherData = {
        temperature: json.current.temperature_2m,
        feelsLike: json.current.apparent_temperature,
        humidity: json.current.relative_humidity_2m,
        windSpeed: json.current.wind_speed_10m,
        weatherCode: json.current.weather_code,
        isDay: json.current.is_day === 1,
        timezone: json.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        daily: (json.daily?.time || []).map((d: string, i: number) => ({
          date: d,
          tempMax: json.daily.temperature_2m_max[i],
          tempMin: json.daily.temperature_2m_min[i],
          code: json.daily.weather_code[i],
        })),
      };

      this.render(data);
      this.setDataBadge('live');
    } catch {
      this.showError('Weather unavailable', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private updateClocks(): void {
    const localEl = this.content.querySelector('#localClock');
    const aoeEl = this.content.querySelector('#aoeClock');
    if (!localEl || !aoeEl) return;

    const now = new Date();
    localEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    aoeEl.textContent = now.toLocaleTimeString('en-US', {
      timeZone: 'Etc/GMT+12',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private render(w: WeatherData): void {
    const icon = weatherIcon(w.weatherCode, w.isDay);
    const desc = weatherDesc(w.weatherCode);
    const unitSymbol = this.settings.unit === 'fahrenheit' ? '°F' : '°C';
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const aoeTime = now.toLocaleTimeString('en-US', {
      timeZone: 'Etc/GMT+12',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const localDate = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const aoeDate = now.toLocaleDateString('en-US', {
      timeZone: 'Etc/GMT+12',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const tzAbbr = w.timezone.replace(/_/g, ' ').split('/').pop() || '';

    const forecastHtml = w.daily
      .slice(1)
      .map(d => {
        const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('en', {
          weekday: 'short',
        });
        return `
        <div class="weather-forecast-day">
          <span class="weather-forecast-name">${dayName}</span>
          <span class="weather-forecast-icon">${weatherIcon(d.code, true)}</span>
          <span class="weather-forecast-temps">
            <span class="weather-temp-hi">${Math.round(d.tempMax)}${unitSymbol}</span>
            <span class="weather-temp-lo">${Math.round(d.tempMin)}${unitSymbol}</span>
          </span>
        </div>`;
      })
      .join('');

    this.setContent(`
      <div class="weather-container">
        <div class="weather-clocks">
          <div class="weather-clock-item">
            <span class="weather-clock-label">${this.settings.cityName || tzAbbr || 'Local'}</span>
            <span class="weather-clock-time" id="localClock">${localTime}</span>
            <span class="weather-clock-date">${localDate}</span>
          </div>
          <div class="weather-clock-item">
            <span class="weather-clock-label">AoE (UTC-12)</span>
            <span class="weather-clock-time" id="aoeClock">${aoeTime}</span>
            <span class="weather-clock-date">${aoeDate}</span>
          </div>
        </div>
        <div class="weather-current">
          <div class="weather-main">
            <span class="weather-icon-lg">${icon}</span>
            <div>
              <span class="weather-temp-lg">${Math.round(w.temperature)}${unitSymbol}</span>
              <div class="weather-desc">${desc}${this.settings.cityName ? ` · ${this.settings.cityName}` : ''}</div>
            </div>
          </div>
          <div class="weather-details">
            <span>Feels ${Math.round(w.feelsLike)}${unitSymbol}</span>
            <span>💧 ${w.humidity}%</span>
            <span>💨 ${Math.round(w.windSpeed)} km/h</span>
          </div>
        </div>
        <div class="weather-forecast">${forecastHtml}</div>
      </div>
    `);
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'weather-settings';

    el.innerHTML = `
      <div class="weather-settings-header">Weather Settings</div>
      <label class="weather-settings-label">
        <input type="checkbox" id="wsAuto" ${this.settings.useAutoLocation ? 'checked' : ''} />
        Auto-detect location
      </label>
      <div class="weather-settings-manual" style="display:${this.settings.useAutoLocation ? 'none' : 'block'}">
        <div class="weather-settings-search-row">
          <input type="text" class="weather-settings-input" id="wsCitySearch" placeholder="Search city..." />
          <button class="weather-settings-search-btn" id="wsSearchBtn">Search</button>
        </div>
        <div class="weather-settings-results" id="wsResults"></div>
        <div class="weather-settings-current">
          Current: ${this.settings.cityName || `${this.settings.lat.toFixed(2)}, ${this.settings.lon.toFixed(2)}`}
        </div>
      </div>
      <label class="weather-settings-label">
        Temperature unit
        <select class="weather-settings-select" id="wsUnit">
          <option value="celsius" ${this.settings.unit === 'celsius' ? 'selected' : ''}>Celsius (°C)</option>
          <option value="fahrenheit" ${this.settings.unit === 'fahrenheit' ? 'selected' : ''}>Fahrenheit (°F)</option>
        </select>
      </label>
    `;

    // Toggle manual location section
    const autoCheck = el.querySelector('#wsAuto') as HTMLInputElement;
    const manualSection = el.querySelector('.weather-settings-manual') as HTMLElement;
    autoCheck.addEventListener('change', () => {
      this.settings.useAutoLocation = autoCheck.checked;
      saveSettings(this.settings);
      manualSection.style.display = autoCheck.checked ? 'none' : 'block';
      if (autoCheck.checked) {
        this.detectLocation();
      }
    });

    // City search
    const searchBtn = el.querySelector('#wsSearchBtn')!;
    const resultsDiv = el.querySelector('#wsResults')!;
    const citySearch = el.querySelector('#wsCitySearch') as HTMLInputElement;

    const doSearch = async () => {
      const query = citySearch.value.trim();
      if (!query) return;
      resultsDiv.innerHTML = '<div class="weather-settings-searching">Searching...</div>';
      const results = await this.searchCity(query);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="weather-settings-no-results">No results found</div>';
        return;
      }
      resultsDiv.innerHTML = results
        .map(
          (r, i) => `
        <div class="weather-settings-result" data-idx="${i}">
          <span class="weather-settings-result-name">${r.name}</span>
          <span class="weather-settings-result-country">${r.country}</span>
          <button class="weather-settings-result-btn" data-idx="${i}">Set</button>
        </div>
      `
        )
        .join('');

      resultsDiv
        .querySelectorAll<HTMLButtonElement>('.weather-settings-result-btn')
        .forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx!, 10);
            const chosen = results[idx];
            this.settings.lat = chosen.lat;
            this.settings.lon = chosen.lon;
            this.settings.cityName = chosen.name;
            this.settings.useAutoLocation = false;
            autoCheck.checked = false;
            manualSection.style.display = 'block';
            saveSettings(this.settings);

            const currentDiv = el.querySelector('.weather-settings-current');
            if (currentDiv) currentDiv.textContent = `Current: ${chosen.name}`;

            this.locationReady = true;
            this.refresh();
          });
        });
    };

    searchBtn.addEventListener('click', doSearch);
    citySearch.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });

    // Unit change
    const unitSelect = el.querySelector('#wsUnit') as HTMLSelectElement;
    unitSelect.addEventListener('change', () => {
      this.settings.unit = unitSelect.value as 'celsius' | 'fahrenheit';
      saveSettings(this.settings);
      this.refresh();
    });

    return el;
  }

  public destroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    super.destroy();
  }
}
