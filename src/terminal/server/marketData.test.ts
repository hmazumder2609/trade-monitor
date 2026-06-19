import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregatePricePoints,
  buildQuoteFromSnapshot,
  extractArticleContent,
  filterNewsItems,
  parseNewsFeed,
  parseStooqCurrent,
  parseStooqHistory,
  parseYahooChart,
} from "./marketData";

test("aggregatePricePoints resamples five-minute points into fifteen-minute OHLCV bars", () => {
  const bars = aggregatePricePoints(
    [
      { timestamp: Date.parse("2026-03-17T14:00:00.000Z"), price: 100, volume: 10 },
      { timestamp: Date.parse("2026-03-17T14:05:00.000Z"), price: 105, volume: 12 },
      { timestamp: Date.parse("2026-03-17T14:10:00.000Z"), price: 103, volume: 11 },
      { timestamp: Date.parse("2026-03-17T14:15:00.000Z"), price: 108, volume: 20 },
    ],
    "15m",
  );

  assert.deepEqual(bars, [
    { date: "2026-03-17T14:00:00.000Z", open: 100, high: 105, low: 100, close: 103, volume: 33 },
    { date: "2026-03-17T14:15:00.000Z", open: 108, high: 108, low: 108, close: 108, volume: 20 },
  ]);
});

test("parseStooqCurrent parses current quote csv rows", () => {
  const current = parseStooqCurrent("AAPL.US,20260316,210017,252.105,253.885,249.88,252.82,32074210,");

  assert.deepEqual(current, {
    open: 252.105,
    high: 253.885,
    low: 249.88,
    close: 252.82,
    volume: 32074210,
    date: "2026-03-16",
    time: "21:00:17",
  });
});

test("parseStooqCurrent treats N/D volume as zero", () => {
  const current = parseStooqCurrent("^SPX,20260316,230000,6674.37,6729.79,6674.37,6699.38,N/D,");

  assert.equal(current.volume, 0);
});

test("parseStooqCurrent rejects non-csv payloads", () => {
  assert.throws(() => parseStooqCurrent("</html>"), /No current quote data|Malformed current quote row/);
});

test("parseStooqHistory returns ordered OHLCV bars", () => {
  const bars = parseStooqHistory([
    "Date,Open,High,Low,Close,Volume",
    "2026-03-13,241.25,244.91,240.10,242.84,51000000",
    "2026-03-14,243.10,246.12,242.90,245.18,49800000",
  ].join("\n"));

  assert.deepEqual(bars, [
    { date: "2026-03-13", open: 241.25, high: 244.91, low: 240.1, close: 242.84, volume: 51000000 },
    { date: "2026-03-14", open: 243.1, high: 246.12, low: 242.9, close: 245.18, volume: 49800000 },
  ]);
});

test("parseStooqHistory normalizes unavailable volume to zero", () => {
  const bars = parseStooqHistory([
    "Date,Open,High,Low,Close,Volume",
    "2026-03-13,17.24,17.24,17.24,17.24,N/D",
  ].join("\n"));

  assert.deepEqual(bars, [
    { date: "2026-03-13", open: 17.24, high: 17.24, low: 17.24, close: 17.24, volume: 0 },
  ]);
});

test("parseYahooChart returns ordered OHLCV bars and skips null closes", () => {
  const bars = parseYahooChart({
    chart: {
      result: [{
        timestamp: [1773667740, 1773667800, 1773667860],
        indicators: {
          quote: [{
            open: [252.77, 252.82, 252.81],
            high: [252.87, 252.97, 252.83],
            low: [252.72, 252.78, 252.8],
            close: [252.82, 252.78, null],
            volume: [170602, 470009, 10],
          }],
        },
      }],
      error: null,
    },
  }, "1m");

  assert.deepEqual(bars, [
    { date: "2026-03-16T13:29:00.000Z", open: 252.77, high: 252.87, low: 252.72, close: 252.82, volume: 170602 },
    { date: "2026-03-16T13:30:00.000Z", open: 252.82, high: 252.97, low: 252.78, close: 252.78, volume: 470009 },
  ]);
});

test("parseYahooChart deduplicates repeated daily timestamps for the same session", () => {
  const bars = parseYahooChart({
    chart: {
      result: [{
        timestamp: [1773667800, 1773691203],
        indicators: {
          quote: [{
            open: [252.11, 252.1],
            high: [253.89, 253.88],
            low: [249.88, 249.88],
            close: [252.82, 252.82],
            volume: [32060100, 30091880],
          }],
        },
      }],
      error: null,
    },
  }, "1d");

  assert.deepEqual(bars, [
    { date: "2026-03-16", open: 252.1, high: 253.89, low: 249.88, close: 252.82, volume: 30091880 },
  ]);
});

test("buildQuoteFromSnapshot derives previous close, ranges, and reference fundamentals", () => {
  const quote = buildQuoteFromSnapshot({
    symbol: "AAPL",
    provider: "Yahoo Finance",
    profile: {
      name: "Apple Inc.",
      exchange: "NASDAQ",
      sector: "Technology",
      marketCap: 3_400_000_000_000,
      referencePrice: 242,
      eps: 6.5,
    },
    current: {
      open: 252.105,
      high: 253.885,
      low: 249.88,
      close: 252.82,
      volume: 32074210,
      date: "2026-03-16",
      time: "21:00:17",
    },
    history: [
      { date: "2026-03-13", open: 241.25, high: 244.91, low: 240.1, close: 242.84, volume: 51000000 },
      { date: "2026-03-14", open: 243.1, high: 246.12, low: 242.9, close: 245.18, volume: 49800000 },
      { date: "2026-03-16", open: 252.11, high: 253.89, low: 249.88, close: 252.82, volume: 32074210 },
    ],
  });

  assert.equal(quote.symbol, "AAPL");
  assert.equal(quote.name, "Apple Inc.");
  assert.equal(quote.exchange, "NASDAQ");
  assert.equal(quote.sector, "Technology");
  assert.equal(quote.previousClose, 245.18);
  assert.equal(quote.change, 7.64);
  assert.equal(quote.changePercent, 3.12);
  assert.equal(quote.dayHigh, 253.885);
  assert.equal(quote.dayLow, 249.88);
  assert.equal(quote.avgVolume, 44291403);
  assert.equal(quote.high52, 253.89);
  assert.equal(quote.low52, 240.1);
  assert.equal(quote.eps, 6.5);
  assert.equal(quote.pe, 38.9);
  assert.equal(quote.marketCap, 3552016528925.62);
  assert.equal(quote.quoteSource, "Yahoo Finance");
  assert.equal(quote.isLive, true);
  assert.deepEqual(quote.status, {
    provider: "Yahoo Finance",
    freshness: "current",
    asOf: "2026-03-16T21:00:17.000Z",
    delayLabel: "Current session",
    isFallback: false,
  });
});

test("parseNewsFeed normalizes rss items and infers sentiment", () => {
  const items = parseNewsFeed(`<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Apple jumps after earnings beat - Reuters</title>
          <description>Shares rally as revenue tops expectations and guidance improves.</description>
          <link>https://example.com/apple</link>
          <pubDate>Mon, 17 Mar 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Oil falls as recession fears grow</title>
          <description>Demand concerns pressure crude lower in early trading.</description>
          <link>https://example.com/oil</link>
          <pubDate>Mon, 17 Mar 2026 09:00:00 GMT</pubDate>
          <source url="https://www.cnbc.com">CNBC</source>
        </item>
      </channel>
    </rss>`, "Google News");

  assert.deepEqual(items, [
    {
      title: "Apple jumps after earnings beat",
      summary: "Shares rally as revenue tops expectations and guidance improves.",
      url: "https://example.com/apple",
      source: "Reuters",
      feedProvider: "Google News",
      publishedAt: "2026-03-17T10:00:00.000Z",
      sentiment: "positive",
      status: {
        provider: "Google News",
        freshness: "feed",
        asOf: "2026-03-17T10:00:00.000Z",
        delayLabel: "Feed-based publication metadata",
        isFallback: false,
      },
    },
    {
      title: "Oil falls as recession fears grow",
      summary: "Demand concerns pressure crude lower in early trading.",
      url: "https://example.com/oil",
      source: "CNBC",
      feedProvider: "Google News",
      publishedAt: "2026-03-17T09:00:00.000Z",
      sentiment: "negative",
      status: {
        provider: "Google News",
        freshness: "feed",
        asOf: "2026-03-17T09:00:00.000Z",
        delayLabel: "Feed-based publication metadata",
        isFallback: false,
      },
    },
  ]);
});

test("parseNewsFeed tags feed-based items with transport metadata", () => {
  const [item] = parseNewsFeed(`<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Apple supplier expands production - Reuters</title>
          <description>Production capacity rises ahead of the new launch cycle.</description>
          <link>https://example.com/apple-supplier</link>
          <pubDate>Mon, 17 Mar 2026 10:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`, "Google News");

  assert.equal(item.feedProvider, "Google News");
  assert.deepEqual(item.status, {
    provider: "Google News",
    freshness: "feed",
    asOf: "2026-03-17T10:00:00.000Z",
    delayLabel: "Feed-based publication metadata",
    isFallback: false,
  });
});


test("filterNewsItems matches query across title summary and source", () => {
  const items = [
    {
      title: "Apple launches enterprise AI push",
      summary: "New tooling targets large business deployments.",
      url: "https://example.com/apple-ai",
      source: "CNBC",
      publishedAt: "2026-03-17T10:00:00.000Z",
      sentiment: "positive" as const,
    },
    {
      title: "Oil slides after inventory build",
      summary: "Crude weakens as supply fears ease.",
      url: "https://example.com/oil",
      source: "Reuters",
      publishedAt: "2026-03-17T09:00:00.000Z",
      sentiment: "negative" as const,
    },
  ];

  assert.deepEqual(filterNewsItems(items, "enterprise"), [items[0]]);
  assert.deepEqual(filterNewsItems(items, "reuters"), [items[1]]);
  assert.deepEqual(filterNewsItems(items, "crude"), [items[1]]);
});

test("extractArticleContent prefers article paragraphs and strips boilerplate", () => {
  const article = extractArticleContent(`<!doctype html>
    <html>
      <head>
        <title>Example</title>
        <style>.hidden{display:none}</style>
      </head>
      <body>
        <header>Site Header</header>
        <article>
          <h1>Apple expands terminal workflow</h1>
          <p>Apple shares rose after the company detailed its new enterprise roadmap.</p>
          <p>The update includes newsroom search, article read-through, and terminal pane workflows.</p>
        </article>
        <footer>Footer boilerplate</footer>
      </body>
    </html>`);

  assert.deepEqual(article, [
    "Apple expands terminal workflow",
    "Apple shares rose after the company detailed its new enterprise roadmap.",
    "The update includes newsroom search, article read-through, and terminal pane workflows.",
  ]);
});