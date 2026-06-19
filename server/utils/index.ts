export {
  extractTickers,
  analyzeSentiment,
  classifyContent,
  weightedScore,
  detectBreakout,
  type WeightConfig,
  type ContentType,
  DEFAULT_WEIGHT_CONFIG,
} from './sentiment-analyzer';

export {
  correlateSignals,
  storePanelResults,
  getCorrelatedSignals,
  type PanelMention,
  type CorrelatedSignal,
} from './signal-correlator';
