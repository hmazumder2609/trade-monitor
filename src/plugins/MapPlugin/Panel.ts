import { Panel } from '@/components/Panel';

function buildMapStyle(tileUrls: string[], name: string) {
  return {
    version: 8 as const,
    name,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: tileUrls,
        tileSize: 256,
        attribution: '&copy; OSM &copy; CARTO',
      },
    },
    layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 19 }],
  };
}

const DARK_NOLABEL_TILES = [
  'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
  'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
  'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
];
const LIGHT_TILES = [
  'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
  'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
  'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
];
const VOYAGER_TILES = [
  'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
  'https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
];

function getMapStyle() {
  const variant = document.documentElement.dataset.variant;
  const theme = document.documentElement.dataset.theme;
  if (variant === 'happy') {
    return theme === 'dark'
      ? buildMapStyle(DARK_NOLABEL_TILES, 'dark-nolabel')
      : buildMapStyle(VOYAGER_TILES, 'voyager-nolabel');
  }
  return theme === 'light'
    ? buildMapStyle(LIGHT_TILES, 'light-nolabel')
    : buildMapStyle(DARK_NOLABEL_TILES, 'dark-nolabel');
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'news' | 'schedule' | 'alert' | 'activity' | 'server-up' | 'server-down' | 'flight';
  color?: string;
  description?: string;
  url?: string;
  pulse?: boolean;
  heading?: number;
}

interface FlightData {
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  onGround: boolean;
}

interface MapSettings {
  centerLat: number;
  centerLon: number;
  zoom: number;
}

const DEFAULT_MAP_SETTINGS: MapSettings = { centerLat: 20, centerLon: 0, zoom: 1.5 };

function loadMapSettings(): MapSettings {
  try {
    const raw = localStorage.getItem('mdm-map-settings');
    if (raw) return { ...DEFAULT_MAP_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_MAP_SETTINGS };
}

function saveMapSettings(s: MapSettings): void {
  localStorage.setItem('mdm-map-settings', JSON.stringify(s));
}

const SOURCE_COORDS: Record<string, [number, number]> = {
  'BBC World': [-0.12, 51.51],
  BBC: [-0.12, 51.51],
  Reuters: [-73.98, 40.75],
  'Reuters World': [-73.98, 40.75],
  'Reuters Business': [-73.98, 40.75],
  'AP News': [-73.98, 40.75],
  'Al Jazeera': [51.53, 25.29],
  CNBC: [-74.0, 40.71],
  Bloomberg: [-73.99, 40.72],
  CNN: [-84.39, 33.75],
  'Financial Times': [-0.1, 51.52],
  'France 24': [2.35, 48.86],
  'DW News': [13.38, 52.52],
  'Hacker News': [-122.42, 37.77],
  TechCrunch: [-122.42, 37.77],
  'The Verge': [-73.99, 40.73],
  'Ars Technica': [-73.99, 40.73],
  'VentureBeat AI': [-122.42, 37.77],
  'Yahoo Finance': [-122.42, 37.77],
  EuroNews: [4.85, 45.76],
  'Guardian World': [-0.12, 51.51],
  SCMP: [114.17, 22.28],
  Caixin: [121.47, 31.23],
  'Nature News': [-0.13, 51.53],
  'NPR News': [-77.01, 38.9],
  Politico: [-77.04, 38.91],
};

async function geolocateUrl(url: string): Promise<[number, number] | null> {
  try {
    const hostname = new URL(url).hostname;
    const resp = await fetch(`https://ipapi.co/${hostname}/json/`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    if (data.latitude && data.longitude) return [data.longitude, data.latitude];
  } catch {}
  return null;
}

export class MapPanel extends Panel {
  private mapContainer: HTMLElement;
  private map: any = null;
  private markers: MapMarker[] = [];
  private markerEls: any[] = [];
  private mapReady = false;
  private settings: MapSettings = loadMapSettings();

  private flights: FlightData[] = [];
  private totalFlights = 0;
  private trackedFlights = new Set<string>();
  private selectAllFlights = false;
  private flightSearch = '';
  private flightOverlayOpen = false;
  private flightRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ id: 'map', title: 'Global Map', className: 'panel-wide', showCount: true });
    this.content.style.padding = '0';
    this.content.style.overflow = 'hidden';
    this.content.style.position = 'relative';

    this.mapContainer = document.createElement('div');
    this.mapContainer.style.cssText = 'width:100%;height:100%;min-height:200px;';
    this.content.innerHTML = '';
    this.content.appendChild(this.mapContainer);

    window.addEventListener('mdm-theme-changed', () => this.switchMapStyle());
    window.addEventListener('mdm-fly-to', ((e: CustomEvent) => {
      const { lat, lng, zoom } = e.detail;
      this.flyTo(lng, lat, zoom || 8);
    }) as EventListener);

    this.buildLegend();
    this.buildFlightOverlay();
    this.initMap();
    this.startFlightRefresh();
  }

  private buildLegend(): void {
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.innerHTML = `
      <div class="map-legend-item"><span style="font-size:10px">✈</span>Flights</div>
      <div class="map-legend-item"><span class="map-legend-dot" style="background:#3b82f6"></span>News</div>
      <div class="map-legend-item"><span class="map-legend-dot" style="background:#ff4444"></span>Alert</div>
      <div class="map-legend-item"><span class="map-legend-dot" style="background:#44ff88"></span>Location</div>
      <div class="map-legend-item"><span class="map-legend-dot" style="background:#44ff88"></span>Server</div>
    `;
    this.content.appendChild(legend);
  }

  private buildFlightOverlay(): void {
    const overlay = document.createElement('div');
    overlay.className = 'map-flight-overlay';
    overlay.id = 'mapFlightOverlay';
    this.content.appendChild(overlay);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'map-flight-toggle';
    toggleBtn.innerHTML = '✈';
    toggleBtn.title = 'Flight Tracker';
    toggleBtn.addEventListener('click', () => {
      this.flightOverlayOpen = !this.flightOverlayOpen;
      this.renderFlightOverlay();
    });
    this.content.appendChild(toggleBtn);
  }

  private renderFlightOverlay(): void {
    const overlay = this.content.querySelector('#mapFlightOverlay') as HTMLElement;
    if (!overlay) return;

    overlay.classList.toggle('open', this.flightOverlayOpen);

    if (!this.flightOverlayOpen) {
      overlay.innerHTML = '';
      return;
    }

    const filtered = this.getFilteredFlights();
    const trackedCount = this.trackedFlights.size;

    overlay.innerHTML = `
      <div class="mfo-header">
        <span class="mfo-title">✈ FLIGHTS <span class="mfo-count">${this.totalFlights.toLocaleString()}</span></span>
        <span class="mfo-tracked">${trackedCount > 0 ? `${trackedCount} tracked` : ''}</span>
      </div>
      <div class="mfo-controls">
        <input type="text" class="mfo-search" placeholder="Search callsign, country..." value="${this.flightSearch}" />
        <label class="mfo-select-all-label">
          <input type="checkbox" class="mfo-select-all" ${this.selectAllFlights ? 'checked' : ''} /> Show all
        </label>
      </div>
      <div class="mfo-list">
        ${
          filtered.length === 0
            ? '<div class="mfo-empty">No flights found</div>'
            : filtered
                .map(f => {
                  const tracked = this.trackedFlights.has(f.icao24) || this.selectAllFlights;
                  return `
            <div class="mfo-row ${tracked ? 'tracked' : ''}" data-icao="${f.icao24}" data-lat="${f.lat}" data-lng="${f.lng}">
              <input type="checkbox" class="mfo-check" data-icao="${f.icao24}" ${tracked ? 'checked' : ''} />
              <span class="mfo-plane" style="transform:rotate(${f.heading ?? 0}deg)">✈</span>
              <div class="mfo-info">
                <span class="mfo-callsign">${f.callsign || f.icao24}</span>
                <span class="mfo-country">${f.originCountry}</span>
              </div>
              <div class="mfo-stats">
                <span>${f.altitude ? `${Math.round(f.altitude / 0.3048).toLocaleString()} ft` : 'GND'}</span>
                <span>${f.velocity ? `${Math.round(f.velocity * 1.944)} kts` : '—'}</span>
              </div>
              <button class="mfo-locate" data-lat="${f.lat}" data-lng="${f.lng}" title="Locate on map">⊕</button>
            </div>`;
                })
                .join('')
        }
      </div>
    `;

    this.wireFlightOverlayEvents(overlay);
  }

  private getFilteredFlights(): FlightData[] {
    const q = this.flightSearch.toUpperCase();
    const list = q
      ? this.flights.filter(
          f =>
            f.callsign.includes(q) ||
            f.originCountry.toUpperCase().includes(q) ||
            f.icao24.toUpperCase().includes(q)
        )
      : this.flights;
    return list.slice(0, 60);
  }

  private wireFlightOverlayEvents(overlay: HTMLElement): void {
    const search = overlay.querySelector('.mfo-search') as HTMLInputElement;
    if (search) {
      search.addEventListener('input', () => {
        this.flightSearch = search.value;
        this.renderFlightOverlay();
      });
    }

    const selectAll = overlay.querySelector('.mfo-select-all') as HTMLInputElement;
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        this.selectAllFlights = selectAll.checked;
        if (!selectAll.checked) this.trackedFlights.clear();
        this.updateFlightMarkers();
        this.renderFlightOverlay();
      });
    }

    overlay.querySelectorAll('.mfo-check').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation();
        const icao = (cb as HTMLInputElement).dataset.icao!;
        if ((cb as HTMLInputElement).checked) {
          this.trackedFlights.add(icao);
        } else {
          this.trackedFlights.delete(icao);
          this.selectAllFlights = false;
        }
        this.updateFlightMarkers();
        const trackedEl = overlay.querySelector('.mfo-tracked');
        if (trackedEl)
          trackedEl.textContent =
            this.trackedFlights.size > 0 ? `${this.trackedFlights.size} tracked` : '';
        const row = (cb as HTMLElement).closest('.mfo-row');
        if (row) row.classList.toggle('tracked', (cb as HTMLInputElement).checked);
      });
    });

    overlay.querySelectorAll('.mfo-locate').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const lat = parseFloat((btn as HTMLElement).dataset.lat || '');
        const lng = parseFloat((btn as HTMLElement).dataset.lng || '');
        if (!isNaN(lat) && !isNaN(lng)) this.flyTo(lng, lat, 8);
      });
    });

    overlay.querySelectorAll('.mfo-row').forEach(row => {
      row.addEventListener('click', e => {
        if (
          (e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'BUTTON'
        )
          return;
        const icao = (row as HTMLElement).dataset.icao!;
        const lat = parseFloat((row as HTMLElement).dataset.lat || '');
        const lng = parseFloat((row as HTMLElement).dataset.lng || '');
        this.trackedFlights.add(icao);
        this.updateFlightMarkers();
        if (!isNaN(lat) && !isNaN(lng)) {
          this.flyTo(lng, lat, 7);
          setTimeout(() => {
            const marker = this.markerEls.find((m: any) => {
              const el = m.getElement();
              return el?.dataset?.icao === icao;
            });
            if (marker) marker.togglePopup();
          }, 600);
        }
        this.renderFlightOverlay();
      });
    });
  }

  private startFlightRefresh(): void {
    this.fetchFlights();
    this.flightRefreshTimer = setInterval(() => this.fetchFlights(), 30_000);
  }

  private async fetchFlights(): Promise<void> {
    try {
      const resp = await fetch('/api/flights?action=live');
      if (!resp.ok) return;
      const data = await resp.json();
      this.flights = data.flights || [];
      this.totalFlights = data.total || this.flights.length;

      if (this.trackedFlights.size > 0 || this.selectAllFlights) {
        this.updateFlightMarkers();
      }
      if (this.flightOverlayOpen) this.renderFlightOverlay();
    } catch {}
  }

  private updateFlightMarkers(): void {
    this.markers = this.markers.filter(m => m.type !== 'flight');

    const visible = this.selectAllFlights
      ? this.flights.slice(0, 200)
      : this.flights.filter(f => this.trackedFlights.has(f.icao24));

    for (const f of visible) {
      if (f.lat == null || f.lng == null) continue;
      const altFt = f.altitude ? Math.round(f.altitude / 0.3048) : null;
      const speedKts = f.velocity ? Math.round(f.velocity * 1.944) : null;
      this.markers.push({
        id: `flight-${f.icao24}`,
        lat: f.lat,
        lng: f.lng,
        title: f.callsign || f.icao24,
        type: 'flight',
        color: '#fbbf24',
        description: [
          f.originCountry,
          altFt ? `${altFt.toLocaleString()} ft` : 'Ground',
          speedKts ? `${speedKts} kts` : null,
          f.onGround ? '🔴 On Ground' : '🟢 Airborne',
          `Heading ${f.heading ? Math.round(f.heading) : 0}°`,
        ]
          .filter(Boolean)
          .join(' · '),
        heading: f.heading ?? 0,
      });
    }

    this.setCount(this.markers.length);
    if (this.mapReady) this.renderMarkers();
  }

  private async initMap(): Promise<void> {
    const cssHref = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.css';
    if (!document.querySelector(`link[href*="maplibre-gl"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      document.head.appendChild(link);
    }

    try {
      const maplibregl = await import('maplibre-gl');
      this.map = new maplibregl.Map({
        container: this.mapContainer,
        style: getMapStyle() as any,
        center: [this.settings.centerLon, this.settings.centerLat],
        zoom: this.settings.zoom,
        attributionControl: false,
      });
      this.map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        'top-right'
      );
      this.map.on('load', () => {
        this.mapReady = true;
        this.setDataBadge('live');
        this.renderMarkers();
      });
    } catch (err) {
      console.warn('[MapPanel] MapLibre load failed:', err);
      this.mapContainer.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg-secondary);color:var(--text-dim);font-size:11px;">Map loading failed</div>';
    }
  }

  public setMarkers(markers: MapMarker[]): void {
    const flightMarkers = this.markers.filter(m => m.type === 'flight');
    this.markers = [...markers, ...flightMarkers];
    this.setCount(this.markers.length);
    if (this.mapReady) this.renderMarkers();
  }

  public addMarker(marker: MapMarker): void {
    this.markers = this.markers.filter(m => m.id !== marker.id);
    this.markers.push(marker);
    this.setCount(this.markers.length);
    if (this.mapReady) this.renderMarkers();
  }

  private async renderMarkers(): Promise<void> {
    for (const m of this.markerEls) {
      try {
        m.remove();
      } catch {}
    }
    this.markerEls = [];
    if (!this.map) return;

    const maplibregl = await import('maplibre-gl');
    const visibleMarkers = this.markers;

    for (const m of visibleMarkers) {
      const color = m.color || this.getColor(m.type);
      const isFlight = m.type === 'flight';
      const isAlert = m.type === 'alert';
      const isLocation = m.type === 'activity';
      const size = isAlert ? 18 : isLocation ? 14 : isFlight ? 16 : 11;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = `width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;`;

      let el: HTMLElement;
      if (isFlight) {
        el = document.createElement('div');
        el.className = 'map-flight-icon';
        const heading = m.heading ?? 0;
        el.style.cssText = `font-size:14px;color:#fbbf24;text-shadow:0 0 6px rgba(251,191,36,0.6);transform:rotate(${heading}deg);transition:transform 0.15s;pointer-events:none;`;
        el.textContent = '✈';
      } else {
        el = document.createElement('div');
        el.className = 'map-marker';
        el.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;box-shadow:0 0 ${isAlert ? 12 : 6}px ${color};transition:transform 0.15s;pointer-events:none;`;
        if (m.pulse || isAlert) {
          el.style.animation = 'map-marker-pulse 2s ease-in-out infinite';
        }
      }
      wrapper.title = m.title;
      if (isFlight) wrapper.dataset.icao = m.id.replace('flight-', '');
      wrapper.appendChild(el);
      const heading = m.heading ?? 0;
      wrapper.addEventListener('mouseenter', () => {
        el.style.transform = isFlight ? `rotate(${heading}deg) scale(1.5)` : 'scale(1.5)';
      });
      wrapper.addEventListener('mouseleave', () => {
        el.style.transform = isFlight ? `rotate(${heading}deg)` : 'scale(1)';
      });

      const typeLabel = this.getTypeLabel(m.type);
      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        maxWidth: '260px',
        className: 'map-popup-dark',
      }).setHTML(`
          <div style="font-family:var(--font-body);font-size:11px;line-height:1.4;color:#e0e0e0;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};margin-bottom:3px;">${typeLabel}</div>
            <div style="font-weight:600;margin-bottom:4px;color:#fff;">${m.title}</div>
            ${m.description ? `<div style="color:#999;font-size:10px;">${m.description}</div>` : ''}
            ${m.url ? `<a href="${m.url}" target="_blank" style="color:#3b82f6;font-size:10px;">Open →</a>` : ''}
          </div>
        `);

      const marker = new maplibregl.Marker({ element: wrapper })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(this.map);
      this.markerEls.push(marker);
    }
  }

  private getColor(type: MapMarker['type']): string {
    switch (type) {
      case 'news':
        return '#3b82f6';
      case 'schedule':
        return '#44ff88';
      case 'alert':
        return '#ff4444';
      case 'activity':
        return '#44ff88';
      case 'server-up':
        return '#44ff88';
      case 'server-down':
        return '#ff4444';
      case 'flight':
        return '#fbbf24';
      default:
        return '#888';
    }
  }

  private switchMapStyle(): void {
    if (!this.map) return;
    this.map.setStyle(getMapStyle() as any);
    this.map.once('style.load', () => this.renderMarkers());
  }

  private getTypeLabel(type: MapMarker['type']): string {
    switch (type) {
      case 'news':
        return '📰 News Source';
      case 'schedule':
        return '📅 Calendar Event';
      case 'alert':
        return '🔴 Alert';
      case 'activity':
        return '📍 Location';
      case 'server-up':
        return '🟢 Server UP';
      case 'server-down':
        return '🔴 Server DOWN';
      case 'flight':
        return '✈ Flight';
      default:
        return 'Marker';
    }
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Map Settings</div>
      <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">
        <span style="font-size:11px;color:var(--text-secondary);">Center Latitude</span>
        <input type="number" class="social-settings-input" id="mapCenterLat"
          min="-90" max="90" step="0.01" value="${this.settings.centerLat}" />
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">
        <span style="font-size:11px;color:var(--text-secondary);">Center Longitude</span>
        <input type="number" class="social-settings-input" id="mapCenterLon"
          min="-180" max="180" step="0.01" value="${this.settings.centerLon}" />
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
        <span style="font-size:11px;color:var(--text-secondary);">Zoom Level</span>
        <input type="number" class="social-settings-input" id="mapZoom"
          min="0.5" max="5" step="0.5" value="${this.settings.zoom}" />
      </label>
      <button class="social-settings-add-btn" id="mapResetDefault">Reset to Default</button>
    `;

    const applySettings = () => {
      saveMapSettings(this.settings);
      if (this.map) {
        this.map.setCenter([this.settings.centerLon, this.settings.centerLat]);
        this.map.setZoom(this.settings.zoom);
      }
    };

    const latInput = el.querySelector('#mapCenterLat') as HTMLInputElement;
    const lonInput = el.querySelector('#mapCenterLon') as HTMLInputElement;
    const zoomInput = el.querySelector('#mapZoom') as HTMLInputElement;

    latInput.addEventListener('input', () => {
      this.settings.centerLat = parseFloat(latInput.value) || 0;
      applySettings();
    });
    lonInput.addEventListener('input', () => {
      this.settings.centerLon = parseFloat(lonInput.value) || 0;
      applySettings();
    });
    zoomInput.addEventListener('input', () => {
      this.settings.zoom = parseFloat(zoomInput.value) || 1.5;
      applySettings();
    });

    el.querySelector('#mapResetDefault')!.addEventListener('click', () => {
      this.settings = { ...DEFAULT_MAP_SETTINGS };
      latInput.value = String(this.settings.centerLat);
      lonInput.value = String(this.settings.centerLon);
      zoomInput.value = String(this.settings.zoom);
      applySettings();
    });

    return el;
  }

  public flyTo(lng: number, lat: number, zoom = 6): void {
    if (this.map) this.map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
  }

  async refresh(): Promise<void> {}

  public async refreshMarkers(): Promise<void> {
    const markers: MapMarker[] = [];
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            this.addMarker({
              id: 'my-location',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              title: 'You are here',
              type: 'activity',
              color: '#44ff88',
              description: 'Current location',
            });
          },
          () => {},
          { timeout: 3000 }
        );
      }
      try {
        const { fetchCalendarEvents } = await import('@/services/schedule');
        const events = await fetchCalendarEvents();
        for (const ev of events) {
          if (!ev.location || ev.location.includes('http') || ev.location.includes('Meeting'))
            continue;
          try {
            const geoResp = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ev.location)}&format=json&limit=1`,
              { headers: { 'User-Agent': 'MyDailyMonitor/1.0' } }
            );
            const geoData = (await geoResp.json()) as any[];
            if (geoData[0])
              markers.push({
                id: `event-${ev.id}`,
                lat: parseFloat(geoData[0].lat),
                lng: parseFloat(geoData[0].lon),
                title: ev.title,
                type: 'schedule',
                description: ev.location,
                color: '#44ff88',
              });
          } catch {}
        }
      } catch {}
      try {
        const { fetchNews } = await import('@/services/news');
        const articles = await fetchNews();
        const usedSources = new Set<string>();
        for (const a of articles.slice(0, 20)) {
          const coords = SOURCE_COORDS[a.source];
          if (!coords || usedSources.has(a.source)) continue;
          usedSources.add(a.source);
          const isAlert = a.threatLevel === 'critical' || a.threatLevel === 'high';
          markers.push({
            id: `news-${a.source}`,
            lat: coords[1],
            lng: coords[0],
            title: `${a.source}: ${a.title}`,
            type: isAlert ? 'alert' : 'news',
            description: a.source,
            url: a.url,
          });
        }
      } catch {}
      try {
        const probes = JSON.parse(localStorage.getItem('mdm-server-probes') || '[]') as string[];
        if (probes.length > 0) {
          const probeResp = await fetch(
            `/api/system?action=probe&urls=${probes.slice(0, 5).join(',')}`
          );
          const probeData = (await probeResp.json()) as any;
          for (const r of probeData.probes || []) {
            if (!r.url) continue;
            const coords = await geolocateUrl(r.url);
            if (coords)
              markers.push({
                id: `server-${r.url}`,
                lat: coords[1],
                lng: coords[0],
                title: `${new URL(r.url).hostname} — ${r.ok ? 'UP' : 'DOWN'}`,
                type: r.ok ? ('server-up' as any) : ('server-down' as any),
                description: r.ok ? `${r.status} OK · ${r.latencyMs}ms` : r.error || 'Failed',
                url: r.url,
              });
          }
        }
      } catch {}
      this.setMarkers(markers);
    } catch (err) {
      console.warn('[Map] marker refresh failed:', err);
    }
  }

  public destroy(): void {
    if (this.flightRefreshTimer) clearInterval(this.flightRefreshTimer);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.destroy();
  }
}
