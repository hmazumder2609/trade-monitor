# Modern Alert System — Implementation Plan

**Goal:** Upgrade the alert system with modern sounds, toast notifications, and automated triggers.

**Architecture:** Two-tier alerts — dashboard alerts (news threat levels, Web Audio, toast notifications) + terminal alerts (price thresholds). Automated triggers monitor sentiment, keywords, and cross-panel signals.

**Tech Stack:** TypeScript, Web Audio API, vanilla DOM panels, Express server routes.

---

## Phase 1: Modern Alert Sounds

### Task 1.1: Rewrite `src/services/alert-sounds.ts`

**Changes:**
- Replace old tone generation with smooth sine/triangle waveforms
- Add fade-in/out envelopes (50ms attack, 200ms release)
- Add reverb effect (70% dry / 30% wet convolution)
- 16 total presets (12 original redesigned + 4 new: sonar, glass, subtle, waveform)
- Master volume chain with gain control

**Key Functions:**
- `playAlertSound(level, toneId, volume)` — plays alert sound
- `playTestTone(toneId, volume)` — plays preview tone
- `getToneNames()` — returns available tones with labels
- `getWaveform(toneId)` — returns waveform data for visualization
- `createReverb()` — creates convolution reverb
- `createMasterChain()` — creates audio processing chain
- `applyEnvelope(gainNode, attackMs, releaseMs)` — applies fade envelope

---

## Phase 2: Modern Alert UI

### Task 2.1: Rewrite `src/components/BreakingNewsBanner.ts`

**Changes:**
- Replace top-of-screen banners with bottom-right toast notifications
- Add progress bar auto-dismiss (configurable duration)
- Add alert history panel with unread badges
- Add mark-all-read functionality
- Add clickable items that navigate to panels
- Persist alert history in `mdm-alert-history` localStorage (max 100 entries)

**Key Functions:**
- `pushBreakingAlert(alert)` — shows toast notification
- `scanForBreakingNews(articles)` — scans articles for threats
- `getAlertHistory()` — returns alert history
- `markAlertRead(id)` — marks alert as read
- `markAllAlertsRead()` — marks all alerts as read
- `getUnreadAlertCount()` — returns unread count

---

## Phase 3: New Alert Triggers

### Task 3.1: Create `src/services/alert-triggers.ts`

**Trigger Types:**
- **Sentiment**: Monitor social/Reddit/X sentiment per symbol, fire when threshold crossed
- **Keyword**: Fire when specific keywords appear in financial news
- **Price**: Monitor price changes (integrated with terminal's price alert system)
- **Signal**: Cross-panel composite signal (weighted avg of social + Reddit + X sentiment)

**Key Functions:**
- `getTriggers()` — returns all triggers
- `addTrigger(trigger)` — adds new trigger
- `removeTrigger(id)` — removes trigger
- `updateTrigger(id, updates)` — updates trigger
- `startSentimentMonitoring()` — starts sentiment check (30s interval)
- `startSignalMonitoring()` — starts signal check (60s interval)
- `checkKeywordsForAlerts(articles)` — checks articles for keywords
- `calculateSignalScores()` — calculates composite scores
- `startAllAlertMonitoring()` — starts all monitoring

**Storage:**
- Triggers stored in `mdm-alert-triggers` localStorage
- 5-minute cooldown between repeated alerts for same trigger

---

## Phase 4: Signal Filtering

### Task 4.1: Update `src/plugins/FinancialNewsPlugin/Panel.ts`

**Changes:**
- Add threat-level filtering (toggle which levels to show)
- Add keyword filtering (comma-separated keywords to filter articles)
- Add highlight keywords (bold/yellow highlighting in headlines)
- Filter state persisted in `mdm-financial-news-filters` localStorage

**Settings Popover:**
- Threat level toggles (critical/high/medium/low/info)
- Keyword filter input
- Highlight keywords input
- RSS source management (existing)

---

## Phase 5: Settings Modal Integration

### Task 5.1: Update `src/components/SettingsModal.ts`

**Changes:**
- Add trigger management UI to alerts tab
- List all configured triggers with type icons
- Toggle enable/disable per trigger
- Remove trigger button
- Add new trigger form: type, target, condition, threshold, alert level

**Trigger Types UI:**
- 📊 Sentiment
- 🔍 Keyword
- 🔗 Signal

---

## Verification

After all tasks:
```bash
npm run type:check
npm run lint
npm run test
```

**Expected Results:**
- Type check: 0 errors
- Lint: Pre-existing warnings only (no new errors)
- Tests: 63/63 pass

**Manual Testing:**
- Alert sounds play correctly with reverb effect
- Toast notifications appear bottom-right with progress bar
- Alert history panel shows past alerts with unread badges
- Alert triggers fire when conditions are met
- FinancialNews filtering works (threat levels, keywords, highlights)
- Settings modal shows trigger management UI
