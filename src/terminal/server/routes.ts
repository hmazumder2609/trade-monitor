import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertWatchlistItemSchema, insertAlertSchema } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { evaluateAlerts } from "./alertsEngine";
import {
  getEconomicsSnapshot,
  getIndexSparklines,
  getMarketMovers,
  getMarketSentiment,
  getNews,
  getNewsArticle,
  getOHLCV,
  getOHLCVSeries,
  getPeers,
  getQuotes,
  getScreenerResults,
} from "./marketData";
import { getEconomicCalendar, getEconomicEventDetail } from "./economicsData";
import { calculatePortfolioAnalytics } from "./portfolioAnalytics";

const anthropic = new Anthropic();

function parseSymbols(value: unknown) {
  return String(value || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

const portfolioAnalyticsRequestSchema = z.object({
  positions: z.array(z.object({
    symbol: z.string().trim().min(1),
    shares: z.number().positive(),
    avgCost: z.number().positive(),
  })).min(1),
});

// ─── Route Registration ─────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  const handleFinance = <T>(loader: (req: any) => Promise<T>) => {
    return async (req: any, res: any) => {
      try {
        res.json(await loader(req));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown finance data error";
        res.status(502).json({ error: detail });
      }
    };
  };

  // ─── Finance proxy routes ─────────────────────────────────────────────────
  app.get("/api/finance/sparklines", handleFinance(async () => getIndexSparklines()));

  app.get("/api/finance/tick", handleFinance(async (req) => {
    const symbols = parseSymbols(req.query.symbols);
    if (!symbols.length) return [];
    const quotes = await getQuotes(symbols);
    return quotes.map(({ symbol, price, change, changePercent, quoteSource, isLive, status }) => ({
      symbol,
      price,
      change,
      changePercent,
      quoteSource,
      isLive,
      status,
    }));
  }));

  app.get("/api/finance/quotes", handleFinance(async (req) => {
    const symbols = parseSymbols(req.query.symbols);
    if (!symbols.length) return [];
    return getQuotes(symbols);
  }));

  app.get("/api/finance/ohlcv", handleFinance(async (req) => {
    const symbol = String(req.query.symbol || "AAPL").toUpperCase();
    const range = String(req.query.range || "1Y");
    const interval = String(req.query.interval || "1d") as "5m" | "15m" | "1h" | "1d";
    return getOHLCVSeries(symbol, range, interval);
  }));

  app.get("/api/finance/gainers", handleFinance(async () => getMarketMovers("gainers")));
  app.get("/api/finance/losers", handleFinance(async () => getMarketMovers("losers")));
  app.get("/api/finance/active", handleFinance(async () => getMarketMovers("active")));
  app.get("/api/finance/sentiment", handleFinance(async () => getMarketSentiment()));

  app.get("/api/finance/news", handleFinance(async (req) => {
    const symbol = typeof req.query.symbol === "string" ? req.query.symbol.toUpperCase() : undefined;
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    return getNews(symbol, query);
  }));

  app.get("/api/finance/news/read", handleFinance(async (req) => {
    const url = String(req.query.url || "");
    const title = String(req.query.title || "Untitled article");
    const source = String(req.query.source || "Unknown source");
    const publishedAt = String(req.query.publishedAt || new Date(0).toISOString());
    const summary = typeof req.query.summary === "string" ? req.query.summary : undefined;
    const feedProvider = typeof req.query.feedProvider === "string" ? req.query.feedProvider : undefined;

    return getNewsArticle({
      url,
      title,
      source,
      feedProvider,
      publishedAt,
      summary,
    });
  }));

  app.get("/api/finance/economics", handleFinance(async () => getEconomicsSnapshot()));
  app.get("/api/finance/economics/calendar", handleFinance(async () => getEconomicCalendar()));

  app.get("/api/finance/economics/events/:releaseId", async (req, res) => {
    const releaseId = Number(req.params.releaseId);
    if (!Number.isInteger(releaseId) || releaseId <= 0) {
      return res.status(400).json({ error: "Invalid releaseId" });
    }
    try {
      res.json(await getEconomicEventDetail(releaseId));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown economics event error";
      res.status(502).json({ error: detail });
    }
  });

  app.get("/api/finance/peers", handleFinance(async (req) => {
    const symbol = String(req.query.symbol || "AAPL").toUpperCase();
    return getPeers(symbol);
  }));

  app.get("/api/finance/screener", handleFinance(async (req) => {
    return getScreenerResults({
      sector: typeof req.query.sector === "string" ? req.query.sector : undefined,
      minPe: typeof req.query.minPe === "string" ? req.query.minPe : undefined,
      maxPe: typeof req.query.maxPe === "string" ? req.query.maxPe : undefined,
    });
  }));

  app.post("/api/finance/portfolio-analytics", async (req, res) => {
    const parsed = portfolioAnalyticsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const positions = parsed.data.positions.map((position) => ({
        symbol: position.symbol.toUpperCase(),
        shares: position.shares,
        avgCost: position.avgCost,
      }));
      const symbols: string[] = Array.from(new Set(positions.map((position) => position.symbol)));
      const historyEntries = await Promise.all(symbols.map(async (symbol) => ([
        symbol,
        (await getOHLCV(symbol, "1Y", "1d")).map((point) => ({ date: point.date, close: point.close })),
      ] as const)));
      const benchmark = (await getOHLCV("SPY", "1Y", "1d")).map((point) => ({ date: point.date, close: point.close }));

      res.json(calculatePortfolioAnalytics({
        positions,
        histories: Object.fromEntries(historyEntries),
        benchmark,
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown portfolio analytics error";
      res.status(502).json({ error: detail });
    }
  });

  // ─── Watchlist ─────────────────────────────────────────────────────────────
  // ─── Watchlist ─────────────────────────────────────────────────────────────
  app.get("/api/watchlist", async (_req, res) => {
    const items = await storage.getWatchlist();
    res.json(items);
  });

  app.post("/api/watchlist", async (req, res) => {
    const parsed = insertWatchlistItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const item = await storage.addWatchlistItem(parsed.data);
    res.json(item);
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    await storage.removeWatchlistItem(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── Alerts ────────────────────────────────────────────────────────────────
  app.get("/api/alerts", async (_req, res) => {
    const items = await storage.getAlerts();
    items.sort((a, b) => {
      if (a.triggered !== b.triggered) return Number(a.triggered) - Number(b.triggered);
      const left = a.triggeredAt ?? a.createdAt;
      const right = b.triggeredAt ?? b.createdAt;
      return +new Date(right) - +new Date(left);
    });
    res.json(items);
  });

  app.post("/api/alerts", async (req, res) => {
    const parsed = insertAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const alert = await storage.addAlert(parsed.data);
    res.json(alert);
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    await storage.deleteAlert(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── Chat (AI Agent) ───────────────────────────────────────────────────────
  app.get("/api/chat", async (_req, res) => {
    const msgs = await storage.getChatMessages();
    res.json(msgs);
  });

  app.post("/api/chat", async (req, res) => {
    const { message } = req.body as { message: string };
    if (!message?.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    await storage.addChatMessage({ role: "user", content: message });
    const history = await storage.getChatMessages();
    const claudeMessages = history
      .slice(-20)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullContent = "";

    try {
      const stream = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `You are BLMTRM AI, an autonomous financial intelligence agent embedded in a hacker Bloomberg Terminal clone built in 2026. You have deep expertise in:
- Equity markets, fixed income, commodities, FX, crypto  
- Technical analysis: RSI, MACD, Bollinger Bands, moving averages, support/resistance levels
- Fundamental analysis: P/E, EV/EBITDA, DCF valuation, earnings quality, margin analysis
- Macro economics: Fed policy, yield curves, inflation dynamics, GDP, labor markets
- Market microstructure, order flow, liquidity, options flows

Respond like a seasoned Goldman/Citadel analyst — precise, direct, data-oriented. Use terminal-style formatting with tables and bullets. Format numbers properly: $1.2B, 4.5%, 120bps. Be concise and actionable. Current date: March 2026.`,
        messages: claudeMessages,
      });

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          fullContent += chunk.delta.text;
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      await storage.addChatMessage({ role: "assistant", content: fullContent });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const msg = "AI agent temporarily unavailable. Please try again.";
      await storage.addChatMessage({ role: "assistant", content: msg });
      res.write(`data: ${JSON.stringify({ text: msg, done: true })}\n\n`);
    }

    res.end();
  });

  app.delete("/api/chat", async (_req, res) => {
    await storage.clearChatMessages();
    res.json({ ok: true });
  });
}
