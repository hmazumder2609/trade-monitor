import { Panel } from '@/components/Panel';
import { escapeHtml } from '@/utils';
import { getSecret, setSecret, subscribeSettingsChange } from '@/services/settings-store';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

type MarketPhase = 'pre-market' | 'market-open' | 'post-market' | 'after-hours';

function getMarketPhase(): MarketPhase {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = etFormatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? now.getDay();

  const time = hour * 60 + minute;

  if (day === 0 || day === 6) return 'after-hours';
  if (time < 570) return 'pre-market';
  if (time < 960) return 'market-open';
  if (time < 1080) return 'post-market';
  return 'after-hours';
}

const PHASE_LABELS: Record<MarketPhase, string> = {
  'pre-market': 'Pre-Market Briefing',
  'market-open': 'Market Hours',
  'post-market': 'Post-Market Recap',
  'after-hours': 'After Hours',
};

const PHASE_CONTEXT: Record<MarketPhase, string> = {
  'pre-market':
    "It is pre-market. Focus on: overnight news, today's macro calendar, pre-market movers, key levels to watch.",
  'market-open': 'Market is open. Focus on: real-time alerts, breaking news, position updates.',
  'post-market':
    "Market just closed. Focus on: daily P&L recap, notable trades, tomorrow's outlook.",
  'after-hours': 'After hours. Focus on: overnight developments, preparation for tomorrow.',
};

interface AgentMessage {
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolName?: string;
}

type TaskStatus = 'pending' | 'done' | 'failed';
interface AgentTask {
  id: string;
  title: string;
  content: string;
  status: TaskStatus;
  createdAt: string;
}

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-opus-4.6-free';
const HISTORY_KEY = 'mdm-agent-history';
const TASKS_KEY = 'mdm-agent-tasks';
const SETTINGS_KEY = 'mdm-insights-settings';
const MAX_HISTORY = 20;

interface InsightsSettings {
  model: string;
  scope: 'watchlist' | 'all-symbols' | 'custom';
  includeNews: boolean;
}

const DEFAULT_SETTINGS: InsightsSettings = {
  model: 'openrouter/auto',
  scope: 'watchlist',
  includeNews: true,
};

function loadSettings(): InsightsSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: InsightsSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const QUICK_ACTIONS = [
  {
    label: '📊 Daily Briefing',
    prompt:
      'Give me a full daily briefing covering weather, schedule, news highlights, stock market, and anything urgent.',
  },
  { label: '🌤 Weather', prompt: "What's the weather like today and the next few days?" },
  {
    label: '📈 Stock Analysis',
    prompt: 'Analyze my stock watchlist — biggest movers, trends, risks.',
  },
  {
    label: '🌍 News Summary',
    prompt: 'Summarize the top news stories and trending tech community posts.',
  },
  {
    label: '🖥 System Check',
    prompt: 'Check my running processes, terminal sessions, server health, and system CPU/memory.',
  },
  {
    label: '🔍 Options Flow Scan',
    prompt:
      'Scan for unusual options activity — put/call ratio, block trades, and unusual volume spikes.',
  },
  {
    label: '🏛 Macro Regime',
    prompt:
      'Analyze the current macro regime — economic indicators, yield curve, central bank policy.',
  },
  {
    label: '✅ Habit Check',
    prompt:
      'Check my habits today — which ones I have logged, my mental check-in status, and recent health metrics.',
  },
  { label: '📋 View Tasks', prompt: '/tasks' },
];

const SYSTEM_PROMPT = `You are an AI coworker agent inside a personal monitoring dashboard. You have access to REAL data from the user's dashboard provided as context.

CAPABILITIES:
- Answer questions using real dashboard data (weather, stocks, news, schedule, processes, servers, etc.)
- Execute Python code on the server to CREATE FILES (PPT, reports, data analysis)
- Search the web via news feeds for current events
- Monitor system status (CPU, memory, processes, terminals)

TASK EXECUTION:
When the user asks you to create something (PPT, report, document, analysis), you MUST generate executable Python code.
Wrap your code in a \`\`\`python code block. The code will be executed on the server.

Available Python libraries: json, csv, os, datetime, math, statistics, collections.
For PPTs: use python-pptx (from pptx import Presentation).
For Excel: use openpyxl.
For PDFs: use reportlab or just write HTML.

The code should:
1. Create the file in /tmp/agent-output/
2. Print the output file path at the end

Example for PPT:
\`\`\`python
from pptx import Presentation
from pptx.util import Inches, Pt
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Title"
slide.placeholders[1].text = "Content"
prs.save("/tmp/agent-output/report.pptx")
print("/tmp/agent-output/report.pptx")
\`\`\`

RULES:
1. ONLY use data from the provided context — never make up numbers or facts
2. Be concise but actionable. Use bullet points and emoji for clarity.
3. Mark urgency: 🔴 critical, 🟡 important, 🟢 normal
4. When asked to CREATE something, always generate executable Python code
5. Reply in the SAME language the user uses
6. If data is missing, say so honestly
7. When the context says "not configured", tell the user what to set up in Settings`;

interface ToolDef {
  name: string;
  keywords: string[];
  fetch: () => Promise<string>;
}

async function fetchTool(url: string): Promise<any> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

const TOOLS: ToolDef[] = [
  {
    name: 'weather',
    keywords: [
      'weather',
      'temperature',
      'rain',
      'forecast',
      'wind',
      '天气',
      '温度',
      '下雨',
      '预报',
      'briefing',
      '简报',
    ],
    fetch: async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        }).catch(() => null);
        const lat = pos?.coords.latitude ?? 39.9;
        const lng = pos?.coords.longitude ?? 116.4;
        const resp = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4`
        );
        const data = (await resp.json()) as any;
        const c = data.current;
        const daily = data.daily;
        let result = `WEATHER (${lat.toFixed(1)}, ${lng.toFixed(1)}):\n`;
        result += `Now: ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m}km/h\n`;
        if (daily) {
          result +=
            'Forecast:\n' +
            daily.time
              .map(
                (d: string, i: number) =>
                  `- ${d}: ${daily.temperature_2m_min[i]}~${daily.temperature_2m_max[i]}°C`
              )
              .join('\n');
        }
        return result;
      } catch {
        return 'WEATHER: Unable to fetch (location access denied or API error)';
      }
    },
  },
  {
    name: 'news',
    keywords: [
      'news',
      'headline',
      'article',
      'world',
      'tech',
      'finance',
      'AI',
      '新闻',
      '头条',
      '资讯',
      'briefing',
      '简报',
      'summary',
      '总结',
    ],
    fetch: async () => {
      try {
        const { fetchNews } = await import('@/services/news');
        const news = await fetchNews();
        if (news.length === 0) return 'NEWS: No articles available';
        const critical = news.filter(n => n.threatLevel === 'critical' || n.threatLevel === 'high');
        return (
          `NEWS (${news.length} articles${critical.length > 0 ? `, 🔴 ${critical.length} critical` : ''}):\n` +
          news
            .slice(0, 12)
            .map(
              n =>
                `- [${n.source}] ${n.title}${n.threatLevel && n.threatLevel !== 'info' ? ` ⚠${n.threatLevel.toUpperCase()}` : ''}`
            )
            .join('\n')
        );
      } catch {
        return 'NEWS: Failed to fetch';
      }
    },
  },
  {
    name: 'stocks',
    keywords: [
      'stock',
      'market',
      'price',
      'share',
      'nasdaq',
      'sp500',
      '股',
      '股票',
      '市场',
      'portfolio',
      'briefing',
      '简报',
    ],
    fetch: async () => {
      try {
        const { fetchQuotes } = await import('@/services/data-layer');
        const stocks = await fetchQuotes();
        if (stocks.length === 0) return 'STOCKS: No watchlist configured (add in Settings)';
        return (
          'STOCKS:\n' +
          stocks
            .map(
              s =>
                `- ${s.symbol}${s.name ? ` (${s.name})` : ''}: $${s.price?.toFixed(2) || '?'} ${(s.changePercent ?? 0) >= 0 ? '📈' : '📉'} ${(s.changePercent ?? 0) >= 0 ? '+' : ''}${(s.changePercent ?? 0).toFixed(2)}%`
            )
            .join('\n')
        );
      } catch {
        return 'STOCKS: Failed to fetch';
      }
    },
  },
  {
    name: 'community',
    keywords: [
      'hn',
      'reddit',
      'hacker news',
      'community',
      'trending',
      'hot',
      '社区',
      '热帖',
      'briefing',
    ],
    fetch: async () => {
      try {
        const { fetchCommunityPosts } = await import('@/services/social');
        const posts = await fetchCommunityPosts('all');
        if (posts.length === 0) return 'COMMUNITY: No posts available';
        return (
          'TECH COMMUNITY:\n' +
          posts
            .slice(0, 10)
            .map(p => `- [${p.platform.toUpperCase()}] ${p.title} (${p.score}pts, ${p.comments}💬)`)
            .join('\n')
        );
      } catch {
        return 'COMMUNITY: Failed to fetch';
      }
    },
  },
  {
    name: 'schedule',
    keywords: [
      'schedule',
      'calendar',
      'meeting',
      'event',
      'today',
      '日程',
      '会议',
      '日历',
      'briefing',
      '简报',
    ],
    fetch: async () => {
      try {
        const { fetchCalendarResult } = await import('@/services/schedule');
        const result = await fetchCalendarResult();
        if (!result.configured)
          return 'SCHEDULE: Google Calendar not configured (enable in Settings → API Keys)';
        if (result.events.length === 0) return 'SCHEDULE: No events today';
        return (
          "TODAY'S SCHEDULE:\n" +
          result.events
            .map(
              e =>
                `- ${new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${e.title}${e.location ? ` @ ${e.location}` : ''}`
            )
            .join('\n')
        );
      } catch {
        return 'SCHEDULE: Failed to fetch';
      }
    },
  },
  {
    name: 'email',
    keywords: ['email', 'mail', 'inbox', 'unread', '邮件', '收件箱', 'briefing', '简报'],
    fetch: async () => {
      try {
        const { fetchEmailResult } = await import('@/services/email');
        const result = await fetchEmailResult();
        if (!result.configured)
          return 'EMAIL: Not configured (add Gmail/Outlook credentials in Settings)';
        const emails = result.emails;
        const unread = emails.filter(e => e.unread);
        return (
          `EMAIL (${unread.length} unread / ${emails.length} total):\n` +
          emails
            .slice(0, 8)
            .map(e => `- ${e.unread ? '🔵' : '⚪'} ${e.from}: ${e.subject}`)
            .join('\n')
        );
      } catch {
        return 'EMAIL: Failed to fetch';
      }
    },
  },
  {
    name: 'processes',
    keywords: [
      'process',
      'cpu',
      'memory',
      'running',
      'terminal',
      'system',
      'server',
      '进程',
      '终端',
      '系统',
      '服务器',
      'health',
    ],
    fetch: async () => {
      const parts: string[] = [];
      try {
        const { fetchSystemHealth } = await import('@/services/system-health');
        const health = await fetchSystemHealth();
        parts.push(
          `SYSTEM: CPU ${health.cpu.toFixed(1)}%, MEM ${health.memoryUsedPercent.toFixed(1)}%, uptime ${Math.floor(health.uptime / 3600)}h`
        );
      } catch {}
      try {
        const data = await fetchTool('/api/system?action=jobs');
        const jobs = data.jobs || [];
        if (jobs.length > 0) {
          parts.push(
            `PROCESSES (${jobs.length}):\n` +
              jobs
                .slice(0, 8)
                .map(
                  (j: any) =>
                    `- ${j.label}: CPU ${j.cpu.toFixed(1)}%, MEM ${j.mem.toFixed(1)}%, ${j.duration || j.elapsed}`
                )
                .join('\n')
          );
        }
      } catch {}
      try {
        const data = await fetchTool('/api/system?action=terminals&lines=3');
        const terms = data.terminals || [];
        const active = terms.filter((t: any) => t.isActive);
        if (terms.length > 0) {
          parts.push(
            `TERMINALS (${active.length} active / ${terms.length}):\n` +
              terms
                .slice(0, 6)
                .map(
                  (t: any) =>
                    `- #${t.termId} [${t.isActive ? 'ACTIVE' : 'IDLE'}] ${t.activeCommand || t.lastCommand || '(empty)'}`
                )
                .join('\n')
          );
        }
      } catch {}
      try {
        const probes = JSON.parse(localStorage.getItem('mdm-server-probes') || '[]') as string[];
        if (probes.length > 0) {
          const data = await fetchTool(`/api/system?action=probe&urls=${probes.join(',')}`);
          parts.push(
            'SERVERS:\n' +
              (data.probes || [])
                .map((r: any) => `- ${r.url}: ${r.ok ? `✅ UP (${r.latencyMs}ms)` : '❌ DOWN'}`)
                .join('\n')
          );
        }
      } catch {}
      return parts.join('\n\n') || 'SYSTEM: No data available';
    },
  },
  {
    name: 'github',
    keywords: ['github', 'repo', 'ci', 'build', 'deploy', 'workflow', 'code', '代码', '部署'],
    fetch: async () => {
      try {
        const { fetchCodeStatusResult } = await import('@/services/code-status');
        const result = await fetchCodeStatusResult();
        if (!result.configured) return 'GITHUB: Not configured (add GitHub PAT in Settings)';
        const runs = result.runs;
        if (runs.length === 0) return 'GITHUB: No recent workflow runs';
        return (
          'GITHUB CI/CD:\n' +
          runs
            .slice(0, 8)
            .map(
              r =>
                `- ${r.repo}: ${r.status === 'completed' ? (r.conclusion === 'success' ? '✅' : '❌') : '🔄'} ${r.name} (${r.conclusion || r.status})`
            )
            .join('\n')
        );
      } catch {
        return 'GITHUB: Failed to fetch';
      }
    },
  },
  {
    name: 'options-flow',
    keywords: [
      'options',
      'flow',
      'unusual',
      'calls',
      'puts',
      'strike',
      'premium',
      '期权',
      'flow scan',
    ],
    fetch: async () => {
      try {
        const { fetchOptionsSummary, fetchUnusualActivity } =
          await import('@/services/options-flow');
        const [summary, activity] = await Promise.all([
          fetchOptionsSummary(),
          fetchUnusualActivity().catch(() => []),
        ]);
        const parts: string[] = [];
        parts.push(
          `OPTIONS FLOW:\nPut/Call Ratio: ${summary.putCallRatio}\nTotal Volume: ${(summary.totalVolume / 1e6).toFixed(1)}M\nCalls: ${(summary.callVolume / 1e6).toFixed(1)}M | Puts: ${(summary.putVolume / 1e6).toFixed(1)}M`
        );
        if (activity.length > 0) {
          parts.push(
            `UNUSUAL ACTIVITY (${activity.length}):\n${activity
              .slice(0, 8)
              .map(
                a =>
                  `- ${a.symbol} ${a.optionType === 'call' ? '📈' : '📉'} $${a.strike} ${a.expiration} vol:${a.volume} OI:${a.openInterest} ratio:${a.vOiRatio}x ${a.sentiment}`
              )
              .join('\n')}`
          );
        }
        return parts.join('\n\n') || 'OPTIONS FLOW: No data available';
      } catch {
        return 'OPTIONS FLOW: Failed to fetch';
      }
    },
  },
  {
    name: 'onchain',
    keywords: [
      'whale',
      'crypto',
      'bitcoin',
      'ethereum',
      'onchain',
      'transaction',
      'blockchain',
      '链上',
      '加密货币',
    ],
    fetch: async () => {
      try {
        const { fetchOnChainTransactions } = await import('@/services/onchain');
        const result = await fetchOnChainTransactions();
        const txs = result.transactions || [];
        if (txs.length === 0) return 'ONCHAIN: No recent whale transactions';
        return (
          `ONCHAIN (${txs.length} transactions, source: ${result.source}):\n` +
          txs
            .slice(0, 8)
            .map(
              tx =>
                `- [${tx.blockchain.slice(0, 4).toUpperCase()}] ${tx.symbol} ${tx.amount.toLocaleString()} ($${tx.usdAmount ? tx.usdAmount.toLocaleString() : '?'}) ${tx.fromLabel ? `from ${tx.fromLabel}` : ''} ${tx.toLabel ? `→ ${tx.toLabel}` : ''}`
            )
            .join('\n')
        );
      } catch {
        return 'ONCHAIN: Failed to fetch';
      }
    },
  },
  {
    name: 'social-sentiment',
    keywords: [
      'sentiment',
      'reddit',
      'twitter',
      'social',
      'mentions',
      'trending',
      'meme',
      '情绪',
      '社交媒体',
    ],
    fetch: async () => {
      try {
        const { fetchTrending } = await import('@/services/social-sentiment');
        const result = await fetchTrending();
        const trending = result.trending || [];
        if (trending.length === 0) return 'SOCIAL SENTIMENT: No data available';
        return (
          `SOCIAL SENTIMENT (source: ${result.source}):\n` +
          trending
            .slice(0, 8)
            .map(
              m =>
                `- ${m.symbol}: ${m.count} mentions, sentiment ${m.sentiment >= 0 ? '📈' : '📉'} ${(m.sentiment * 100).toFixed(0)}%`
            )
            .join('\n')
        );
      } catch {
        return 'SOCIAL SENTIMENT: Failed to fetch';
      }
    },
  },
  {
    name: 'strategy',
    keywords: [
      'strategy',
      'journal',
      'playbook',
      'trade',
      'review',
      'backtest',
      'pnl',
      'win',
      'loss',
      '策略',
      '交易',
      '回测',
    ],
    fetch: async () => {
      try {
        const { getStrategies, getTrades, getPlaybooks } =
          await import('@/services/strategy-store');
        const [strategies, trades, playbooks] = [getStrategies(), getTrades(), getPlaybooks()];
        const parts: string[] = [];
        if (strategies.length > 0) {
          parts.push(
            `STRATEGIES (${strategies.length}):\n${strategies
              .slice(0, 5)
              .map(s => `- ${s.title}${s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : ''}`)
              .join('\n')}`
          );
        }
        if (trades.length > 0) {
          const wins = trades.filter(t => t.pnl > 0);
          const losses = trades.filter(t => t.pnl <= 0);
          const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
          parts.push(
            `TRADES (${trades.length} total, ${wins.length}W / ${losses.length}L):\n` +
              `Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}\n` +
              trades
                .slice(0, 5)
                .map(
                  t =>
                    `- ${t.symbol} ${t.direction.toUpperCase()} ${t.pnl >= 0 ? '📈' : '📉'} ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%)`
                )
                .join('\n')
          );
        }
        if (playbooks.length > 0) {
          parts.push(
            `PLAYBOOKS (${playbooks.length}):\n${playbooks
              .slice(0, 3)
              .map(p => `- ${p.name} (effectiveness: ${(p.effectivenessScore * 100).toFixed(0)}%)`)
              .join('\n')}`
          );
        }
        return parts.join('\n\n') || 'STRATEGY DATA: No strategy data recorded';
      } catch {
        return 'STRATEGY DATA: Failed to fetch';
      }
    },
  },
  {
    name: 'habits',
    keywords: [
      'habit',
      'streak',
      'health',
      'sleep',
      'exercise',
      'mood',
      'routine',
      'checkin',
      'energy',
      'stress',
      '习惯',
      '健康',
      '情绪',
      'briefing',
      '简报',
    ],
    fetch: async () => {
      try {
        const { getHabits, getTodayLogs, getTodayCheckIn, getHealthMetrics } =
          await import('@/services/habit-store');
        const [habits, logs, checkin, metrics] = [
          getHabits(),
          getTodayLogs(),
          getTodayCheckIn(),
          getHealthMetrics(),
        ];
        const parts: string[] = [];
        if (habits.length > 0) {
          const tracked = habits.filter(h => logs.some(l => l.habitId === h.id));
          parts.push(
            `HABITS (${habits.length} total, ${tracked.length} tracked today):\n${habits
              .map(h => {
                const log = logs.find(l => l.habitId === h.id);
                return log
                  ? `- ✅ ${h.name}: ${log.duration}${h.unit} (quality ${log.quality}/10)`
                  : `- ⬜ ${h.name}: not logged yet`;
              })
              .join('\n')}`
          );
        }
        if (checkin) {
          parts.push(
            `MENTAL CHECK-IN:\nMood: ${checkin.mood}/10 | Energy: ${checkin.energy}/10 | Stress: ${checkin.stress}/10`
          );
        }
        if (metrics.length > 0) {
          const latest = metrics.slice(-3);
          parts.push(
            `HEALTH METRICS:\n${latest.map(m => `- ${m.type}: ${m.value} ${m.unit} (${m.date})`).join('\n')}`
          );
        }
        return parts.join('\n\n') || 'HABITS: No habit data recorded';
      } catch {
        return 'HABITS: Failed to fetch';
      }
    },
  },
  {
    name: 'macro',
    keywords: [
      'macro',
      'economic',
      'gdp',
      'cpi',
      'inflation',
      'unemployment',
      'fed',
      'federal reserve',
      'yield curve',
      'interest rate',
      '宏观',
      '经济',
      '通胀',
      'briefing',
      '简报',
    ],
    fetch: async () => {
      try {
        const { fetchMacroIndicators, fetchYieldCurve } = await import('@/services/macro');
        const [indicators, yieldData] = await Promise.all([
          fetchMacroIndicators().catch(() => []),
          fetchYieldCurve().catch(() => ({ yields: [], spreads: {} })),
        ]);
        const parts: string[] = [];
        if (indicators.length > 0) {
          parts.push(
            `ECONOMIC INDICATORS:\n${indicators
              .map(
                i =>
                  `- ${i.name}: ${i.value != null ? i.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}${i.date ? ` (${i.date})` : ''}`
              )
              .join('\n')}`
          );
        }
        const spreads = yieldData.spreads || {};
        const spreadEntries = Object.entries(spreads).filter(([_, v]) => v != null);
        if (spreadEntries.length > 0) {
          parts.push(
            `YIELD CURVE SPREADS (bp):\n${spreadEntries
              .map(([k, v]) => {
                const bp = ((v as number) * 100).toFixed(1);
                const isInverted = (v as number) < 0;
                return `- ${k}: ${bp}bp${isInverted ? ' 🔴 INVERTED' : ''}`;
              })
              .join('\n')}`
          );
        }
        return (
          parts.join('\n\n') ||
          'MACRO: No economic data available (configure FRED API key in Settings)'
        );
      } catch {
        return 'MACRO: Failed to fetch';
      }
    },
  },
  {
    name: 'search',
    keywords: ['search', 'find', 'look up', 'what is', '搜索', '查找', '什么是', 'latest', '最新'],
    fetch: async () => 'WEB_SEARCH: ready (will use query from user message)',
  },
];

function loadHistory(): AgentMessage[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveHistory(msgs: AgentMessage[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
}
function loadTasks(): AgentTask[] {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveTasks(tasks: AgentTask[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.slice(-30)));
}

export class InsightsPanel extends Panel {
  private messages: AgentMessage[] = [];
  private tasks: AgentTask[] = [];
  private chatEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private modelSelectEl: HTMLSelectElement | null = null;
  private statusEl: HTMLElement | null = null;
  private isProcessing = false;
  private settings: InsightsSettings = loadSettings();
  private unsubSettings?: () => void;

  constructor() {
    super({
      id: 'insights',
      title: 'AI Summary',
      showCount: false,
      className: 'panel-wide span-2',
    });
    this.content.style.padding = '0';
    this.content.style.display = 'flex';
    this.content.style.flexDirection = 'column';
    this.messages = loadHistory();
    this.tasks = loadTasks();
    this.buildUI();
    this.unsubSettings = subscribeSettingsChange(() => this.syncModelSelect());
  }

  public destroy(): void {
    this.unsubSettings?.();
    super.destroy();
  }

  private buildUI(): void {
    this.content.innerHTML = '';
    this.chatEl = document.createElement('div');
    this.chatEl.className = 'agent-chat';
    this.content.appendChild(this.chatEl);

    const phase = getMarketPhase();
    const phaseBadge = document.createElement('div');
    phaseBadge.className = 'agent-phase-badge';
    phaseBadge.style.cssText =
      'padding:2px 8px;font-size:10px;color:var(--text-muted);opacity:0.7;border-bottom:1px solid var(--border-color,#333);';
    phaseBadge.textContent = PHASE_LABELS[phase];
    this.content.appendChild(phaseBadge);

    const modelBar = document.createElement('div');
    modelBar.className = 'agent-model-bar';
    modelBar.style.cssText =
      'display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:11px;border-top:1px solid var(--border-color, #333);';

    const modelLabel = document.createElement('span');
    modelLabel.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
    modelLabel.textContent = 'Model:';
    modelBar.appendChild(modelLabel);

    const modelSelect = document.createElement('select');
    modelSelect.style.cssText =
      'flex:1;background:var(--bg-secondary,#1a1a2e);color:var(--text);border:1px solid var(--border-color,#333);border-radius:4px;padding:2px 4px;font-size:11px;';
    const POPULAR_MODELS = [
      { value: 'anthropic/claude-opus-4.6-free', label: 'Claude Opus 4.6 (Free)' },
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { value: 'meta-llama/llama-3.2-3b-instruct', label: 'Llama 3.2 3B' },
      { value: 'minimax/minimax-m2.5', label: 'MiniMax M2.5' },
      { value: '__custom__', label: 'Custom...' },
    ];
    const currentModel = getSecret('OPENROUTER_MODEL') || DEFAULT_MODEL;
    for (const opt of POPULAR_MODELS) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      if (opt.value === currentModel) el.selected = true;
      modelSelect.appendChild(el);
    }
    modelSelect.addEventListener('change', () => {
      const val = modelSelect.value;
      if (val === '__custom__') {
        const custom = prompt('Enter model ID (e.g. openai/gpt-4o):', currentModel);
        if (custom && custom.trim()) {
          setSecret('OPENROUTER_MODEL', custom.trim());
        }
      } else {
        setSecret('OPENROUTER_MODEL', val);
      }
    });
    this.modelSelectEl = modelSelect;
    modelBar.appendChild(modelSelect);

    const statusEl = document.createElement('span');
    statusEl.style.cssText = 'color:var(--text-muted);font-size:10px;white-space:nowrap;';
    statusEl.textContent = getSecret('OPENROUTER_API_KEY') ? '🔑' : '⚠ No key';
    this.statusEl = statusEl;
    modelBar.appendChild(statusEl);

    this.content.appendChild(modelBar);

    const inputBar = document.createElement('div');
    inputBar.className = 'agent-input-bar';
    this.inputEl = document.createElement('input');
    this.inputEl.className = 'agent-input';
    this.inputEl.placeholder =
      'Ask anything — weather, stocks, news, or /task to create content...';
    this.inputEl.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.handleSend();
    });
    const sendBtn = document.createElement('button');
    sendBtn.className = 'agent-send-btn';
    sendBtn.textContent = '→';
    sendBtn.addEventListener('click', () => this.handleSend());
    inputBar.appendChild(this.inputEl);
    inputBar.appendChild(sendBtn);
    this.content.appendChild(inputBar);
    this.renderChat();
  }

  private syncModelSelect(): void {
    if (this.modelSelectEl) {
      const currentModel = getSecret('OPENROUTER_MODEL') || DEFAULT_MODEL;
      if (this.modelSelectEl.value !== currentModel && this.modelSelectEl.value !== '__custom__') {
        this.modelSelectEl.value = currentModel;
      }
    }
    if (this.statusEl) {
      this.statusEl.textContent = getSecret('OPENROUTER_API_KEY') ? '🔑' : '⚠ No key';
    }
  }

  private renderChat(): void {
    if (!this.chatEl) return;
    if (this.messages.length === 0) {
      this.chatEl.innerHTML = `
        <div class="agent-welcome">
          <div class="agent-welcome-title">📊 AI Summary</div>
          <div class="agent-welcome-desc">
            Your daily briefing center — get instant summaries across all your data.<br>
            <span style="color:var(--text-muted);font-size:11px;">Stocks · News · Weather · Email · Schedule · GitHub · Servers — all at your fingertips.</span>
            ${!getSecret('OPENROUTER_API_KEY') ? '<br><span style="color:var(--yellow);font-size:11px;">⚠ Add OpenRouter API key in Settings to unlock AI.</span>' : ''}
          </div>
          <div class="agent-quick-actions">
            ${QUICK_ACTIONS.map((a, i) => `<button class="agent-quick-btn" data-qidx="${i}">${a.label}</button>`).join('')}
          </div>
        </div>`;
      this.wireQuickActions();
      return;
    }
    const msgs = this.messages.slice(-MAX_HISTORY);
    const html = msgs
      .map(m => {
        const fmt = (text: string) => escapeHtml(text).replace(/\n/g, '<br>');
        if (m.role === 'user')
          return `<div class="agent-msg agent-msg-user"><div class="agent-msg-content">${fmt(m.content)}</div></div>`;
        if (m.role === 'tool')
          return `<div class="agent-msg agent-msg-tool"><span class="agent-tool-label">🔧 ${escapeHtml(m.toolName || 'tool')}</span><div class="agent-msg-content agent-tool-content">${fmt(m.content).slice(0, 500)}${m.content.length > 500 ? '...' : ''}</div></div>`;
        if (m.role === 'system')
          return `<div class="agent-msg agent-msg-system"><div class="agent-msg-content">${fmt(m.content)}</div></div>`;
        return `<div class="agent-msg agent-msg-agent"><span class="agent-avatar">📊</span><div class="agent-msg-content">${fmt(m.content)}</div></div>`;
      })
      .join('');
    const quickHtml = `<div class="agent-quick-actions" style="margin-top:8px">${QUICK_ACTIONS.map((a, i) => `<button class="agent-quick-btn" data-qidx="${i}">${a.label}</button>`).join('')}</div>`;
    this.chatEl.innerHTML = html + quickHtml;
    this.wireQuickActions();
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
  }

  private wireQuickActions(): void {
    this.chatEl?.querySelectorAll<HTMLButtonElement>('[data-qidx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.qidx!, 10);
        if (QUICK_ACTIONS[idx]) this.sendMessage(QUICK_ACTIONS[idx].prompt);
      });
    });
  }

  private handleSend(): void {
    if (!this.inputEl || !this.inputEl.value.trim() || this.isProcessing) return;
    const text = this.inputEl.value.trim();
    this.inputEl.value = '';
    this.sendMessage(text);
  }

  private selectTools(query: string): ToolDef[] {
    const q = query.toLowerCase();
    if (q.includes('briefing') || q.includes('简报') || q.includes('daily')) {
      return TOOLS.filter(t => ['weather', 'schedule', 'news', 'stocks', 'email'].includes(t.name));
    }
    const matched = TOOLS.filter(t => t.keywords.some(kw => q.includes(kw)));
    if (matched.length === 0) {
      if (
        q.startsWith('/task') ||
        q.includes('create') ||
        q.includes('make') ||
        q.includes('做') ||
        q.includes('写') ||
        q.includes('生成')
      ) {
        return TOOLS.filter(t => ['news', 'stocks'].includes(t.name));
      }
      return TOOLS.filter(t => ['news', 'stocks', 'weather'].includes(t.name));
    }
    return matched;
  }

  async sendMessage(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    if (text === '/tasks') {
      this.messages.push({ role: 'user', content: text, timestamp: Date.now() });
      this.showTaskList();
      this.isProcessing = false;
      return;
    }
    if (text === '/clear') {
      this.messages = [];
      saveHistory(this.messages);
      this.isProcessing = false;
      this.renderChat();
      return;
    }

    this.messages.push({ role: 'user', content: text, timestamp: Date.now() });

    const tools = this.selectTools(text);
    const toolNames = tools.map(t => t.name).join(', ');
    this.messages.push({
      role: 'system',
      content: `⏳ Fetching: ${toolNames}...`,
      timestamp: Date.now(),
    });
    this.renderChat();

    try {
      const results = await Promise.allSettled(
        tools.map(async t => {
          const data = await t.fetch();
          return { name: t.name, data };
        })
      );
      this.messages.pop();

      const contextParts: string[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.data) {
          contextParts.push(r.value.data);
        }
      }

      const q = text.toLowerCase();
      if (
        q.includes('search') ||
        q.includes('搜索') ||
        q.includes('latest') ||
        q.includes('最新') ||
        q.includes('find')
      ) {
        try {
          const searchQuery = text.replace(/^.*?(search|搜索|find|查找)\s*/i, '').trim() || text;
          const { searchNews } = await import('@/services/news');
          const searchResults = await searchNews(searchQuery);
          if (searchResults.length > 0) {
            contextParts.push(
              'WEB SEARCH:\n' +
                searchResults
                  .slice(0, 5)
                  .map(a => `- [${a.source}] ${a.title} (${a.url})`)
                  .join('\n')
            );
          }
        } catch {}
      }

      const context = contextParts.join('\n\n');

      if (context) {
        this.messages.push({
          role: 'tool',
          content: context,
          toolName: toolNames,
          timestamp: Date.now(),
        });
        this.renderChat();
      }

      const apiKey = getSecret('OPENROUTER_API_KEY');
      if (!apiKey) {
        const formatted = context
          ? this.formatRawBriefing(context)
          : '⚠ No API key configured and no relevant data found. Go to Settings → API Keys → AI to add an OpenRouter key.';
        this.messages.push({
          role: 'agent',
          content: formatted,
          timestamp: Date.now(),
        });
      } else {
        const model = getSecret('OPENROUTER_MODEL') || DEFAULT_MODEL;
        const isTask = text.startsWith('/task');
        const taskPrompt = isTask
          ? "\n\nThe user wants you to CREATE CONTENT. Produce complete, usable output (not just an outline). If it's a PPT, write full slide content with titles, bullet points, and speaker notes."
          : '';

        const phase = getMarketPhase();
        const phasePrompt = `\n\nCurrent market phase: ${PHASE_LABELS[phase]}. ${PHASE_CONTEXT[phase]}`;

        const resp = await fetch(OPENROUTER_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://my-daily-monitor.local',
            'X-Title': 'My Daily Monitor Agent',
          },
          body: JSON.stringify({
            model,
            max_tokens: isTask ? 1500 : 800,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT + phasePrompt + taskPrompt },
              {
                role: 'user',
                content: `Context data:\n${context || 'No data available.'}\n\nUser: ${text.replace(/^\/task\s*/i, '')}`,
              },
            ],
          }),
        });

        if (!resp.ok) throw new Error(`LLM API ${resp.status}`);
        const data = (await resp.json()) as any;
        const reply = data.choices?.[0]?.message?.content || 'No response from AI.';

        const codeMatch = reply.match(/```python\n([\s\S]*?)```/);
        if (codeMatch) {
          this.messages.push({ role: 'agent', content: reply, timestamp: Date.now() });
          this.renderChat();

          const code = codeMatch[1];
          this.messages.push({
            role: 'system',
            content: '⚙️ Executing Python code...',
            timestamp: Date.now(),
          });
          this.renderChat();

          try {
            const execResp = await fetch('/api/system?action=exec', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: code,
            });
            const execResult = (await execResp.json()) as any;
            this.messages.pop();

            if (execResult.success) {
              const output = execResult.stdout || '';
              const filePath = output.trim().split('\n').pop() || '';
              this.messages.push({
                role: 'tool',
                content: `✅ Code executed successfully.\n${output}${execResult.stderr ? `\nWarnings: ${execResult.stderr}` : ''}`,
                toolName: 'execute_python',
                timestamp: Date.now(),
              });
              const taskTitle = isTask
                ? text.replace(/^\/task\s*/i, '').slice(0, 60)
                : 'Code execution';
              this.tasks.unshift({
                id: `t-${Date.now()}`,
                title: taskTitle,
                content: `Output: ${filePath || output}`,
                status: 'done',
                createdAt: new Date().toISOString(),
              });
              saveTasks(this.tasks);
            } else {
              this.messages.push({
                role: 'tool',
                content: `❌ Execution failed:\n${execResult.stderr || execResult.error || 'Unknown error'}`,
                toolName: 'execute_python',
                timestamp: Date.now(),
              });
              if (isTask) {
                this.tasks.unshift({
                  id: `t-${Date.now()}`,
                  title: text.slice(0, 60),
                  content: `Failed: ${execResult.error || 'execution error'}`,
                  status: 'failed',
                  createdAt: new Date().toISOString(),
                });
                saveTasks(this.tasks);
              }
            }
          } catch (execErr: any) {
            this.messages.pop();
            this.messages.push({
              role: 'tool',
              content: `❌ Could not execute: ${execErr.message}`,
              toolName: 'execute_python',
              timestamp: Date.now(),
            });
          }
        } else {
          if (isTask) {
            const taskTitle = text.replace(/^\/task\s*/i, '').slice(0, 60);
            this.tasks.unshift({
              id: `t-${Date.now()}`,
              title: taskTitle,
              content: reply,
              status: 'done',
              createdAt: new Date().toISOString(),
            });
            saveTasks(this.tasks);
          }
          this.messages.push({ role: 'agent', content: reply, timestamp: Date.now() });
        }
      }
    } catch (err: any) {
      if (this.messages[this.messages.length - 1]?.role === 'system') this.messages.pop();
      this.messages.push({
        role: 'agent',
        content: `⚠️ Error: ${err.message}`,
        timestamp: Date.now(),
      });
    }

    saveHistory(this.messages);
    this.isProcessing = false;
    this.renderChat();
  }

  private formatRawBriefing(context: string): string {
    const sections: string[] = [];

    const weatherMatch = context.match(
      /WEATHER[^:]*:([\s\S]*?)(?=\n\n|STOCKS|NEWS|SCHEDULE|EMAIL|$)/
    );
    if (weatherMatch) {
      const w = weatherMatch[1].trim();
      sections.push(`🌤 Weather\n${w}`);
    }

    const scheduleMatch = context.match(
      /(?:SCHEDULE|TODAY'S SCHEDULE)[^:]*:([\s\S]*?)(?=\n\n|STOCKS|NEWS|WEATHER|EMAIL|$)/
    );
    if (scheduleMatch) {
      sections.push(`📅 Schedule\n${scheduleMatch[1].trim()}`);
    }

    const stocksMatch = context.match(
      /STOCKS[^:]*:([\s\S]*?)(?=\n\n|WEATHER|NEWS|SCHEDULE|EMAIL|$)/
    );
    if (stocksMatch) {
      sections.push(`📈 Markets\n${stocksMatch[1].trim()}`);
    }

    const newsMatch = context.match(/NEWS[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|SCHEDULE|EMAIL|$)/);
    if (newsMatch) {
      const lines = newsMatch[1].trim().split('\n').slice(0, 6);
      sections.push(`🌍 News\n${lines.join('\n')}`);
    }

    const emailMatch = context.match(
      /EMAIL[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|$)/
    );
    if (emailMatch) {
      sections.push(`📧 Email\n${emailMatch[1].trim()}`);
    }

    const habitsMatch = context.match(
      /HABITS[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|EMAIL|MACRO|STRATEGY|ONCHAIN|OPTIONS|SOCIAL|$)/
    );
    if (habitsMatch) {
      sections.push(`✅ Habits\n${habitsMatch[1].trim()}`);
    }

    const optionsMatch = context.match(
      /OPTIONS FLOW[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|EMAIL|ONCHAIN|SOCIAL|$)/
    );
    if (optionsMatch) {
      sections.push(`🔍 Options Flow\n${optionsMatch[1].trim()}`);
    }

    const onchainMatch = context.match(
      /ONCHAIN[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|EMAIL|OPTIONS|SOCIAL|$)/
    );
    if (onchainMatch) {
      sections.push(`⛓ On-Chain\n${onchainMatch[1].trim()}`);
    }

    const socialMatch = context.match(
      /SOCIAL SENTIMENT[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|EMAIL|OPTIONS|ONCHAIN|$)/
    );
    if (socialMatch) {
      sections.push(`📊 Social Sentiment\n${socialMatch[1].trim()}`);
    }

    if (sections.length === 0) {
      return (
        context +
        '\n\n💡 Add an OpenRouter API key in Settings → API Keys → AI for intelligent analysis.'
      );
    }

    return (
      sections.join('\n\n') +
      '\n\n💡 Add an OpenRouter API key in Settings → API Keys → AI for richer analysis.'
    );
  }

  private showTaskList(): void {
    if (this.tasks.length === 0) {
      this.messages.push({
        role: 'agent',
        content: "📋 No tasks yet. Try: /task Create a summary of today's news",
        timestamp: Date.now(),
      });
    } else {
      const icons: Record<TaskStatus, string> = { pending: '⏳', done: '✅', failed: '❌' };
      const list = this.tasks
        .slice(0, 10)
        .map(
          (t, i) =>
            `${i + 1}. ${icons[t.status]} ${t.title}\n   ${new Date(t.createdAt).toLocaleString()}\n   ${t.content.slice(0, 80)}${t.content.length > 80 ? '...' : ''}`
        )
        .join('\n\n');
      this.messages.push({
        role: 'agent',
        content: `📋 Tasks (${this.tasks.length}):\n\n${list}`,
        timestamp: Date.now(),
      });
    }
    saveHistory(this.messages);
    this.renderChat();
  }

  public getSettingsPopover(): HTMLElement {
    const currentModel = getSecret('OPENROUTER_MODEL') || DEFAULT_MODEL;
    const schema: SettingSchema<InsightsSettings>[] = [
      {
        key: 'model',
        label: 'AI Model',
        type: 'select',
        options: [
          { value: 'openrouter/auto', label: 'OpenRouter Auto' },
          { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
          { value: 'openai/gpt-4o', label: 'GPT-4o' },
          { value: 'google/gemini-pro', label: 'Gemini Pro' },
        ],
      },
      {
        key: 'scope',
        label: 'Scope',
        type: 'select',
        options: [
          { value: 'watchlist', label: 'Watchlist' },
          { value: 'all-symbols', label: 'All Symbols' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      {
        key: 'includeNews',
        label: 'Include news context',
        type: 'checkbox',
      },
    ];

    return createSettingsForm<InsightsSettings>({
      title: 'AI Insights Settings',
      schema,
      initialValues: { ...this.settings, model: currentModel },
      onChange: vals => {
        this.settings = vals;
        saveSettings(this.settings);
        setSecret('OPENROUTER_MODEL', vals.model);
      },
    });
  }

  async refresh(): Promise<void> {}
}
