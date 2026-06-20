import { registry } from '@/services/plugin-registry';
import { SocialSentimentPanel } from './Panel';

registry.register({
  id: 'social-sentiment',
  name: 'Social Sentiment',
  tab: 'news' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new SocialSentimentPanel(),
});
