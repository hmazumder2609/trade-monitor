import { Panel } from '@/components/Panel';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

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

  constructor() {
    super({ id: 'weather', title: 'Weather', showCount: false });
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
      this.setDataWindow('5-day forecast');
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

  private render(w: WeatherData): void {
    const icon = weatherIcon(w.weatherCode, w.isDay);
    const desc = weatherDesc(w.weatherCode);
    const unitSymbol = this.settings.unit === 'fahrenheit' ? '°F' : '°C';

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
    const schema: SettingSchema<WeatherSettings>[] = [
      {
        key: 'useAutoLocation',
        label: 'Auto-detect location',
        type: 'checkbox',
        hint: 'Uses browser geolocation',
      },
      {
        key: 'cityName',
        label: 'City',
        type: 'text',
        placeholder: 'Enter city name...',
        dependsOn: { key: 'useAutoLocation', value: false },
      },
      {
        key: 'lat',
        label: 'Latitude',
        type: 'number',
        step: 0.01,
        min: -90,
        max: 90,
        dependsOn: { key: 'useAutoLocation', value: false },
      },
      {
        key: 'lon',
        label: 'Longitude',
        type: 'number',
        step: 0.01,
        min: -180,
        max: 180,
        dependsOn: { key: 'useAutoLocation', value: false },
      },
      {
        key: 'unit',
        label: 'Temperature unit',
        type: 'select',
        options: [
          { value: 'celsius', label: 'Celsius (\u00B0C)' },
          { value: 'fahrenheit', label: 'Fahrenheit (\u00B0F)' },
        ],
      },
    ];

    const form = createSettingsForm<WeatherSettings>({
      title: 'Weather Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        saveSettings(this.settings);
        if (vals.useAutoLocation) {
          this.detectLocation();
        } else {
          this.locationReady = true;
          this.refresh();
        }
      },
    });

    return form;
  }

  public destroy(): void {
    super.destroy();
  }
}
