/**
 * Flight Tracking API — uses OpenSky Network (free, no API key required).
 *
 * Actions:
 *   ?action=live    — returns live flights in a bounding box (default: worldwide sample)
 *   ?action=search&callsign=UAL123 — search by callsign
 *   ?action=news    — aviation/critical news from RSS feeds
 */

interface FlightState {
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null; // meters
  velocity: number | null; // m/s
  heading: number | null; // degrees
  onGround: boolean;
  squawk: string | null;
}

interface FlightsResponse {
  flights: FlightState[];
  timestamp: number;
  source: string;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  category: string;
}

// Cache to avoid hammering the API (OpenSky has rate limits)
let flightCache: { data: FlightState[]; ts: number } = { data: [], ts: 0 };
const CACHE_TTL_MS = 15_000; // 15 seconds

async function fetchOpenSkyFlights(
  lamin?: number,
  lomin?: number,
  lamax?: number,
  lomax?: number
): Promise<FlightState[]> {
  const now = Date.now();
  if (flightCache.data.length > 0 && now - flightCache.ts < CACHE_TTL_MS) {
    return flightCache.data;
  }

  let url = 'https://opensky-network.org/api/states/all';
  if (lamin !== undefined) {
    url += `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  }

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'TradeMonitor/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    // Rate limited or down — return cache
    if (flightCache.data.length > 0) return flightCache.data;
    throw new Error(`OpenSky API error: ${resp.status}`);
  }

  const json = (await resp.json()) as any;
  const states: any[] = json.states || [];

  const flights: FlightState[] = states
    .filter((s: any) => s[5] !== null && s[6] !== null) // must have lat/lng
    .map((s: any) => ({
      icao24: s[0],
      callsign: (s[1] || '').trim(),
      originCountry: s[2],
      lat: s[6],
      lng: s[5],
      altitude: s[7] ?? s[13], // baro or geo altitude
      velocity: s[9],
      heading: s[10],
      onGround: s[8],
      squawk: s[14],
    }));

  flightCache = { data: flights, ts: now };
  return flights;
}

// Aviation & critical news RSS feeds
const AVIATION_FEEDS = [
  'https://www.avherald.com/rss.php',
  'https://feeds.feedburner.com/flyingmag',
  'https://simpleflying.com/feed/',
];

const CRITICAL_NEWS_FEEDS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://feeds.reuters.com/reuters/topNews',
  'https://www.aljazeera.com/xml/rss/all.xml',
];

async function fetchRssItems(feedUrl: string, category: string): Promise<NewsItem[]> {
  try {
    const resp = await fetch(feedUrl, {
      headers: { 'User-Agent': 'TradeMonitor/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const text = await resp.text();
    const items: NewsItem[] = [];

    // Simple XML extraction
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < 10) {
      const block = match[1];
      const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1] || '';
      const link = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)?.[1] || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const source = new URL(feedUrl).hostname.replace('www.', '').replace('feeds.', '');
      if (title) {
        items.push({ title: title.trim(), url: link.trim(), source, pubDate, category });
      }
    }
    return items;
  } catch {
    return [];
  }
}

// Critical keywords that mark news as mission-critical
const CRITICAL_KEYWORDS = [
  'breaking',
  'attack',
  'crash',
  'emergency',
  'war',
  'missile',
  'earthquake',
  'tsunami',
  'explosion',
  'nuclear',
  'sanctions',
  'assassination',
  'coup',
  'martial law',
  'evacuation',
  'collapse',
  'shutdown',
  'grounded',
  'crisis',
  'pandemic',
  'terror',
  'hijack',
  'FAA',
  'airspace closed',
];

function isCritical(title: string): boolean {
  const lower = title.toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => lower.includes(kw));
}

export async function handleFlightsRequest(
  query: Record<string, string>,
  _body: string,
  _headers: Record<string, string | string[] | undefined>
): Promise<unknown> {
  const action = query.action || 'live';

  if (action === 'live') {
    const lamin = query.lamin ? parseFloat(query.lamin) : undefined;
    const lomin = query.lomin ? parseFloat(query.lomin) : undefined;
    const lamax = query.lamax ? parseFloat(query.lamax) : undefined;
    const lomax = query.lomax ? parseFloat(query.lomax) : undefined;

    const flights = await fetchOpenSkyFlights(lamin, lomin, lamax, lomax);

    // Sample down for display — send max 200 flights
    const sampled =
      flights.length > 200
        ? flights.filter((_, i) => i % Math.ceil(flights.length / 200) === 0)
        : flights;

    return {
      flights: sampled,
      total: flights.length,
      timestamp: Date.now(),
      source: 'OpenSky Network',
    } as FlightsResponse & { total: number };
  }

  if (action === 'search') {
    const callsign = (query.callsign || '').toUpperCase();
    if (!callsign) return { flights: [], timestamp: Date.now(), source: 'OpenSky Network' };

    const flights = await fetchOpenSkyFlights();
    const matched = flights.filter(
      f => f.callsign.includes(callsign) || f.icao24.toUpperCase().includes(callsign)
    );
    return { flights: matched.slice(0, 50), timestamp: Date.now(), source: 'OpenSky Network' };
  }

  if (action === 'news') {
    const allFeeds = [
      ...AVIATION_FEEDS.map(url => fetchRssItems(url, 'aviation')),
      ...CRITICAL_NEWS_FEEDS.map(url => fetchRssItems(url, 'world')),
    ];
    const results = await Promise.allSettled(allFeeds);
    const articles: (NewsItem & { critical: boolean })[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const item of r.value) {
          articles.push({ ...item, critical: isCritical(item.title) });
        }
      }
    }

    // Sort: critical first, then by date
    articles.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    return { articles: articles.slice(0, 40), timestamp: Date.now() };
  }

  return { error: 'Unknown action. Use: live, search, news' };
}
