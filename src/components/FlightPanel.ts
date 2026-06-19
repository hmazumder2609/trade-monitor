/**
 * FlightPanel — live flight tracker + aviation/critical news.
 *
 * Tabs:
 *   Live Flights — searchable list of airborne flights with callsign, origin, altitude, speed
 *   Critical News — aviation incidents + world-critical news (mission-critical highlighted)
 */
import { Panel } from './Panel';

interface Flight {
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

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  category: string;
  critical: boolean;
}

export class FlightPanel extends Panel {
  private flights: Flight[] = [];
  private totalFlights = 0;
  private news: NewsArticle[] = [];
  private activeTab: 'flights' | 'news' = 'flights';
  private searchQuery = '';

  constructor() {
    super({ id: 'flights', title: 'Flight Tracker', showCount: true });
  }

  async refresh(): Promise<void> {
    try {
      const [flightResp, newsResp] = await Promise.allSettled([
        fetch('/api/flights?action=live'),
        fetch('/api/flights?action=news'),
      ]);

      if (flightResp.status === 'fulfilled' && flightResp.value.ok) {
        const data = await flightResp.value.json();
        this.flights = data.flights || [];
        this.totalFlights = data.total || this.flights.length;
      }

      if (newsResp.status === 'fulfilled' && newsResp.value.ok) {
        const data = await newsResp.value.json();
        this.news = data.articles || [];
      }

      this.setCount(this.activeTab === 'flights' ? this.totalFlights : this.news.length);
      this.setDataBadge(this.flights.length > 0 ? 'live' : 'unavailable');
      this.render();
    } catch (err) {
      console.warn('[FlightPanel] refresh error:', err);
      this.setDataBadge('unavailable');
    }
  }

  private render(): void {
    const criticalCount = this.news.filter(n => n.critical).length;
    const filtered = this.getFilteredFlights();

    this.content.innerHTML = `
      <div class="flight-tabs">
        <button class="flight-tab ${this.activeTab === 'flights' ? 'active' : ''}" data-tab="flights">
          ✈ Live (${this.totalFlights.toLocaleString()})
        </button>
        <button class="flight-tab ${this.activeTab === 'news' ? 'active' : ''}" data-tab="news">
          🔴 Critical${criticalCount > 0 ? ` (${criticalCount})` : ''}
        </button>
      </div>
      ${this.activeTab === 'flights' ? this.renderFlightsTab(filtered) : this.renderNewsTab()}
    `;

    this.wireEvents();
  }

  private getFilteredFlights(): Flight[] {
    if (!this.searchQuery) return this.flights.slice(0, 50);
    const q = this.searchQuery.toUpperCase();
    return this.flights
      .filter(
        f =>
          f.callsign.includes(q) ||
          f.originCountry.toUpperCase().includes(q) ||
          f.icao24.toUpperCase().includes(q)
      )
      .slice(0, 50);
  }

  private renderFlightsTab(flights: Flight[]): string {
    return `
      <div class="flight-search">
        <input type="text" class="flight-search-input" placeholder="Search callsign, country, ICAO..." value="${this.searchQuery}" />
      </div>
      <div class="flight-list">
        ${
          flights.length === 0
            ? '<div class="flight-empty">No flights found</div>'
            : flights
                .map(
                  f => `
            <div class="flight-row" data-lat="${f.lat}" data-lng="${f.lng}" data-callsign="${f.callsign}">
              <div class="flight-icon" style="transform:rotate(${f.heading ?? 0}deg)">✈</div>
              <div class="flight-info">
                <div class="flight-callsign">${f.callsign || f.icao24}</div>
                <div class="flight-origin">${f.originCountry}</div>
              </div>
              <div class="flight-stats">
                <div class="flight-alt">${f.altitude ? `${Math.round(f.altitude / 0.3048).toLocaleString()} ft` : 'GND'}</div>
                <div class="flight-speed">${f.velocity ? `${Math.round(f.velocity * 1.944)} kts` : '—'}</div>
              </div>
            </div>
          `
                )
                .join('')
        }
      </div>
    `;
  }

  private renderNewsTab(): string {
    return `
      <div class="flight-news-list">
        ${
          this.news.length === 0
            ? '<div class="flight-empty">No critical news</div>'
            : this.news
                .map(
                  n => `
            <a href="${n.url}" target="_blank" class="flight-news-item ${n.critical ? 'critical' : ''}">
              ${n.critical ? '<span class="flight-news-badge">CRITICAL</span>' : ''}
              <div class="flight-news-title">${n.title}</div>
              <div class="flight-news-meta">
                <span class="flight-news-source">${n.source}</span>
                <span class="flight-news-cat">${n.category}</span>
                ${n.pubDate ? `<span class="flight-news-time">${this.formatTime(n.pubDate)}</span>` : ''}
              </div>
            </a>
          `
                )
                .join('')
        }
      </div>
    `;
  }

  private formatTime(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffH = Math.floor(diffMs / 3_600_000);
      if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
      if (diffH < 24) return `${diffH}h ago`;
      return `${Math.floor(diffH / 24)}d ago`;
    } catch {
      return '';
    }
  }

  private wireEvents(): void {
    // Tab switching
    this.content.querySelectorAll('.flight-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.tab as 'flights' | 'news';
        this.setCount(this.activeTab === 'flights' ? this.totalFlights : this.news.length);
        this.render();
      });
    });

    // Search
    const input = this.content.querySelector('.flight-search-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('input', () => {
        this.searchQuery = input.value;
        const filtered = this.getFilteredFlights();
        const list = this.content.querySelector('.flight-list');
        if (list) {
          list.innerHTML =
            filtered.length === 0
              ? '<div class="flight-empty">No flights found</div>'
              : filtered
                  .map(
                    f => `
              <div class="flight-row" data-lat="${f.lat}" data-lng="${f.lng}" data-callsign="${f.callsign}">
                <div class="flight-icon" style="transform:rotate(${f.heading ?? 0}deg)">✈</div>
                <div class="flight-info">
                  <div class="flight-callsign">${f.callsign || f.icao24}</div>
                  <div class="flight-origin">${f.originCountry}</div>
                </div>
                <div class="flight-stats">
                  <div class="flight-alt">${f.altitude ? `${Math.round(f.altitude / 0.3048).toLocaleString()} ft` : 'GND'}</div>
                  <div class="flight-speed">${f.velocity ? `${Math.round(f.velocity * 1.944)} kts` : '—'}</div>
                </div>
              </div>
            `
                  )
                  .join('');
          this.wireFlightRowClicks();
        }
      });
    }

    this.wireFlightRowClicks();
  }

  private wireFlightRowClicks(): void {
    this.content.querySelectorAll('.flight-row').forEach(row => {
      row.addEventListener('click', () => {
        const lat = parseFloat((row as HTMLElement).dataset.lat || '');
        const lng = parseFloat((row as HTMLElement).dataset.lng || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          // Dispatch event for map to fly to this flight
          window.dispatchEvent(new CustomEvent('mdm-fly-to', { detail: { lat, lng, zoom: 8 } }));
        }
      });
    });
  }

  /** Expose flights for map markers */
  public getFlights(): Flight[] {
    return this.flights;
  }

  public getNews(): NewsArticle[] {
    return this.news;
  }
}
