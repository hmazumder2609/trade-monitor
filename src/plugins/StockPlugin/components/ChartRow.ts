/**
 * ChartRow — a single symbol row with expandable chart.
 *
 * Collapsed: shows symbol, name, price, change, sparkline, sentiment, portfolio badge.
 * Expanded: shows full candlestick chart with indicators, fundamentals bar.
 *
 * Uses Lightweight Charts v5 for rendering.
 */

import {
  fetchCandles,
  dataLayer,
  type StockQuote,
  type Candle,
  type Timeframe,
} from '@/services/data-layer';
import { getStockSettings } from '../settings';
import { FundamentalsBar } from './FundamentalsBar';
import { SentimentBadge } from './SentimentBadge';
import { PortfolioBadge } from './PortfolioBadge';
import { formatPrice, formatChange, getChangeClass, miniSparkline } from '@/utils';

const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1H', '1D', '1W', '1M'];

export class ChartRow {
  private el: HTMLElement;
  private quote: StockQuote;
  private expanded = false;
  private timeframe: Timeframe;
  private chart: any = null;
  private candleSeries: any = null;
  private volumeSeries: any = null;
  private ma20Series: any = null;
  private ma50Series: any = null;
  private ma200Series: any = null;
  private rsiChart: any = null;
  private rsiSeries: any = null;

  private fundamentalsBar: FundamentalsBar;
  private sentimentBadge: SentimentBadge;
  private portfolioBadge: PortfolioBadge;

  private chartContainer: HTMLElement;
  private rsiContainer: HTMLElement;
  private expandContainer: HTMLElement;

  constructor(quote: StockQuote) {
    const settings = getStockSettings();
    this.quote = quote;
    this.timeframe = settings.defaultTimeframe;

    this.fundamentalsBar = new FundamentalsBar(quote.symbol);
    this.sentimentBadge = new SentimentBadge(quote.symbol);
    this.portfolioBadge = new PortfolioBadge(quote.symbol);

    this.el = document.createElement('div');
    this.el.className = 'stock-chart-row';
    this.el.dataset.symbol = quote.symbol;

    // Collapsed row
    const row = document.createElement('div');
    row.className = 'stock-row';
    row.innerHTML = this.renderCollapsed();
    this.el.appendChild(row);

    // Expandable container
    this.expandContainer = document.createElement('div');
    this.expandContainer.className = 'stock-expand-container';
    this.expandContainer.style.display = 'none';

    // Timeframe selector
    const tfBar = document.createElement('div');
    tfBar.className = 'stock-timeframe-bar';
    tfBar.innerHTML = TIMEFRAMES.map(
      tf =>
        `<button class="stock-tf-btn ${tf === this.timeframe ? 'active' : ''}" data-tf="${tf}">${tf}</button>`
    ).join('');
    this.expandContainer.appendChild(tfBar);

    // Chart container
    this.chartContainer = document.createElement('div');
    this.chartContainer.className = 'stock-chart';
    this.expandContainer.appendChild(this.chartContainer);

    // RSI container
    this.rsiContainer = document.createElement('div');
    this.rsiContainer.className = 'stock-rsi';
    this.expandContainer.appendChild(this.rsiContainer);

    // Fundamentals bar
    this.expandContainer.appendChild(this.fundamentalsBar.getElement());

    // Sentiment + Portfolio badges
    const badgesRow = document.createElement('div');
    badgesRow.className = 'stock-badges-row';
    badgesRow.appendChild(this.sentimentBadge.getElement());
    badgesRow.appendChild(this.portfolioBadge.getElement());
    this.expandContainer.appendChild(badgesRow);

    this.el.appendChild(this.expandContainer);

    // Event listeners
    row.addEventListener('click', () => this.toggle());
    tfBar.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('.stock-tf-btn') as HTMLButtonElement;
      if (!btn) return;
      this.timeframe = btn.dataset.tf as Timeframe;
      tfBar.querySelectorAll('.stock-tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (this.expanded) this.loadChart();
    });

    // Listen for symbol selection from other panels
    dataLayer.onSymbolChange(symbol => {
      if (symbol === this.quote.symbol) {
        this.el.classList.add('stock-row-highlighted');
      } else {
        this.el.classList.remove('stock-row-highlighted');
      }
    });
  }

  getElement(): HTMLElement {
    return this.el;
  }

  updateQuote(quote: StockQuote): void {
    this.quote = quote;
    const row = this.el.querySelector('.stock-row');
    if (row) row.innerHTML = this.renderCollapsed();
    this.portfolioBadge.load();
  }

  // ──────────────────────────────────────────────
  //  Expand / Collapse
  // ──────────────────────────────────────────────

  private toggle(): void {
    this.expanded ? this.collapse() : this.expand();
  }

  private expand(): void {
    this.expanded = true;
    this.expandContainer.style.display = '';
    this.el.classList.add('stock-chart-row-expanded');
    this.loadChart();
    this.fundamentalsBar.load();
    this.sentimentBadge.load();
    this.portfolioBadge.load();

    // Broadcast symbol selection
    dataLayer.selectSymbol(this.quote.symbol);
  }

  private collapse(): void {
    this.expanded = false;
    this.expandContainer.style.display = 'none';
    this.el.classList.remove('stock-chart-row-expanded');
    this.destroyChart();
  }

  // ──────────────────────────────────────────────
  //  Chart rendering
  // ──────────────────────────────────────────────

  private async loadChart(): Promise<void> {
    this.destroyChart();

    const candles = await fetchCandles(this.quote.symbol, this.timeframe);
    if (!this.expanded || candles.length === 0) return;

    await this.renderChart(candles);
    await this.renderRSI(candles);
  }

  private async renderChart(candles: Candle[]): Promise<void> {
    const {
      createChart,
      CrosshairMode,
      ColorType,
      CandlestickSeries,
      LineSeries,
      AreaSeries,
      HistogramSeries,
    } = await import('lightweight-charts');

    const settings = getStockSettings();
    const isDark = document.documentElement.dataset.theme === 'dark';

    this.chart = createChart(this.chartContainer, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a0a0a0' : '#666666',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: ['5m', '15m', '1H', '4H'].includes(this.timeframe),
        secondsVisible: false,
      },
      width: this.chartContainer.clientWidth,
      height: 240,
    });

    // Price series
    if (settings.chartType === 'candlestick') {
      this.candleSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      this.candleSeries.setData(candles as any);
    } else if (settings.chartType === 'area') {
      this.candleSeries = this.chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59,130,246,0.3)',
        bottomColor: 'rgba(59,130,246,0.05)',
      });
      this.candleSeries.setData(candles.map(c => ({ time: c.time, value: c.close })) as any);
    } else {
      this.candleSeries = this.chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      });
      this.candleSeries.setData(candles.map(c => ({ time: c.time, value: c.close })) as any);
    }

    // Volume
    if (settings.indicators.volume) {
      this.volumeSeries = this.chart.addSeries(HistogramSeries, {
        color: '#3b82f6',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      this.chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      this.volumeSeries.setData(
        candles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        })) as any
      );
    }

    // Moving averages
    if (settings.indicators.sma20) {
      this.ma20Series = this.chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      this.ma20Series.setData(this.computeSMA(candles, 20) as any);
    }
    if (settings.indicators.sma50) {
      this.ma50Series = this.chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      this.ma50Series.setData(this.computeSMA(candles, 50) as any);
    }
    if (settings.indicators.sma200) {
      this.ma200Series = this.chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      this.ma200Series.setData(this.computeSMA(candles, 200) as any);
    }

    this.chart.timeScale().fitContent();
  }

  private async renderRSI(candles: Candle[]): Promise<void> {
    const settings = getStockSettings();
    if (!settings.indicators.rsi) return;

    const { createChart, ColorType, LineSeries } = await import('lightweight-charts');
    const isDark = document.documentElement.dataset.theme === 'dark';

    this.rsiChart = createChart(this.rsiContainer, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a0a0a0' : '#666666',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
      },
      width: this.rsiContainer.clientWidth,
      height: 60,
      timeScale: { visible: false },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
    });

    this.rsiSeries = this.rsiChart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
    });

    const rsiData = this.computeRSI(candles, 14);
    this.rsiSeries.setData(rsiData as any);
    this.rsiChart.timeScale().fitContent();
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
    if (this.rsiChart) {
      this.rsiChart.remove();
      this.rsiChart = null;
    }
    this.candleSeries = null;
    this.volumeSeries = null;
    this.ma20Series = null;
    this.ma50Series = null;
    this.ma200Series = null;
    this.rsiSeries = null;
  }

  // ──────────────────────────────────────────────
  //  Technical indicator calculations
  // ──────────────────────────────────────────────

  private computeSMA(candles: Candle[], period: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      result.push({ time: candles[i].time, value: sum / period });
    }
    return result;
  }

  private computeRSI(candles: Candle[], period: number): { time: number; value: number }[] {
    if (candles.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const delta = candles[i].close - candles[i - 1].close;
      gains.push(delta > 0 ? delta : 0);
      losses.push(delta < 0 ? -delta : 0);
    }

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    const result: { time: number; value: number }[] = [];
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: candles[period].time, value: 100 - 100 / (1 + rs) });

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push({ time: candles[i + 1].time, value: 100 - 100 / (1 + rs2) });
    }

    return result;
  }

  // ──────────────────────────────────────────────
  //  Rendering helpers
  // ──────────────────────────────────────────────

  private renderCollapsed(): string {
    const q = this.quote;
    const changeClass = getChangeClass(q.changePercent);
    const spark = miniSparkline(q.sparkline, q.changePercent);
    const settings = getStockSettings();

    return `
      <span class="stock-symbol">${q.symbol.replace('-USD', '').replace('=F', '')}</span>
      <span class="stock-name">${q.name}</span>
      <span class="stock-price num">${q.price != null ? formatPrice(q.price) : '—'}</span>
      <span class="stock-change num ${changeClass}">${settings.showChangePercent ? formatChange(q.changePercent) : ''}</span>
      ${settings.showSparklines ? `<span class="stock-sparkline">${spark}</span>` : ''}
      <button class="stock-expand-btn" title="Expand chart">▸</button>
    `;
  }
}
