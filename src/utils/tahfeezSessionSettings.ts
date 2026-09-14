import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { TahfeezSessionSettings } from '@/stores/sessionsStore';

/**
 * Captures the full current tahfeez/quiz settings as a snapshot that can be
 * stored under ONE session id, so sessions never share settings.
 */
export function captureTahfeezSettings(): TahfeezSessionSettings {
  const s = useTahfeezStore.getState();
  const fonts = useSettingsStore.getState().settings.fonts;
  return {
    autoBlankMode: s.autoBlankMode,
    waqfCombinedModes: s.waqfCombinedModes,
    blankCount: s.blankCount,
    ayahCount: s.ayahCount,
    timerSeconds: s.timerSeconds,
    firstWordTimerSeconds: s.firstWordTimerSeconds,
    revealMode: s.revealMode,
    voiceMode: s.voiceMode,
    matchLevel: s.matchLevel,
    revealedColor: s.revealedColor,
    revealedWithBg: s.revealedWithBg,
    activeWordColor: s.activeWordColor,
    singleWordMode: s.singleWordMode,
    quizInteraction: s.quizInteraction,
    mcqDisplayMode: s.mcqDisplayMode,
    mcqPanelPosition: s.mcqPanelPosition,
    dotScale: s.dotScale,
    revealGranularity: s.revealGranularity,
    groupDurationProportional: s.groupDurationProportional,
    segmentMcqInline: s.segmentMcqInline,
    segmentMcqChoicesAtBlank: s.segmentMcqChoicesAtBlank,
    segmentMcqCorrectDelay: s.segmentMcqCorrectDelay,
    segmentMcqWrongDelay: s.segmentMcqWrongDelay,
    segmentMcqRandomOrder: s.segmentMcqRandomOrder,
    segmentMcqMultiPage: s.segmentMcqMultiPage,
    segmentMcqBlankDuration: s.segmentMcqBlankDuration,
    waqfDisplayMode: s.waqfDisplayMode,
    reviewMode: s.reviewMode,
    hiddenAyatCount: s.hiddenAyatCount,
    hiddenWordsCount: s.hiddenWordsCount,
    hiddenWordsMode: s.hiddenWordsMode,
    hiddenWordsPercentage: s.hiddenWordsPercentage,
    percentageScope: s.percentageScope,
    wordSequenceMode: s.wordSequenceMode,
    wordBlankPosition: s.wordBlankPosition,
    distributionMode: s.distributionMode,
    quizScope: s.quizScope,
    quizScopeFrom: s.quizScopeFrom,
    quizScopeTo: s.quizScopeTo,
    quizSource: s.quizSource,
    fontFamily: fonts.fontFamily,
    quranFontSize: fonts.quranFontSize,
    lineHeight: fonts.lineHeight,
    fontWeight: fonts.fontWeight,
  } as TahfeezSessionSettings;
}

/** Applies a per-session snapshot back onto the working stores. */
export function applyTahfeezSettings(ts: Partial<TahfeezSessionSettings> | null | undefined): void {
  if (!ts) return;
  const store = useTahfeezStore.getState() as any;
  const set = (fn: string, value: unknown) => {
    if (value === undefined || typeof store[fn] !== 'function') return;
    store[fn](value as never);
  };
  set('setAutoBlankMode', ts.autoBlankMode);
  set('setWaqfCombinedModes', ts.waqfCombinedModes);
  set('setBlankCount', ts.blankCount);
  set('setAyahCount', ts.ayahCount);
  set('setTimerSeconds', ts.timerSeconds);
  set('setFirstWordTimerSeconds', ts.firstWordTimerSeconds);
  set('setRevealMode', ts.revealMode);
  set('setVoiceMode', ts.voiceMode);
  set('setMatchLevel', ts.matchLevel);
  set('setRevealedColor', ts.revealedColor);
  set('setRevealedWithBg', ts.revealedWithBg);
  set('setActiveWordColor', ts.activeWordColor);
  set('setSingleWordMode', ts.singleWordMode);
  set('setQuizInteraction', ts.quizInteraction);
  set('setMcqDisplayMode', ts.mcqDisplayMode);
  set('setMcqPanelPosition', ts.mcqPanelPosition);
  set('setDotScale', ts.dotScale);
  set('setRevealGranularity', ts.revealGranularity);
  set('setGroupDurationProportional', ts.groupDurationProportional);
  set('setSegmentMcqInline', ts.segmentMcqInline);
  set('setSegmentMcqChoicesAtBlank', ts.segmentMcqChoicesAtBlank);
  set('setSegmentMcqCorrectDelay', ts.segmentMcqCorrectDelay);
  set('setSegmentMcqWrongDelay', ts.segmentMcqWrongDelay);
  set('setSegmentMcqRandomOrder', ts.segmentMcqRandomOrder);
  set('setSegmentMcqMultiPage', ts.segmentMcqMultiPage);
  set('setSegmentMcqBlankDuration', ts.segmentMcqBlankDuration);
  set('setWaqfDisplayMode', ts.waqfDisplayMode);
  set('setReviewMode', ts.reviewMode);
  set('setHiddenAyatCount', ts.hiddenAyatCount);
  set('setHiddenWordsCount', ts.hiddenWordsCount);
  set('setHiddenWordsMode', ts.hiddenWordsMode);
  set('setHiddenWordsPercentage', ts.hiddenWordsPercentage);
  set('setPercentageScope', ts.percentageScope);
  set('setWordSequenceMode', ts.wordSequenceMode);
  set('setWordBlankPosition', ts.wordBlankPosition);
  set('setDistributionMode', ts.distributionMode);
  set('setQuizScope', ts.quizScope);
  set('setQuizScopeFrom', ts.quizScopeFrom);
  set('setQuizScopeTo', ts.quizScopeTo);
  set('setQuizSource', ts.quizSource);

  const fontPatch: Record<string, unknown> = {};
  if (ts.fontFamily) fontPatch.fontFamily = ts.fontFamily;
  if (ts.quranFontSize) fontPatch.quranFontSize = ts.quranFontSize;
  if (ts.lineHeight) fontPatch.lineHeight = ts.lineHeight;
  if (ts.fontWeight) fontPatch.fontWeight = ts.fontWeight;
  if (Object.keys(fontPatch).length > 0) {
    useSettingsStore.getState().setFonts(fontPatch as never);
  }
}
