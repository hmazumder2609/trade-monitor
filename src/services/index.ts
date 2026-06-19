export { fetchStockQuotes } from './stock-market';
export type { StockQuote } from './stock-market';

export { fetchNews, searchNews } from './news';
export type { NewsArticle, ThreatLevel } from './news';

export { fetchEmails, fetchEmailResult } from './email';
export type { EmailMessage, EmailResult } from './email';

export { fetchCalendarEvents, fetchCalendarResult } from './schedule';
export type { CalendarEvent, CalendarResult } from './schedule';

export { fetchWorkflowRuns, fetchCodeStatusResult } from './code-status';
export type { WorkflowRun, CodeStatusResult } from './code-status';

export { fetchRecentDocuments, getDemoDocuments, getDocTypeIcon } from './office';
export type { OfficeDocument } from './office';

export { fetchSocialFeed, fetchSocialResult } from './social';
export type { SocialPost, SocialResult } from './social';

export { fetchDailyFinance, getDemoFinance } from './finance';
export type { FinanceTransaction, DailySummary } from './finance';

export { fetchFeishuMessages, fetchFeishuResult } from './feishu';
export type { FeishuMessage, FeishuResult } from './feishu';

export {
  fetchMacroSeries,
  fetchMacroIndicators,
  fetchYieldCurve,
  fetchMacroHistory,
} from './macro';
export type {
  MacroSeries,
  MacroObservation,
  MacroIndicator,
  YieldCurveData,
  YieldCurvePoint,
} from './macro';

export {
  getStrategies,
  getStrategy,
  saveStrategy,
  deleteStrategy,
  getTrades,
  getTrade,
  saveTrade,
  deleteTrade,
  getPlaybooks,
  getPlaybook,
  savePlaybook,
  updatePlaybook,
  deletePlaybook,
  getBacktests,
  getBacktest,
  saveBacktest,
  deleteBacktest,
} from './strategy-store';
export type { StrategyEntry, TradeReview, Playbook, BacktestLog } from './strategy-store';

export {
  getHabits,
  saveHabit,
  deleteHabit,
  getHabitLogs,
  getLogsForHabit,
  getTodayLogs,
  saveHabitLog,
  getHealthMetrics,
  saveHealthMetric,
  deleteHealthMetric,
  getRoutines,
  saveRoutine,
  deleteRoutine,
  getCheckIns,
  getTodayCheckIn,
  saveCheckIn,
} from './habit-store';
export type { Habit, HabitLog, HealthMetric, Routine, MentalCheckIn } from './habit-store';

export { fetchOptionsSummary, fetchUnusualActivity, fetchBlockTrades } from './options-flow';
export type { OptionsSummary, UnusualOption, BlockTrade } from './options-flow';

export { fetchOnChainTransactions, fetchOnChainStatus } from './onchain';
export type { WhaleTransaction } from './onchain';

export { fetchMentions, fetchTwitterSentiment, fetchTrending } from './social-sentiment';
export type { MentionCount } from './social-sentiment';

export { RefreshScheduler } from './refresh-scheduler';
export type { RefreshRegistration } from './refresh-scheduler';

export {
  getSecret,
  setSecret,
  hasSecret,
  maskSecret,
  getPreferences,
  setPreferences,
  subscribeSettingsChange,
  getStockSymbols,
  getGithubRepos,
} from './settings-store';
