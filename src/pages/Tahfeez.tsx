import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAutoQuizEngine, EnginePageState } from '@/hooks/useAutoQuizEngine';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { MCQStats, TahfeezMCQPanel } from '@/components/TahfeezMCQPanel';
import { TahfeezSegmentMCQView, SegmentMCQStats } from '@/components/TahfeezSegmentMCQView';
import { useSessionsStore, TahfeezAutoResumeState, TahfeezTestResumeState, PageState } from '@/stores/sessionsStore';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuranData } from '@/hooks/useQuranData';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { useSpeech } from '@/hooks/useSpeech';
import { normalizeArabic } from '@/utils/quranParser';
import { computeSessionTotalItems } from '@/utils/sessionWordCount';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, EyeOff, ArrowRight, Save, Trash2, GraduationCap, ListChecks, Zap, Book, Layers, Hash, FileText, Search, X, ChevronLeft, Download, Upload, ChevronsRight, Undo2, Palette, Mic, MicOff, MousePointerClick, RotateCcw, Settings, Clock } from 'lucide-react';
import { SpeedControlWidget } from '@/components/SpeedControlWidget';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { HiddenBarsOverlay } from '@/components/HiddenBarsOverlay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TahfeezQuizView } from '@/components/TahfeezQuizView';
import { TahfeezSelectionView } from '@/components/TahfeezSelectionView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
// SettingsDialog removed — Tahfeez has its own inline settings
import { AutoPlayDebugPanel } from '@/components/AutoPlayDebugPanel';
import { TahfeezFontSettings } from '@/components/TahfeezFontSettings';
import { TahfeezAutoQuizSettings } from '@/components/TahfeezAutoQuizSettings';
import { TahfeezSRSPanel } from '@/components/TahfeezSRSPanel';
import { TahfeezSessionReviewSettings } from '@/components/TahfeezSessionReviewSettings';
// ---- Quran Index Data ----
const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name,
  startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

function formatSessionTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = ms / 1000;
  // Sub-10s: show one decimal for precision at fast speeds
  if (totalSec < 10) {
    return `${totalSec.toFixed(1)}ث`;
  }
  const wholeSec = Math.floor(totalSec);
  const h = Math.floor(wholeSec / 3600);
  const m = Math.floor((wholeSec % 3600) / 60);
  const s = wholeSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const JUZ_DATA = [
  { number: 1, name: 'الم', page: 1 }, { number: 2, name: 'سيقول', page: 22 },
  { number: 3, name: 'تلك الرسل', page: 42 }, { number: 4, name: 'لن تنالوا', page: 62 },
  { number: 5, name: 'والمحصنات', page: 82 }, { number: 6, name: 'لا يحب الله', page: 102 },
  { number: 7, name: 'وإذا سمعوا', page: 121 }, { number: 8, name: 'ولو أننا', page: 142 },
  { number: 9, name: 'قال الملأ', page: 162 }, { number: 10, name: 'واعلموا', page: 182 },
  { number: 11, name: 'يعتذرون', page: 201 }, { number: 12, name: 'وما من دابة', page: 222 },
  { number: 13, name: 'وما أبرئ', page: 242 }, { number: 14, name: 'ربما', page: 262 },
  { number: 15, name: 'سبحان الذي', page: 282 }, { number: 16, name: 'قال ألم', page: 302 },
  { number: 17, name: 'اقترب للناس', page: 322 }, { number: 18, name: 'قد أفلح', page: 342 },
  { number: 19, name: 'وقال الذين', page: 362 }, { number: 20, name: 'أمن خلق', page: 382 },
  { number: 21, name: 'اتل ما أوحي', page: 402 }, { number: 22, name: 'ومن يقنت', page: 422 },
  { number: 23, name: 'وما لي', page: 442 }, { number: 24, name: 'فمن أظلم', page: 462 },
  { number: 25, name: 'إليه يرد', page: 482 }, { number: 26, name: 'حم', page: 502 },
  { number: 27, name: 'قال فما خطبكم', page: 522 }, { number: 28, name: 'قد سمع الله', page: 542 },
  { number: 29, name: 'تبارك الذي', page: 562 }, { number: 30, name: 'عم', page: 582 },
];

// VoiceDebugOverlay removed — speech recognition disabled

export default function TahfeezPage() {
  const {
    storedItems, clearAllItems, addItem, removeItem, getItemKey,
    quizSource, setQuizSource,
    autoBlankMode, setAutoBlankMode,
    waqfCombinedModes, setWaqfCombinedModes,
    blankCount, setBlankCount,
    ayahCount, setAyahCount,
    timerSeconds, setTimerSeconds,
    firstWordTimerSeconds, setFirstWordTimerSeconds,
    revealMode, setRevealMode,
    activeTab, setActiveTab,
    selectionMode, setSelectionMode,
    rangeAnchor, setRangeAnchor,
    quizScope, setQuizScope,
    quizScopeFrom, setQuizScopeFrom,
    quizScopeTo, setQuizScopeTo,
    undo, canUndo,
    voiceMode, setVoiceMode,
    matchLevel, setMatchLevel,
    revealedColor, setRevealedColor,
    revealedWithBg, setRevealedWithBg,
    activeWordColor, setActiveWordColor,
    singleWordMode, setSingleWordMode,
    quizInteraction, setQuizInteraction,
    mcqDisplayMode, setMcqDisplayMode,
    mcqPanelPosition, setMcqPanelPosition,
    dotScale, setDotScale,
    revealGranularity, setRevealGranularity,
    segmentMcqInline, setSegmentMcqInline,
    segmentMcqChoicesAtBlank, setSegmentMcqChoicesAtBlank,
    segmentMcqCorrectDelay, setSegmentMcqCorrectDelay,
    segmentMcqWrongDelay, setSegmentMcqWrongDelay,
    segmentMcqRandomOrder, setSegmentMcqRandomOrder,
    segmentMcqMultiPage, setSegmentMcqMultiPage,
    segmentMcqBlankDuration, setSegmentMcqBlankDuration,
    rotateDistributionSeed,
    reviewMode,
    hiddenAyatCount, setHiddenAyatCount,
    hiddenWordsCount, setHiddenWordsCount,
    hiddenWordsMode,
    hiddenWordsPercentage, setHiddenWordsPercentage,
  } = useTahfeezStore();

  const speech = useSpeech();

  const { pages, currentPage, getCurrentPageData, goToPage, totalPages, nextPage, prevPage } = useQuranData();
  useSettingsApplier(); // Apply font/display settings globally
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'auto15');
  const autoplaySpeed = useSettingsStore((s) => s.settings.autoplay.speed);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const keepScreenAwake = useSettingsStore((s) => s.settings.autoplay.keepScreenAwake ?? false);
  const pageData = getCurrentPageData();

  // ── Session resume & hydration ──
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const isResumeParam = searchParams.get('resume') === '1';
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const updateSession = useSessionsStore((s) => s.updateSession);
  const getSession = useSessionsStore((s) => s.getSession);
  const saveResumeState = useSessionsStore((s) => s.saveResumeState);
  const markSessionPaused = useSessionsStore((s) => s.markSessionPaused);
  const markSessionResumed = useSessionsStore((s) => s.markSessionResumed);
  const hasHydratedRef = useRef(false);
  const isHydratingSessionRef = useRef(false);

  // ── Unified Auto-Quiz Engine ──
  const engine = useAutoQuizEngine();
  const scheduleItem = engine.scheduleItem;
  const recordProcessed = engine.recordProcessed;
  const setEngineSpeed = engine.setSpeed;
  const defaultItemMsRef = engine.defaultItemMsRef;
  const restoreEngine = engine.restore;
  const startRaf = engine.startRaf;
  const getTotalItems = engine.getTotalItems;
  const getProcessedItems = engine.getProcessedItems;
  const snapshotEngine = engine.snapshot;
  const pauseEngine = engine.pause;
  const completeEngine = engine.complete;
  const navigateToQuizPage = engine.navigateToPage;
  const registerPageDurations = engine.registerPageDurations;
  const initSession = engine.initSession;
  const resumeEngine = engine.resume;
  const resetQuizPage = engine.resetPage;
  const resetQuizSession = engine.resetSession;
  const enginePageSchedulesRef = engine.pageSchedulesRef;

  // Aliases
  const sessionRemainingMs = engine.sessionRemainingMs;
  const pageStatesRef = engine.pageStatesRef as React.MutableRefObject<Record<number, PageState>>;
  const remainingMs = engine.currentItemRemainingMs;

  // Ref to latest scheduleItem for use in advance() closure
  // The callback passed to scheduleItem IS the reveal trigger — no separate setTimeout needed
  const startItemTimerRef = useRef((durationMs: number, onExpire: () => void) => {
    scheduleItem(durationMs, onExpire);
  });
  useEffect(() => {
    startItemTimerRef.current = (durationMs: number, onExpire: () => void) => {
      scheduleItem(durationMs, onExpire);
    };
  }, [scheduleItem]);

  // Backward-compat wrappers
  const onSessionItemProcessed = useCallback((count = 1) => {
    recordProcessed(count);
  }, [recordProcessed]);

  const recalcSessionRemaining = useCallback(() => {
    setEngineSpeed(defaultItemMsRef.current, {});
  }, [defaultItemMsRef, setEngineSpeed]);

  const suppressScrollRef = useRef(false);

  // Session hydration on mount
  useEffect(() => {
    if (hasHydratedRef.current) return;
    
    const resolvedSessionId = sessionIdParam || activeSessionId;
    if (!resolvedSessionId || !isResumeParam) {
      // Normal entry — use localStorage fallback
      window.scrollTo({ top: 0, behavior: 'auto' });
      const startPage = localStorage.getItem('quran-app-tahfeez-start-page');
      if (startPage) {
        localStorage.removeItem('quran-app-tahfeez-start-page');
        const p = parseInt(startPage, 10);
        if (!isNaN(p) && p >= 1 && p <= 604) goToPage(p);
      }
      hasHydratedRef.current = true;
      return;
    }

    const session = getSession(resolvedSessionId);
    if (!session || !session.resumeState) {
      // No resumeState — fallback to currentPage
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (session?.currentPage) goToPage(session.currentPage);
      hasHydratedRef.current = true;
      // Clean up URL params
      setSearchParams({}, { replace: true });
      return;
    }

    // Full hydration from resumeState
    const rs = session.resumeState;
    hasHydratedRef.current = true;
    isHydratingSessionRef.current = true;
    
    // Clean URL params
    setSearchParams({}, { replace: true });
    
    if (rs.kind === 'tahfeez-auto' || rs.kind === 'tahfeez-test') {
      const autoRs = rs as TahfeezAutoResumeState | TahfeezTestResumeState;
      
      // Restore engine state from resumeState
      restoreEngine({
        phase: rs.sessionPhase === 'running' ? 'running' : rs.sessionPhase === 'completed' ? 'completed' : 'paused',
        currentPage: rs.currentPage,
        sessionRemainingMs: autoRs.sessionRemainingMs || 0,
        currentItemRemainingMs: ('remainingMs' in autoRs ? autoRs.remainingMs : 0) || 0,
        currentRevealIdx: autoRs.currentRevealIdx || 0,
        activeBlankKey: autoRs.activeBlankKey,
        revealedKeys: autoRs.revealedKeys || [],
        blankedKeysList: autoRs.blankedKeysList || [],
        showAll: autoRs.showAll || false,
        pageStates: (autoRs.pageStates || {}) as Record<number, EnginePageState>,
        pageSchedules: (autoRs as any).pageSchedules || {},
        sessionPages: (autoRs as any).sessionPages || [],
        unregisteredPages: (autoRs as any).unregisteredPages || {},
        defaultItemMs: ((autoRs.timerSeconds || 1) * 1000),
        plannedTotalMs: (autoRs as any).plannedTotalMs ?? 0,
        realElapsedMs: (autoRs as any).realElapsedMs ?? 0,
      });
      
      // Restore settings
      if (autoRs.quizInteraction) setQuizInteraction(autoRs.quizInteraction as any);
      if (autoRs.quizScope) setQuizScope(autoRs.quizScope as any);
      if (autoRs.quizScopeFrom) setQuizScopeFrom(autoRs.quizScopeFrom);
      if (autoRs.quizScopeTo) setQuizScopeTo(autoRs.quizScopeTo);
      if (autoRs.quizSource) setQuizSource(autoRs.quizSource as any);
      if (autoRs.timerSeconds) setTimerSeconds(autoRs.timerSeconds);
      if (autoRs.firstWordTimerSeconds) setFirstWordTimerSeconds(autoRs.firstWordTimerSeconds);
      
      // Suppress scrollToTop when page changes during hydration
      suppressScrollRef.current = true;
      
      // b) Navigate to saved page
      goToPage(rs.currentPage);
      prevPageRef.current = rs.currentPage;
      setQuizPageIdx(autoRs.quizPageIdx);
      
      // c) After render: restore page state, then start quiz
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Restore current page's visual state
          setBlankedKeysList(autoRs.blankedKeysList);
          blankedKeysListRef.current = autoRs.blankedKeysList;
          setRevealedKeys(new Set(autoRs.revealedKeys));
          setActiveBlankKey(autoRs.activeBlankKey);
          setShowAll(autoRs.showAll);
          
          if (autoRs.currentRevealIdx !== undefined) {
            setCurrentRevealIdx(autoRs.currentRevealIdx);
            currentRevealIdxRef.current = autoRs.currentRevealIdx;
          }
          
          // d) Start quiz
          setQuizStarted(true);
          setHideBars(!!rs.hideChrome);
          
          if (rs.sessionPhase === 'paused' || rs.sessionPhase === 'completed') {
            setIsPaused(true);
            // Engine already restored as paused
          } else {
            setIsPaused(false);
            autoResumeQuizRef.current = true;
            // Start the engine's RAF timer for running sessions
            startRaf();
          }
          
          // Scroll to saved position
          if (rs.currentScrollTop !== undefined && rs.currentScrollTop > 0) {
            window.scrollTo({ top: rs.currentScrollTop!, behavior: 'auto' });
          } else if (rs.currentAnchorKey) {
            const el = document.querySelector<HTMLElement>(`[data-key="${rs.currentAnchorKey}"]`);
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
          
          // e) Hydration complete
          isHydratingSessionRef.current = false;
          suppressScrollRef.current = false;
        });
      });
      
      markSessionResumed(resolvedSessionId);
      toast.success('تم استئناف الجلسة');
    } else {
      isHydratingSessionRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on page change (suppressed during resume hydration)
  useEffect(() => {
    if (suppressScrollRef.current || isHydratingSessionRef.current) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentPage]);

  // (auto-save block moved below state declarations)

  const [quizStarted, setQuizStarted] = useState(false);
  const [storeWhileQuiz, setStoreWhileQuiz] = useState(false);
  const [segmentMcqAccumulatedStats, setSegmentMcqAccumulatedStats] = useState<SegmentMCQStats | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  useKeepAwake(keepScreenAwake && quizStarted && !isPaused);
  const [showAll, setShowAll] = useState(false);
  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [blankedKeysList, setBlankedKeysList] = useState<string[]>([]);
  const [firstKeysSet, setFirstKeysSet] = useState<Set<string>>(new Set());
  const [currentRevealIdx, setCurrentRevealIdx] = useState(-1);
  const currentRevealIdxRef = useRef(-1);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [advanceGeneration, setAdvanceGeneration] = useState(0);
  const [showIndex, setShowIndex] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  const [indexTab, setIndexTab] = useState('surahs');
  const [hideBars, setHideBars] = useState(false);
  const [pinchScale, setPinchScale] = useState(1);
  const [runtimeDebug, setRuntimeDebug] = useState<{
    generationPath: string;
    reviewMode: string;
    actualSelectedAyatCount: number;
    actualSelectedWordCount: number;
    renderedKeysCount: number;
    consumedKeysCount: number;
  } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const [quizPageIdx, setQuizPageIdx] = useState(0);
  const quizPageIdxRef = useRef(0);
  useEffect(() => { quizPageIdxRef.current = quizPageIdx; }, [quizPageIdx]);
  const pendingStartPageRef = useRef<number | null>(null);
  const pageObserverGenerationRef = useRef(0);
  const renderedQuizPageRef = useRef(currentPage);

  const areOrderedKeysEqual = useCallback((a: string[] | undefined, b: string[] | undefined) => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }, []);

  const isPageStateCompatibleWithRenderedKeys = useCallback((
    savedPageState: Pick<PageState, 'blankedKeysList'> | Pick<EnginePageState, 'blankedKeysList'> | null | undefined,
    renderedKeys: string[],
  ) => {
    if (!savedPageState) return false;
    return areOrderedKeysEqual(savedPageState.blankedKeysList, renderedKeys);
  }, [areOrderedKeysEqual]);

  const resolveResumeIndex = useCallback((
    savedPageState: Pick<PageState, 'revealedKeys' | 'currentRevealIdx' | 'activeBlankKey' | 'showAll'>
      | Pick<EnginePageState, 'revealedKeys' | 'currentRevealIdx' | 'activeBlankKey' | 'showAll'>
      | null
      | undefined,
    renderedKeys: string[],
  ) => {
    if (renderedKeys.length === 0) return -1;
    if (!savedPageState || savedPageState.showAll) return renderedKeys.length;

    const revealedSet = new Set(savedPageState.revealedKeys || []);

    if (savedPageState.activeBlankKey && !revealedSet.has(savedPageState.activeBlankKey)) {
      const activeIdx = renderedKeys.indexOf(savedPageState.activeBlankKey);
      if (activeIdx >= 0) return activeIdx;
    }

    if (
      typeof savedPageState.currentRevealIdx === 'number'
      && savedPageState.currentRevealIdx >= 0
      && savedPageState.currentRevealIdx < renderedKeys.length
    ) {
      const keyAtIdx = renderedKeys[savedPageState.currentRevealIdx];
      if (!revealedSet.has(keyAtIdx)) return savedPageState.currentRevealIdx;
    }

    const firstUnrevealedIdx = renderedKeys.findIndex((key) => !revealedSet.has(key));
    return firstUnrevealedIdx >= 0 ? firstUnrevealedIdx : renderedKeys.length;
  }, []);

  const restartAutoRevealFrom = useCallback((idx: number, activeKey?: string | null) => {
    currentRevealIdxRef.current = idx;
    setCurrentRevealIdx(idx);
    setActiveBlankKey(idx >= 0 ? (activeKey ?? blankedKeysListRef.current[idx] ?? null) : null);
    setAdvanceGeneration(g => g + 1);
  }, []);

  // Guard against stale persisted tab values from older app versions
  useEffect(() => {
    const validTabs: Array<typeof activeTab> = ['store', 'custom-quiz', 'auto-quiz', 'srs-review'];
    if (!validTabs.includes(activeTab)) {
      setActiveTab('auto-quiz');
    }
  }, [activeTab, setActiveTab]);

  // Never keep "hide bars" active outside an active quiz
  useEffect(() => {
    if (!quizStarted && hideBars) setHideBars(false);
  }, [quizStarted, hideBars]);

  const shouldHideTopBars = hideBars && quizStarted;

  // MCQ state
  const [mcqStats, setMcqStats] = useState<MCQStats>({ correct: 0, wrong: 0, total: 0, startTime: Date.now(), answers: [] });
  const [mcqShowResults, setMcqShowResults] = useState(false);
  const [mcqCurrentIdx, setMcqCurrentIdx] = useState(0);
  const [allPageWordTexts, setAllPageWordTexts] = useState<string[]>([]);

  // Refs to always read latest values inside setTimeout chains (avoids stale closures)
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  const quizPagesRangeRef = useRef<number[]>([]);
  // Flag: true when quiz just started for the first time (not a page transition)
  const isFirstStartRef = useRef(false);

  // Keep blankedKeysList in a ref so advance() always reads the latest (avoid stale closure)
  const blankedKeysListRef = useRef<string[]>(blankedKeysList);
  useEffect(() => { blankedKeysListRef.current = blankedKeysList; }, [blankedKeysList]);

  // Keep firstKeysSet in a ref
  const firstKeysSetRef = useRef<Set<string>>(firstKeysSet);
  useEffect(() => { firstKeysSetRef.current = firstKeysSet; }, [firstKeysSet]);

  // Keep timerSeconds in refs
  const timerSecondsRef = useRef(timerSeconds);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);
  const firstWordTimerSecondsRef = useRef(firstWordTimerSeconds);
  useEffect(() => { firstWordTimerSecondsRef.current = firstWordTimerSeconds; }, [firstWordTimerSeconds]);

  // Voice mode refs
  const voiceModeRef = useRef(voiceMode);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  const matchLevelRef = useRef(matchLevel);
  useEffect(() => { matchLevelRef.current = matchLevel; }, [matchLevel]);
  const wordTextsMapRef = useRef<Record<string, string>>({});
  const speechRef = useRef(speech);
  useEffect(() => { speechRef.current = speech; }, [speech]);
  
  // Key groups refs for reveal granularity
  const ayahKeyGroupsRef = useRef<string[][]>([]);
  const waqfKeyGroupsRef = useRef<string[][]>([]);
  const revealGranularityRef = useRef(revealGranularity);
  useEffect(() => { revealGranularityRef.current = revealGranularity; }, [revealGranularity]);

  // Compute pages range for multi-page quiz
  const quizPagesRange = useMemo(() => {
    // Helper: get pages with stored items (for custom quiz source)
    const filterToStoredPages = (pages: number[]) => {
      if (quizSource !== 'custom' || storedItems.length === 0) return pages;
      const storedPageSet = new Set(storedItems.map(i => i.data.page));
      const filtered = pages.filter(p => storedPageSet.has(p));
      return filtered.length > 0 ? filtered : pages;
    };

    if (quizScope === 'current-page') return [currentPage];
    if (quizScope === 'page-range') {
      const from = Math.min(quizScopeFrom, quizScopeTo);
      const to = Math.max(quizScopeFrom, quizScopeTo);
      const pages: number[] = [];
      for (let p = from; p <= Math.min(to, 604); p++) pages.push(p);
      return filterToStoredPages(pages);
    }
    if (quizScope === 'surah') {
      const surahNum = quizScopeFrom;
      const surahInfo = SURAH_INFO[surahNum];
      if (!surahInfo) return [currentPage];
      const startPage = surahInfo[0];
      // Find end page: next surah start - 1, or 604
      const nextSurah = SURAHS.find(s => s.number === surahNum + 1);
      const endPage = nextSurah ? nextSurah.startPage - 1 : 604;
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) pages.push(p);
      return filterToStoredPages(pages);
    }
    if (quizScope === 'juz') {
      const fromJuz = Math.min(quizScopeFrom, quizScopeTo);
      const toJuz = Math.max(quizScopeFrom, quizScopeTo);
      const startPage = JUZ_DATA[Math.max(0, fromJuz - 1)]?.page || 1;
      const endPage = toJuz < 30 ? (JUZ_DATA[toJuz]?.page || 605) - 1 : 604;
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) pages.push(p);
      return filterToStoredPages(pages);
    }
    if (quizScope === 'hizb') {
      const fromHizb = Math.min(quizScopeFrom, quizScopeTo);
      const toHizb = Math.max(quizScopeFrom, quizScopeTo);
      // Each juz has 2 hizbs
      const fromJuzIdx = Math.floor((fromHizb - 1) / 2);
      const fromJuz = JUZ_DATA[fromJuzIdx];
      const toJuzIdx = Math.floor((toHizb - 1) / 2);
      const isSecondHalf = (fromHizb - 1) % 2 === 1;
      const toIsSecondHalf = (toHizb - 1) % 2 === 1;
      
      const startPage = isSecondHalf
        ? Math.floor((fromJuz.page + (JUZ_DATA[fromJuzIdx + 1]?.page || 605)) / 2)
        : fromJuz.page;
      
      let endPage: number;
      if (toIsSecondHalf) {
        endPage = (toJuzIdx + 1 < 30 ? JUZ_DATA[toJuzIdx + 1].page : 605) - 1;
      } else {
        const juzEnd = JUZ_DATA[toJuzIdx + 1]?.page || 605;
        endPage = Math.floor((JUZ_DATA[toJuzIdx].page + juzEnd) / 2) - 1;
      }
      const pages: number[] = [];
      for (let p = startPage; p <= Math.min(endPage, 604); p++) pages.push(p);
      return filterToStoredPages(pages);
    }
    return [currentPage];
  }, [quizScope, quizScopeFrom, quizScopeTo, currentPage, quizSource, storedItems]);

  // Keep quizPagesRange in a ref so setTimeout callbacks always read the latest array
  useEffect(() => { quizPagesRangeRef.current = quizPagesRange; }, [quizPagesRange]);

  const resolveQuizPagesRange = useCallback(() => {
    const liveRange = quizPagesRange.length > 0
      ? quizPagesRange
      : quizPagesRangeRef.current.length > 0
        ? quizPagesRangeRef.current
        : [currentPageRef.current];

    quizPagesRangeRef.current = liveRange;
    return liveRange;
  }, [quizPagesRange]);

  // ── Auto-save session state (throttled) ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef<string>('');

  const buildResumeState = useCallback((): TahfeezAutoResumeState | TahfeezTestResumeState | null => {
    const sessionId = sessionIdParam || activeSessionId;
    if (!sessionId) return null;
    const session = getSession(sessionId);
    if (!session) return null;
    
    const isTahfeezAuto = session.type === 'tahfeez-auto';
    const kind = isTahfeezAuto ? 'tahfeez-auto' as const : 'tahfeez-test' as const;
      const snapshotPage = renderedQuizPageRef.current || currentPage;
      const snapshotPageState = snapshotPage === currentPage
        ? {
            revealedKeys: Array.from(revealedKeys),
            blankedKeysList: blankedKeysListRef.current,
            showAll,
            currentRevealIdx: currentRevealIdxRef.current,
            activeBlankKey,
            scrollTop: window.scrollY,
          }
        : pageStatesRef.current[snapshotPage] || {
            revealedKeys: Array.from(revealedKeys),
            blankedKeysList: blankedKeysListRef.current,
            showAll,
            currentRevealIdx: currentRevealIdxRef.current,
            activeBlankKey,
            scrollTop: window.scrollY,
          };
      const snapshotQuizPageIdx = Math.max(0, resolveQuizPagesRange().indexOf(snapshotPage));
    
    // Determine session phase: only 'completed' if ALL items processed
    const totalItems = getTotalItems();
    const processedItems = getProcessedItems();
    const isSessionComplete = totalItems > 0 && processedItems >= totalItems;
    const sessionPhase = isPaused ? 'paused' : isSessionComplete ? 'completed' : quizStarted ? 'running' : 'paused';
    
    // Use engine snapshot for remaining time
      const engineSnap = snapshotEngine(snapshotPage, {
        revealedKeys: snapshotPageState.revealedKeys,
        blankedKeysList: snapshotPageState.blankedKeysList,
        showAll: snapshotPageState.showAll,
        currentRevealIdx: snapshotPageState.currentRevealIdx,
        activeBlankKey: snapshotPageState.activeBlankKey,
        scrollTop: snapshotPageState.scrollTop,
    });
    
    return {
      kind,
        currentPage: snapshotPage,
      sessionPhase: sessionPhase as 'running' | 'paused' | 'completed',
      hideChrome: hideBars,
        currentRevealIdx: snapshotPageState.currentRevealIdx,
        currentAnchorKey: snapshotPageState.activeBlankKey,
        currentScrollTop: snapshotPageState.scrollTop,
        blankedKeysList: snapshotPageState.blankedKeysList,
        revealedKeys: snapshotPageState.revealedKeys,
        activeBlankKey: snapshotPageState.activeBlankKey,
        revealOrder: snapshotPageState.blankedKeysList,
      hiddenWords: [],
      activeBlanks: [],
        quizPageIdx: snapshotQuizPageIdx >= 0 ? snapshotQuizPageIdx : quizPageIdx,
        showAll: snapshotPageState.showAll,
      remainingMs,
      expectedEndAt: null,
      timerSeconds,
      firstWordTimerSeconds,
      quizInteraction,
      quizScope,
      quizScopeFrom,
      quizScopeTo,
      quizSource,
      distributionSeed: useTahfeezStore.getState().distributionSeed,
      sessionTimerMode: 'countup',
      sessionElapsedMs: 0,
      sessionRemainingMs: engineSnap.sessionRemainingMs,
      sessionStartedAt: null,
      pausedAt: isPaused ? Date.now() : null,
      isPaused,
      sessionTotalItems: totalItems,
      sessionProcessedItems: processedItems,
      pageStates: engineSnap.pageStates as any,
      // Store engine schedule data for exact restore
      pageSchedules: engineSnap.pageSchedules,
      sessionPages: engineSnap.sessionPages,
      unregisteredPages: engineSnap.unregisteredPages,
    } as any;
  }, [currentPage, isPaused, showAll, quizStarted, hideBars, revealedKeys, activeBlankKey, quizPageIdx, timerSeconds, firstWordTimerSeconds, quizInteraction, quizScope, quizScopeFrom, quizScopeTo, quizSource, activeSessionId, sessionIdParam, getSession, getProcessedItems, getTotalItems, remainingMs, snapshotEngine]);

  // Throttled auto-save
  useEffect(() => {
    if (!quizStarted) return;
    const sessionId = sessionIdParam || activeSessionId;
    if (!sessionId) return;
    
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const rs = buildResumeState();
      if (!rs) return;
      const sig = JSON.stringify(rs);
      if (sig !== lastSavedStateRef.current) {
        lastSavedStateRef.current = sig;
        saveResumeState(sessionId, rs);
        const total = blankedKeysListRef.current.length;
        const revealed = revealedKeys.size;
        const progress = total > 0 ? Math.round((revealed / total) * 100) : 0;
        updateSession(sessionId, { currentPage, progress });
      }
    }, 800);
    
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [quizStarted, currentPage, revealedKeys, activeBlankKey, isPaused, showAll, quizPageIdx, buildResumeState, saveResumeState, updateSession, activeSessionId, sessionIdParam]);

  // Save on unmount / visibility change — pause running sessions
  useEffect(() => {
    const saveOnExit = () => {
      const sessionId = sessionIdParam || activeSessionId;
      if (!sessionId || !quizStarted) return;
      // Pause engine to capture remaining ms
      pauseEngine();
      const rs = buildResumeState();
      if (rs) {
        // Force session phase to 'paused' on exit (not completed)
        if (rs.sessionPhase === 'running') {
          rs.sessionPhase = 'paused';
          rs.isPaused = true;
          rs.pausedAt = Date.now();
        }
        saveResumeState(sessionId, rs);
        markSessionPaused(sessionId);
      }
    };

    const handleVisChange = () => {
      if (document.hidden) saveOnExit();
    };

    document.addEventListener('visibilitychange', handleVisChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange);
      saveOnExit();
    };
  }, [quizStarted, buildResumeState, saveResumeState, activeSessionId, sessionIdParam, pauseEngine, markSessionPaused]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: pinchScale };
      } else if (e.touches.length === 1) {
        swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTime: Date.now() };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = Math.min(3, Math.max(0.5, pinchRef.current.startScale * (dist / pinchRef.current.startDist)));
        setPinchScale(newScale);
      }
      if (e.touches.length === 1 && swipeRef.current) {
        const dy = Math.abs(e.touches[0].clientY - swipeRef.current.startY);
        const dx = Math.abs(e.touches[0].clientX - swipeRef.current.startX);
        if (dy > dx * 1.5) swipeRef.current = null;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (swipeRef.current && e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
        const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.startY);
        const elapsed = Date.now() - swipeRef.current.startTime;
        const absDx = Math.abs(dx);
        if (absDx > 60 && elapsed < 400 && absDx > dy * 1.5) {
          if (dx < 0) nextPage();
          else prevPage();
        }
      }
      swipeRef.current = null;
      pinchRef.current = null;
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pinchScale, nextPage, prevPage]);

  // Reset quiz state when page changes during an active quiz AND auto-restart
  const prevPageRef = useRef(currentPage);
  const autoResumeQuizRef = useRef(false);
  const autoStartHandledPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (!quizStarted) {
      prevPageRef.current = currentPage;
      autoStartHandledPageRef.current = null;
    }
  }, [currentPage, quizStarted]);

  const completeQuizSession = useCallback(() => {
    completeEngine();
    setShowAll(true);
    setActiveBlankKey(null);
    speechRef.current.stop();
  }, [completeEngine]);

  const advanceToNextQuizPage = useCallback(() => {
    const range = resolveQuizPagesRange();
    if (range.length === 0) return false;

    const exactIdx = range.indexOf(currentPageRef.current);
    const currentIdx = exactIdx >= 0
      ? exactIdx
      : Math.max(0, Math.min(quizPageIdxRef.current, range.length - 1));
    const nextIdx = currentIdx + 1;

    if (nextIdx >= range.length) return false;

    quizPageIdxRef.current = nextIdx;
    setQuizPageIdx(nextIdx);
    autoResumeQuizRef.current = true;
    goToPage(range[nextIdx]);
    return true;
  }, [goToPage, resolveQuizPagesRange]);

  useEffect(() => {
    if (!quizStarted) return;
    if (isHydratingSessionRef.current) return;
    if (prevPageRef.current !== currentPage) {
      const oldPage = prevPageRef.current;
      prevPageRef.current = currentPage;
      autoStartHandledPageRef.current = null;
      // Clear all timers first
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      
      // Save old page state through engine (preserves partial active-item timing)
      const savedPageState = navigateToQuizPage(oldPage, currentPage, {
        revealedKeys: Array.from(revealedKeys),
        blankedKeysList: blankedKeysListRef.current,
        showAll,
        currentRevealIdx: currentRevealIdxRef.current,
        activeBlankKey,
        scrollTop: window.scrollY,
      });
      if (savedPageState) {
        // Restore previously visited page (even if revealedKeys is empty)
        setRevealedKeys(new Set(savedPageState.revealedKeys));
        setBlankedKeysList(savedPageState.blankedKeysList);
        blankedKeysListRef.current = savedPageState.blankedKeysList;
        setShowAll(savedPageState.showAll);
        currentRevealIdxRef.current = savedPageState.currentRevealIdx;
        setCurrentRevealIdx(savedPageState.currentRevealIdx);
        setActiveBlankKey(savedPageState.activeBlankKey);
        setFirstKeysSet(new Set());
        setIsPaused(false);
        // If page was completed, don't auto-advance; otherwise resume from saved idx
        if (savedPageState.showAll) {
          autoResumeQuizRef.current = false;
        } else {
          autoResumeQuizRef.current = true;
        }
      } else {
        // Fresh page — reset for new content
        setShowAll(false);
        setRevealedKeys(new Set());
        setActiveBlankKey(null);
        currentRevealIdxRef.current = -1;
        setCurrentRevealIdx(-1);
        setBlankedKeysList([]);
        setFirstKeysSet(new Set());
        setIsPaused(false);
        // Flag to auto-start when blanked keys are loaded from DOM
        autoResumeQuizRef.current = true;
      }
    }
  }, [currentPage, quizStarted]);

  // Read blanked keys from the quiz view after it renders.
  // Uses MutationObserver for instant detection instead of slow polling.
  // If page has no blanked items after timeout → skip to next page automatically.
  useEffect(() => {
    if (!quizStarted) return;
    // Segment MCQ modes handle their own navigation — skip the blanked-keys observer entirely
    if (autoBlankMode === 'next-ayah-mcq' || autoBlankMode === 'next-waqf-mcq') return;

    const observerGeneration = ++pageObserverGenerationRef.current;
    const effectPage = currentPage;

    let hasReceivedKeys = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let lastKeysSig = '';
    let lastFirstKeysSig = '';
    let lastWordTextsSig = '';
    let lastAyahGroupsSig = '';
    let lastWaqfGroupsSig = '';
    let lastRuntimeDebugSig = '';

    const processKeys = (el: HTMLElement) => {
      try {
        if (observerGeneration !== pageObserverGenerationRef.current) return false;
        if (effectPage !== currentPageRef.current) return false;
        // Verify the element belongs to the current render page (avoid stale data from previous page)
        const elPage = el.getAttribute('data-page');
        if (!elPage || Number(elPage) !== effectPage) return false;

        const keysSig = el.getAttribute('data-keys') || '[]';
        const firstKeysSig = el.getAttribute('data-first-keys') || '[]';
        const wordTextsSig = el.getAttribute('data-word-texts') || '{}';
        const ayahGroupsSig = el.getAttribute('data-ayah-groups') || '[]';
        const waqfGroupsSig = el.getAttribute('data-waqf-groups') || '[]';

        const keys = JSON.parse(keysSig);
        const fKeys = JSON.parse(firstKeysSig);
        const wordTexts = JSON.parse(wordTextsSig);
        const ayahGrps = JSON.parse(ayahGroupsSig);
        const waqfGrps = JSON.parse(waqfGroupsSig);

        if (keys.length > 0) {
          hasReceivedKeys = true;
          renderedQuizPageRef.current = effectPage;
          currentPageRef.current = effectPage;

          const keysChanged = keysSig !== lastKeysSig;
          const fKeysChanged = firstKeysSig !== lastFirstKeysSig;

          if (keysChanged) {
            lastKeysSig = keysSig;
            blankedKeysListRef.current = keys;
            setBlankedKeysList(keys);
          }

          if (fKeysChanged) {
            lastFirstKeysSig = firstKeysSig;
            firstKeysSetRef.current = new Set(fKeys);
            setFirstKeysSet(new Set(fKeys));
          }

          // Register exact per-item durations with engine when keys or firstKeys change
          if (keysChanged || fKeysChanged) {
            const fSet = new Set(fKeys);
            const defaultMs = timerSecondsRef.current * 1000;
            const fwMs = firstWordTimerSecondsRef.current * 1000;
            const durations = (keys as string[]).map(k =>
              fSet.has(k) ? fwMs + defaultMs : defaultMs
            );
            // Check if this page already has consumed items (restored page)
            const existingSched = enginePageSchedulesRef.current[effectPage];
            const consumed = existingSched ? existingSched.consumed : 0;
            registerPageDurations(effectPage, durations, consumed);
          }

          if (wordTextsSig !== lastWordTextsSig) {
            lastWordTextsSig = wordTextsSig;
            wordTextsMapRef.current = wordTexts;
            // Collect all word texts on this page for MCQ distractors
            setAllPageWordTexts(Object.values(wordTexts));
          }

          if (ayahGroupsSig !== lastAyahGroupsSig) {
            lastAyahGroupsSig = ayahGroupsSig;
            ayahKeyGroupsRef.current = ayahGrps;
          }

          if (waqfGroupsSig !== lastWaqfGroupsSig) {
            lastWaqfGroupsSig = waqfGroupsSig;
            waqfKeyGroupsRef.current = waqfGrps;
          }

          const generationPath = el.getAttribute('data-generation-path') || 'unknown';
          const reviewModeValue = el.getAttribute('data-review-mode') || 'unknown';
          const actualSelectedAyatCount = Number(el.getAttribute('data-actual-selected-ayat') || '0');
          const actualSelectedWordCount = Number(el.getAttribute('data-actual-selected-words') || '0');
          const runtimeSig = `${generationPath}|${reviewModeValue}|${actualSelectedAyatCount}|${actualSelectedWordCount}|${keys.length}|${blankedKeysListRef.current.length}`;
          if (runtimeSig !== lastRuntimeDebugSig) {
            lastRuntimeDebugSig = runtimeSig;
            setRuntimeDebug({
              generationPath,
              reviewMode: reviewModeValue,
              actualSelectedAyatCount,
              actualSelectedWordCount,
              renderedKeysCount: keys.length,
              consumedKeysCount: blankedKeysListRef.current.length,
            });
          }

          // Auto-resume after page transition OR first start
          if (autoResumeQuizRef.current || isFirstStartRef.current) {
            if (autoStartHandledPageRef.current === effectPage) {
              autoResumeQuizRef.current = false;
              isFirstStartRef.current = false;
              return true;
            }

            autoStartHandledPageRef.current = effectPage;
            autoResumeQuizRef.current = false;
            const isFirst = isFirstStartRef.current;
            isFirstStartRef.current = false;
            
            // Check if we have saved state for this page (don't reset if so)
            const savedPS = pageStatesRef.current[effectPage];
            const canUseSavedPageState = !isFirst && isPageStateCompatibleWithRenderedKeys(savedPS, keys);

            if (savedPS && !isFirst && !canUseSavedPageState) {
              console.warn('[tahfeez] Ignoring stale saved page state for page', effectPage);
            }

            if (savedPS && canUseSavedPageState) {
              // Restore from saved page state — don't reset revealed keys
              console.log('[tahfeez] Restoring saved page state for page', effectPage);
              setRevealedKeys(new Set(savedPS.revealedKeys));
              setBlankedKeysList(savedPS.blankedKeysList);
              blankedKeysListRef.current = savedPS.blankedKeysList;
              setShowAll(savedPS.showAll);
              setActiveBlankKey(savedPS.activeBlankKey);
              currentRevealIdxRef.current = savedPS.currentRevealIdx;
              setCurrentRevealIdx(savedPS.currentRevealIdx);
              if (!savedPS.showAll) {
                const resumeIdx = resolveResumeIndex(savedPS, keys);
                if (resumeIdx >= 0 && resumeIdx < keys.length) {
                  restartAutoRevealFrom(resumeIdx, keys[resumeIdx] ?? null);
                }
              }
            } else {
              // Fresh page — reset
              console.log('[tahfeez] Starting fresh page, keys count:', keys.length);
              setRevealedKeys(new Set());
              setShowAll(false);
              setActiveBlankKey(null);
              if (quizInteraction === 'mcq') {
                setMcqCurrentIdx(0);
                setActiveBlankKey(keys[0]);
                setMcqStats(prev => ({ ...prev, total: keys.length }));
              } else if (quizInteraction === 'tap-only') {
                setActiveBlankKey(keys[0]);
              } else {
                restartAutoRevealFrom(0, keys[0] ?? null);
              }
            }
          }
          return true;
        }
      } catch {}
      return false;
    };

    // Try immediately (element may already be rendered)
    const el = document.querySelector<HTMLElement>(`#tahfeez-blanked-keys[data-page="${currentPage}"]`);
    if (el) processKeys(el);

    // Use MutationObserver to keep parent sequencing synced with rendered keys.
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(`#tahfeez-blanked-keys[data-page="${currentPage}"]`);
      if (el) processKeys(el);
    });

    // Observe the entire container for subtree changes and attribute mutations
    const container = document.body;
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-keys', 'data-first-keys', 'data-word-texts', 'data-ayah-groups', 'data-waqf-groups', 'data-page', 'data-generation-path', 'data-review-mode', 'data-actual-selected-ayat', 'data-actual-selected-words'],
    });

    // Fallback timeout: if no keys after 5s, skip page
    fallbackTimer = setTimeout(() => {
      if (hasReceivedKeys) return;
      observer.disconnect();
      if (autoResumeQuizRef.current || isFirstStartRef.current) {
        autoResumeQuizRef.current = false;
        isFirstStartRef.current = false;
        const autoplaySettings = useSettingsStore.getState().settings.autoplay;
        const delayMs = (autoplaySettings.autoAdvanceDelay || 1.5) * 1000;
        console.log('[tahfeez] No blanked keys on page', currentPageRef.current, '— skipping to next in', delayMs, 'ms');

        setTimeout(() => {
          const range = quizPagesRangeRef.current;
          if (range.length > 1) {
            if (!advanceToNextQuizPage()) completeQuizSession();
          } else {
            nextPage();
          }
        }, delayMs);
      }
    }, 5000);

    return () => {
      observer.disconnect();
      if (pageObserverGenerationRef.current === observerGeneration) {
        pageObserverGenerationRef.current += 1;
      }
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, currentPage, autoBlankMode, quizInteraction, advanceToNextQuizPage, completeQuizSession, enginePageSchedulesRef, registerPageDurations, restartAutoRevealFrom]);

  // Ref for session item processed callback (used inside advance() to avoid stale closure)
  const onSessionItemProcessedRef = useRef(onSessionItemProcessed);
  useEffect(() => { onSessionItemProcessedRef.current = onSessionItemProcessed; }, [onSessionItemProcessed]);

  // Refs for advance chain callbacks (avoid unstable deps in auto-reveal effect)
  const advanceToNextQuizPageRef = useRef(advanceToNextQuizPage);
  useEffect(() => { advanceToNextQuizPageRef.current = advanceToNextQuizPage; }, [advanceToNextQuizPage]);
  const completeQuizSessionRef = useRef(completeQuizSession);
  useEffect(() => { completeQuizSessionRef.current = completeQuizSession; }, [completeQuizSession]);

  // Auto-reveal sequencing
  // IMPORTANT: Does NOT depend on currentRevealIdx state to avoid re-triggering.
  // advance() chains itself via setTimeout. The effect only starts/stops the chain.
  useEffect(() => {
    if (!quizStarted || isPaused || showAll || blankedKeysListRef.current.length === 0) return;
    // Skip auto-reveal chain in MCQ and tap-only modes
    if (quizInteraction === 'mcq' || quizInteraction === 'tap-only') return;
    // Don't start if currentRevealIdx ref is still -1 (waiting for auto-resume)
    if (currentRevealIdxRef.current < 0) return;

    // Mark: we only start the chain once per effect run
    const startIdx = currentRevealIdxRef.current;
    currentRevealIdxRef.current = startIdx;

    // ── advance() for Tahfeez ─────────────────────────────────────────────────
    // Uses REFS exclusively to avoid stale closures in nested setTimeout chains.
    // Does NOT call setCurrentRevealIdx to avoid re-triggering this effect.
    const advance = (idx: number) => {
      try {
        // Always read from refs — never from closure state
        const list = blankedKeysListRef.current;
        const total = list.length;
        const isEndOfPage = idx >= total;

        // Update ref for external tracking (no effect re-trigger)
        currentRevealIdxRef.current = idx;

        console.log('[tahfeez][advance]', JSON.stringify({
          portal: 'تحفيظ',
          currentPage: currentPageRef.current,
          itemsCount: total,
          index: idx,
          endDetected: isEndOfPage,
        }));

        if (isEndOfPage) {
          setShowAll(true);
          setActiveBlankKey(null);
          speechRef.current.stop(); // Stop mic at end of page
          const autoplaySettings = useSettingsStore.getState().settings.autoplay;
          const delayMs = (autoplaySettings.autoAdvanceDelay || 1.5) * 1000;

          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = setTimeout(() => {
            try {
              const curPage = currentPageRef.current;
              const range = quizPagesRangeRef.current;
              const currentPageIdx = range.indexOf(curPage);

              console.log('[tahfeez][advance] END OF PAGE → curPage:', curPage, 'rangeIdx:', currentPageIdx, '/', range.length - 1);

              if (range.length > 1) {
                if (!advanceToNextQuizPageRef.current()) completeQuizSessionRef.current();
              } else if (range.length <= 1) {
                autoResumeQuizRef.current = true;
                nextPage();
              }
            } catch (err) {
              console.error('[tahfeez] Error in auto-advance:', err);
              setShowAll(true);
            }
          }, delayMs);
          return;
        }

        const key = list[idx];
        if (!key) {
          console.warn('[tahfeez] No key at index', idx, '— stopping');
          setShowAll(true);
          return;
        }
        const isFirstKey = firstKeysSetRef.current.has(key);

        const useVoice = voiceModeRef.current;
        const wordText = wordTextsMapRef.current[key] || '';

        const revealAndAdvance = () => {
          const granularity = revealGranularityRef.current;
          const groups = granularity === 'ayah' ? ayahKeyGroupsRef.current : granularity === 'waqf-segment' ? waqfKeyGroupsRef.current : null;
          
          if (groups && groups.length > 0) {
            const groupIdx = groups.findIndex(g => g.includes(key));
            const groupKeys = groupIdx >= 0 ? groups[groupIdx] : [key];
            
            if (singleWordMode) {
              setRevealedKeys(new Set(groupKeys));
            } else {
              setRevealedKeys(prev => {
                const next = new Set(prev);
                groupKeys.forEach(k => next.add(k));
                return next;
              });
            }
            setActiveBlankKey(null);
            // Decrement session remaining for each revealed item in the group
            groupKeys.forEach(() => onSessionItemProcessedRef.current());
            const lastGroupKey = groupKeys[groupKeys.length - 1];
            const lastIdx = list.indexOf(lastGroupKey);
            const nextIdx = lastIdx >= 0 ? lastIdx + 1 : idx + 1;
            // Use rAF instead of 150ms gap — engine stopwatch is the sole timekeeper
            requestAnimationFrame(() => advance(nextIdx));
          } else {
            if (singleWordMode) {
              setRevealedKeys(new Set([key]));
            } else {
              setRevealedKeys(prev => new Set([...prev, key]));
            }
            setActiveBlankKey(null);
            // Decrement session remaining
            onSessionItemProcessedRef.current();
            // Use rAF instead of 150ms gap — engine stopwatch is the sole timekeeper
            requestAnimationFrame(() => advance(idx + 1));
          }
        };

        const startVoiceOrTimer = () => {
          setActiveBlankKey(key);
          if (useVoice && wordText && speechRef.current.isSupported) {
            // Voice mode: start listening and match against expected word
            const sp = speechRef.current;
            sp.start('ar-SA').then(ok => {
              if (!ok) {
                // Fallback to timer if speech fails — use engine timer as sole source
                const durationMs = timerSecondsRef.current * 1000;
                startItemTimerRef.current(durationMs, () => revealAndAdvance());
                return;
              }
              // Poll transcript for a match (every 300ms, NO timeout — wait for voice only)
              const expectedNorm = normalizeArabic(wordText, 'aggressive').replace(/[\s\u200B-\u200F]/g, '');
              const pollInterval = setInterval(() => {
                const spoken = sp.transcriptRef.current || '';
                const spokenNorm = normalizeArabic(spoken, 'aggressive').replace(/[\s\u200B-\u200F]/g, '');
                // Check if spoken text contains the expected word
                const matched = spokenNorm.length > 0 && (
                  spokenNorm.includes(expectedNorm) || expectedNorm.includes(spokenNorm) ||
                  spoken.split(/\s+/).some(w => {
                    const wn = normalizeArabic(w, 'aggressive').replace(/[\s\u200B-\u200F]/g, '');
                    return wn === expectedNorm || wn.includes(expectedNorm) || expectedNorm.includes(wn);
                  })
                );
                if (matched) {
                  clearInterval(pollInterval);
                  sp.stop();
                  console.log('[tahfeez][voice] ✓ Match:', spoken, '→', wordText);
                  revealAndAdvance();
                }
              }, 300);
              // Store interval ID for cleanup
              revealTimerRef.current = pollInterval as any;
            });
          } else {
            // Timer mode (no voice) — engine scheduleItem is the SOLE timer
            const durationMs = timerSecondsRef.current * 1000;
            startItemTimerRef.current(durationMs, () => revealAndAdvance());
          }
        };

        if (isFirstKey) {
          const fwDelay = firstWordTimerSecondsRef.current * 1000;
          setActiveBlankKey(key);
          if (fwDelay <= 0) {
            startVoiceOrTimer();
          } else {
            startItemTimerRef.current(fwDelay, () => startVoiceOrTimer());
          }
        } else {
          startVoiceOrTimer();
        }
      } catch (err) {
        console.error('[tahfeez] Error in advance():', err);
        setShowAll(true);
        setActiveBlankKey(null);
      }
    };

    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);

    const list = blankedKeysListRef.current;
    if (startIdx < list.length) {
      advance(startIdx);
    }

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  // advanceGeneration triggers re-start of the chain. Refs used for callbacks.
  }, [quizStarted, isPaused, showAll, advanceGeneration, quizInteraction]);

  const handleStart = () => {
    try {
      pendingStartPageRef.current = null;
      const pagesRange = resolveQuizPagesRange();
      if (pages.length === 0 || pagesRange.length === 0) {
        toast.error('لم تكتمل بيانات الاختبار بعد');
        return;
      }
      // Clear any lingering timers from previous runs
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      revealTimerRef.current = null;
      autoAdvanceTimerRef.current = null;

      isFirstStartRef.current = true;
      autoStartHandledPageRef.current = null;
      autoResumeQuizRef.current = false;
      rotateDistributionSeed();
      setQuizStarted(true);
      setSegmentMcqAccumulatedStats(null);
      setIsPaused(false);
      setShowAll(false);
      setRevealedKeys(new Set());
      setActiveBlankKey(null);
      currentRevealIdxRef.current = -1;
      setBlankedKeysList([]);
      blankedKeysListRef.current = [];
      setQuizPageIdx(0);
      quizPageIdxRef.current = 0;
      prevPageRef.current = pagesRange[0] || currentPageRef.current;
      // Reset MCQ state
      setMcqStats({ correct: 0, wrong: 0, total: 0, startTime: Date.now(), answers: [] });
      setMcqShowResults(false);
      setMcqCurrentIdx(0);
      // Initialize engine for new session
      const { perPage } = computeSessionTotalItems(pages, pagesRange);
      const hasAnyItems = pagesRange.some((pageNo) => (perPage[pageNo] || 0) > 0);
      if (!hasAnyItems) {
        setQuizStarted(false);
        toast.error('لا توجد كلمات متاحة في هذا النطاق');
        return;
      }
      initSession(pagesRange, perPage, timerSeconds * 1000, pagesRange[0] || currentPageRef.current);
    } catch (err) {
      console.error('[tahfeez] Error in handleStart:', err);
      toast.error('حدث خطأ أثناء بدء الاختبار');
    }
  };

  const handleStartMultiPage = () => {
    try {
      const pagesRange = resolveQuizPagesRange();
      const startPage = pagesRange[0] || currentPageRef.current;
      if (currentPageRef.current !== startPage) {
        pendingStartPageRef.current = startPage;
        quizPageIdxRef.current = 0;
        setQuizPageIdx(0);
        goToPage(startPage);
        return;
      }
      handleStart();
    } catch (err) {
      console.error('[tahfeez] Error in handleStartMultiPage:', err);
      toast.error('حدث خطأ أثناء بدء الاختبار');
    }
  };

  useEffect(() => {
    if (pendingStartPageRef.current === null) return;
    if (currentPage !== pendingStartPageRef.current) return;

    pendingStartPageRef.current = null;
    requestAnimationFrame(() => {
      handleStart();
    });
  }, [currentPage]);

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      resumeEngine(); // advance() chain handles actual item scheduling
      // Resume from next unrevealed
      const nextIdx = blankedKeysList.findIndex(k => !revealedKeys.has(k));
      if (nextIdx >= 0) {
        restartAutoRevealFrom(nextIdx, blankedKeysList[nextIdx] ?? null);
      }
    } else {
      setIsPaused(true);
      pauseEngine();
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      speech.stop();
    }
  };

  /** Reset current page only — clears this page's state and restarts it */
  const handleResetPage = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    speech.stop();

    // Reset engine page state
    resetQuizPage(currentPage);

    // Reset visual state
    setRevealedKeys(new Set());
    setShowAll(false);
    setActiveBlankKey(null);
    currentRevealIdxRef.current = -1;

    // Restart from fresh on this page
    isFirstStartRef.current = true;
    autoStartHandledPageRef.current = null;
    autoResumeQuizRef.current = false;

    // If session was paused, keep paused; otherwise re-trigger advance
    if (!isPaused) {
      setTimeout(() => {
        currentRevealIdxRef.current = 0;
        setAdvanceGeneration(g => g + 1);
        startRaf();
      }, 100);
    }
  };

  /** Reset entire session — clears all progress, goes back to first page */
  const handleResetSession = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    speech.stop();

    const pagesRange = quizPagesRangeRef.current;
    const { total, perPage } = computeSessionTotalItems(pages, pagesRange);

    // Reset engine
    resetQuizSession(pagesRange, perPage, timerSeconds * 1000, pagesRange[0] || 1);

    // Reset visual state
    setRevealedKeys(new Set());
    setShowAll(false);
    setActiveBlankKey(null);
    currentRevealIdxRef.current = -1;
    setQuizPageIdx(0);
    setIsPaused(false);

    // Navigate to first page and restart
    if (pagesRange.length > 0) goToPage(pagesRange[0]);
    isFirstStartRef.current = true;
    autoStartHandledPageRef.current = null;
    autoResumeQuizRef.current = false;

    // Trigger advance chain
    setTimeout(() => {
      currentRevealIdxRef.current = 0;
      setAdvanceGeneration(g => g + 1);
    }, 200);
  };

  const handleRevealAll = () => {
    try {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      speech.stop();
      setShowAll(true);
      setActiveBlankKey(null);
      // Trigger auto-advance after reveal-all using a separate ref so useEffect cleanup doesn't cancel it
      if (quizStarted) {
        const autoplaySettings = useSettingsStore.getState().settings.autoplay;
        const delayMs = (autoplaySettings.autoAdvanceDelay || 1.5) * 1000;
        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = setTimeout(() => {
          try {
            const range = quizPagesRangeRef.current;
            if (range.length > 1) {
              if (!advanceToNextQuizPage()) completeQuizSession();
            } else if (range.length <= 1) {
              autoResumeQuizRef.current = true;
              nextPage();
            }
          } catch (err) {
            console.error('[tahfeez] Error in handleRevealAll auto-advance:', err);
          }
        }, delayMs);
      }
    } catch (err) {
      console.error('[tahfeez] Error in handleRevealAll:', err);
    }
  };

  // MCQ answer handler
  const handleMCQAnswer = useCallback((key: string, correct: boolean) => {
    const wordText = wordTextsMapRef.current[key] || '';
    // Reveal the word
    setRevealedKeys(prev => new Set([...prev, key]));
    setMcqStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
      answers: [...prev.answers, { key, word: wordText, correct, chosen: '' }],
    }));
    
    // Advance to next blank
    const list = blankedKeysListRef.current;
    const nextIdx = mcqCurrentIdx + 1;
    if (nextIdx >= list.length) {
      // End of page
      setActiveBlankKey(null);
      setShowAll(true);
      setMcqShowResults(true);
    } else {
      setMcqCurrentIdx(nextIdx);
      setActiveBlankKey(list[nextIdx]);
    }
  }, [mcqCurrentIdx]);

  const handleGoToMushaf = () => {
    setSelectionMode(true);
  };

  const handleNavigateToPage = (page: number) => {
    goToPage(page);
    setShowIndex(false);
  };

  const pageItems = storedItems.filter(i => i.data.page === currentPage);
  const progress = blankedKeysList.length > 0
    ? Math.round(((revealedKeys.size) / blankedKeysList.length) * 100)
    : 0;

  // ── Recalc session remaining when speed changes ──
  useEffect(() => {
    if (quizStarted && !showAll) {
      const newDefaultMs = timerSeconds * 1000;
      const newFwMs = firstWordTimerSeconds * 1000;
      // Rebuild all page durations with new speed
      setEngineSpeed(newDefaultMs, {
        activeItemPolicy: 'scale-remaining',
        getDuration: (page, itemIdx) => {
          // Check if this item is a first key on its page
          const ps = pageStatesRef.current[page];
          if (ps && ps.blankedKeysList && ps.blankedKeysList[itemIdx]) {
            const key = ps.blankedKeysList[itemIdx];
            if (firstKeysSetRef.current.has(key)) {
              return newFwMs + newDefaultMs;
            }
          }
          return newDefaultMs;
        },
      });
    }
  }, [timerSeconds, firstWordTimerSeconds, quizStarted, showAll, pageStatesRef, setEngineSpeed]);

  const filteredSurahs = useMemo(() => {
    if (!indexSearch.trim()) return SURAHS;
    const q = indexSearch.trim();
    return SURAHS.filter(s => s.name.includes(q) || s.number.toString() === q);
  }, [indexSearch]);

  const tabs = [
    { id: 'store' as const, icon: Save, label: 'تخزين' },
    { id: 'custom-quiz' as const, icon: ListChecks, label: 'اختبار المخزون' },
    { id: 'auto-quiz' as const, icon: Zap, label: 'اختبار تلقائي' },
    { id: 'srs-review' as const, icon: RotateCcw, label: 'مراجعة' },
  ];

  // Index overlay
  if (showIndex) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <h2 className="font-arabic font-bold text-foreground text-sm">فهرس التحفيظ</h2>
            <button onClick={() => setShowIndex(false)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Tabs value={indexTab} onValueChange={setIndexTab}>
            <TabsList className="grid grid-cols-4 h-9 mb-3">
              <TabsTrigger value="surahs" className="text-xs font-arabic gap-1"><Book className="w-3 h-3" />السور</TabsTrigger>
              <TabsTrigger value="juz" className="text-xs font-arabic gap-1"><Layers className="w-3 h-3" />الأجزاء</TabsTrigger>
              <TabsTrigger value="hizb" className="text-xs font-arabic gap-1"><Hash className="w-3 h-3" />الأحزاب</TabsTrigger>
              <TabsTrigger value="pages" className="text-xs font-arabic gap-1"><FileText className="w-3 h-3" />الصفحات</TabsTrigger>
            </TabsList>

            <TabsContent value="surahs" className="space-y-2">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={indexSearch} onChange={e => setIndexSearch(e.target.value)} placeholder="بحث عن سورة..." className="h-8 text-xs font-arabic pr-8" />
              </div>
              <div className="max-h-[65vh] overflow-y-auto space-y-0.5">
                {filteredSurahs.map(s => (
                  <button key={s.number} onClick={() => handleNavigateToPage(s.startPage)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic transition-colors ${currentPage >= s.startPage ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] font-mono">{s.number}</span>
                      <span>{s.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">ص {s.startPage}</span>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="juz" className="max-h-[70vh] overflow-y-auto space-y-0.5">
              {JUZ_DATA.map(j => (
                <button key={j.number} onClick={() => handleNavigateToPage(j.page)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic transition-colors ${currentPage >= j.page ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] font-mono">{j.number}</span>
                    <span>الجزء {j.number}</span>
                    <span className="text-muted-foreground text-[10px]">({j.name})</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">ص {j.page}</span>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="hizb" className="max-h-[70vh] overflow-y-auto space-y-0.5">
              {JUZ_DATA.flatMap((juz, idx) => {
                const nextPage = idx < 29 ? JUZ_DATA[idx + 1].page : 605;
                const midPage = Math.floor((juz.page + nextPage) / 2);
                return [
                  <button key={`h${juz.number * 2 - 1}`} onClick={() => handleNavigateToPage(juz.page)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic hover:bg-muted/60 transition-colors">
                    <span>الحزب {juz.number * 2 - 1} <span className="text-muted-foreground">(الجزء {juz.number})</span></span>
                    <span className="text-[10px] text-muted-foreground">ص {juz.page}</span>
                  </button>,
                  <button key={`h${juz.number * 2}`} onClick={() => handleNavigateToPage(midPage)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic hover:bg-muted/60 transition-colors">
                    <span>الحزب {juz.number * 2} <span className="text-muted-foreground">(الجزء {juz.number})</span></span>
                    <span className="text-[10px] text-muted-foreground">ص {midPage}</span>
                  </button>,
                ];
              })}
            </TabsContent>

            <TabsContent value="pages" className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-arabic text-muted-foreground">انتقال سريع للصفحة</label>
                <div className="flex items-center gap-2">
                  <Slider value={[currentPage]} onValueChange={([v]) => goToPage(v)} min={1} max={totalPages} step={1} className="flex-1" />
                  <span className="text-sm font-arabic font-bold min-w-[3rem] text-center">{currentPage}</span>
                </div>
                <Button onClick={() => setShowIndex(false)} className="w-full font-arabic text-xs" size="sm">
                  الذهاب لصفحة {currentPage}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl" ref={contentRef}>
      {/* Header */}
      {!shouldHideTopBars && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-lg font-bold font-arabic text-foreground">بوابة التحفيظ</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowIndex(true)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="فهرس المصحف">
                <Book className="w-4 h-4" />
              </button>
              <Link to="/mushaf" className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="بوابة الغريب">
                <BookOpen className="w-4 h-4" />
              </Link>
              <button onClick={() => { if (quizStarted) { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); speech.stop(); } else { goToPage(currentPage - 1); } }} disabled={!quizStarted && currentPage <= 1} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title={quizStarted ? "العودة للإعدادات" : "الصفحة السابقة"}>
                <ArrowRight className="w-4 h-4" />
              </button>
              {quizStarted && (
                <button onClick={() => setHideBars(true)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="إخفاء الأزرار">
                  <EyeOff className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => goToPage(1)} disabled={currentPage <= 1} className="text-xs font-arabic h-7 px-2" title="الصفحة الأولى">⏮</Button>
            <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="text-xs font-arabic h-7 px-2">→</Button>
            <span className="text-xs font-arabic text-muted-foreground">صفحة {currentPage} / {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="text-xs font-arabic h-7 px-2">←</Button>
            <Button variant="ghost" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages} className="text-xs font-arabic h-7 px-2" title="الصفحة الأخيرة">⏭</Button>
          </div>
        </div>
      )}

      {/* Show bars overlay - floating when bars are hidden, with swipe support */}
      {shouldHideTopBars && (
        <>
          <HiddenBarsOverlay onShow={() => setHideBars(false)} onNextPage={nextPage} onPrevPage={prevPage} />
          {/* Floating session timer when bars are hidden */}
          {quizStarted && (
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-background/70 backdrop-blur-sm px-3 py-1 rounded-full border border-border/20 shadow-sm pointer-events-none">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/70" />
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums" dir="rtl">
                  {engine.phase === 'completed' ? 'انتهت' : sessionRemainingMs > 0 ? `المتبقي: ${formatSessionTime(sessionRemainingMs)}` : isPaused ? 'متوقفة' : `المتبقي: ${formatSessionTime(0)}`}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Voice debug overlay disabled */}

      {/* Tab icons */}
      {!quizStarted && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex justify-center gap-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-arabic font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Font settings - visible when not in quiz */}
      {!quizStarted && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="page-frame p-4">
            <TahfeezFontSettings />
          </div>
        </div>
      )}

      <div className={`mx-auto space-y-6 max-w-2xl w-full px-3 py-2 sm:py-6`} style={{ transform: `scale(${pinchScale})`, transformOrigin: 'top center', transition: pinchRef.current ? 'none' : 'transform 0.2s ease' }}>

        {/* Tab 1: Store words */}
        {!quizStarted && activeTab === 'store' && (
          <div className="space-y-4 animate-fade-in">
            {pageData && (
              <TahfeezSelectionView page={pageData} />
            )}

            {/* Page-specific stored words */}
            {(() => {
              const pageItems = storedItems.filter(i => i.data.page === currentPage);
              const otherPagesCount = storedItems.length - pageItems.length;
              return (
                <div className="page-frame p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-arabic font-bold text-sm text-foreground">
                      مخزون الصفحة {currentPage} ({pageItems.length})
                      {otherPagesCount > 0 && (
                        <span className="text-xs text-muted-foreground font-normal mr-2">
                          · إجمالي المخزون: {storedItems.length}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} className="font-arabic text-xs h-7 px-2" title="تراجع عن آخر تغيير">
                        <Undo2 className="w-3 h-3 ml-1" />
                        تراجع
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const data = JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), items: storedItems }, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'tahfeez-items.json'; a.click();
                        URL.revokeObjectURL(url);
                        toast.success('تم تصدير المخزون');
                      }} className="font-arabic text-xs h-7 px-2">
                        <Download className="w-3 h-3 ml-1" />
                        تصدير
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = '.json';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            try {
                              const parsed = JSON.parse(ev.target?.result as string);
                              const items = parsed.items || parsed;
                              if (Array.isArray(items)) {
                                items.forEach((item: TahfeezItem) => addItem(item));
                                toast.success(`تم استيراد ${items.length} عنصر`);
                              } else { toast.error('ملف غير صالح'); }
                            } catch { toast.error('فشل قراءة الملف'); }
                          };
                          reader.readAsText(file);
                        };
                        input.click();
                      }} className="font-arabic text-xs h-7 px-2">
                        <Upload className="w-3 h-3 ml-1" />
                        استيراد
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAllItems} className="text-destructive font-arabic text-xs h-7 px-2">
                        <Trash2 className="w-3 h-3 ml-1" />
                        مسح الكل
                      </Button>
                    </div>
                  </div>
                  {pageItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {pageItems.map((item, i) => {
                        const text = item.type === 'word' ? item.data.originalWord : item.data.originalText;
                        const label = item.type === 'phrase' ? '📝 ' : '';
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              removeItem(getItemKey(item));
                              toast('تم إزالة الكلمة من المخزون', { duration: 1000 });
                            }}
                            className="inline-flex items-center gap-1 bg-primary/15 text-foreground px-3 py-1.5 rounded-full text-sm font-arabic hover:bg-destructive/20 hover:line-through transition-all cursor-pointer active:scale-95"
                            title="اضغط للإزالة"
                          >
                            {label}{text}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-arabic text-muted-foreground text-center py-2">
                      لا توجد كلمات مخزنة في هذه الصفحة
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Custom quiz (stored words) */}
        {!quizStarted && activeTab === 'custom-quiz' && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار المخزون</h2>

            {storedItems.length === 0 ? (
              <p className="text-xs font-arabic text-muted-foreground text-center py-4">
                لم تخزّن أي كلمات بعد. اذهب لتبويب "تخزين" أولاً.
              </p>
            ) : (
              <>
                {/* Quiz scope for custom quiz */}
                <div className="space-y-3">
                  <label className="text-sm font-arabic text-muted-foreground">نطاق الاختبار</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'current-page' as const, label: 'الصفحة الحالية' },
                      { value: 'page-range' as const, label: 'نطاق صفحات' },
                      { value: 'surah' as const, label: 'سورة' },
                      { value: 'juz' as const, label: 'جزء' },
                      { value: 'hizb' as const, label: 'حزب' },
                    ].map(opt => (
                      <Button
                        key={opt.value}
                        variant={quizScope === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setQuizScope(opt.value);
                          if (opt.value === 'current-page') {
                            setQuizScopeFrom(currentPage);
                            setQuizScopeTo(currentPage);
                          }
                        }}
                        className="font-arabic text-xs"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>

                  {quizScope === 'page-range' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من صفحة:</label>
                      <Input type="number" min={1} max={604} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-20" />
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى صفحة:</label>
                      <Input type="number" min={1} max={604} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-20" />
                    </div>
                  )}

                  {quizScope === 'surah' && (
                    <Select value={String(quizScopeFrom)} onValueChange={v => {
                      const num = parseInt(v);
                      setQuizScopeFrom(num);
                      setQuizScopeTo(num);
                    }}>
                      <SelectTrigger className="h-8 text-xs font-arabic">
                        <SelectValue placeholder="اختر سورة" />
                      </SelectTrigger>
                      <SelectContent>
                        {SURAHS.map(s => (
                          <SelectItem key={s.number} value={String(s.number)} className="text-xs font-arabic">{s.number}. {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {quizScope === 'juz' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من جزء:</label>
                      <Input type="number" min={1} max={30} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى جزء:</label>
                      <Input type="number" min={1} max={30} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                    </div>
                  )}

                  {quizScope === 'hizb' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من حزب:</label>
                      <Input type="number" min={1} max={60} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                      <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى حزب:</label>
                      <Input type="number" min={1} max={60} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                    </div>
                  )}

                  <p className="text-xs font-arabic text-muted-foreground">
                    {quizScope === 'current-page'
                      ? `سيتم إخفاء ${pageItems.length} عنصر في صفحة ${currentPage}`
                      : `نطاق من ${quizPagesRange.length} صفحة — المخزّن: ${storedItems.filter(i => quizPagesRange.includes(i.data.page)).length} عنصر`
                    }
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds < 1 ? `${Math.round(firstWordTimerSeconds * 1000)}ms` : `${firstWordTimerSeconds.toFixed(1)} ثانية`}</label>
                  <div className="flex gap-1 flex-wrap mb-1">
                    {[0.3, 0.5, 1, 2, 5].map(p => (
                      <button key={p} onClick={() => setFirstWordTimerSeconds(p)} className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${Math.abs(firstWordTimerSeconds - p) < 0.05 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {p < 1 ? `${Math.round(p * 1000)}ms` : `${p}s`}
                      </button>
                    ))}
                  </div>
                  <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={firstWordTimerSeconds < 1 ? 0.1 : 0.5} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds < 1 ? `${Math.round(timerSeconds * 1000)}ms` : `${timerSeconds.toFixed(1)} ثانية`}</label>
                  <div className="flex gap-1 flex-wrap mb-1">
                    {[0.2, 0.3, 0.5, 0.7, 1, 2, 4].map(p => (
                      <button key={p} onClick={() => setTimerSeconds(p)} className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${Math.abs(timerSeconds - p) < 0.05 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {p < 1 ? `${Math.round(p * 1000)}ms` : `${p}s`}
                      </button>
                    ))}
                  </div>
                  <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={timerSeconds < 1 ? 0.1 : 0.5} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">
                    الانتقال التلقائي للصفحة التالية بعد: {useSettingsStore.getState().settings.autoplay.autoAdvanceDelay ?? 1.5} ثانية
                  </label>
                  <Slider
                    value={[useSettingsStore.getState().settings.autoplay.autoAdvanceDelay ?? 1.5]}
                    onValueChange={([v]) => useSettingsStore.getState().setAutoplay({ autoAdvanceDelay: v })}
                    min={0.5} max={10} step={0.5}
                  />
                  <p className="text-[11px] font-arabic text-muted-foreground">ينتقل تلقائياً إلى الصفحة التالية بعد انتهاء الصفحة الحالية</p>
                </div>

                {/* Keep Screen Awake */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <label className="text-sm font-arabic font-medium text-foreground">تثبيت الشاشة</label>
                    <p className="text-xs font-arabic text-muted-foreground mt-0.5">منع إطفاء الشاشة أثناء الاختبار</p>
                  </div>
                  <Switch
                    checked={keepScreenAwake}
                    onCheckedChange={(v) => useSettingsStore.getState().setAutoplay({ keepScreenAwake: v })}
                  />
                </div>

                {/* Quiz interaction mode */}
                <div className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex flex-col">
                    <label className="text-xs font-arabic text-foreground">طريقة الإجابة</label>
                    <span className="text-[10px] text-muted-foreground font-arabic">
                      {quizInteraction === 'mcq' ? 'اختيار من متعدد' : quizInteraction === 'tap-only' ? 'ضغط فقط' : quizInteraction === 'auto-tap' ? 'تلقائي + ضغط' : 'تلقائي بمؤقت'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                    <Button variant={quizInteraction === 'auto-reveal' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('auto-reveal')} className="font-arabic text-[10px] h-7 px-2">
                      <Eye className="w-3 h-3 ml-1" />تلقائي
                    </Button>
                    <Button variant={quizInteraction === 'auto-tap' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('auto-tap')} className="font-arabic text-[10px] h-7 px-2">
                      <Eye className="w-3 h-3 ml-1" />تلقائي+ضغط
                    </Button>
                    <Button variant={quizInteraction === 'tap-only' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('tap-only')} className="font-arabic text-[10px] h-7 px-2">
                      <MousePointerClick className="w-3 h-3 ml-1" />ضغط فقط
                    </Button>
                    <Button variant={quizInteraction === 'mcq' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('mcq')} className="font-arabic text-[10px] h-7 px-2">
                      <MousePointerClick className="w-3 h-3 ml-1" />اختياري
                    </Button>
                  </div>
                </div>

                {/* MCQ display mode toggle - only visible when MCQ is selected */}
                {quizInteraction === 'mcq' && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-xs font-arabic text-foreground">عرض الخيارات</label>
                      <span className="text-[10px] text-muted-foreground font-arabic">
                        {mcqDisplayMode === 'inline' ? 'في مكان الفراغ مباشرة' : 'في لوحة منفصلة أسفل الصفحة'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant={mcqDisplayMode === 'panel' ? 'default' : 'outline'} size="sm" onClick={() => setMcqDisplayMode('panel')} className="font-arabic text-[10px] h-7 px-2">
                        لوحة
                      </Button>
                      <Button variant={mcqDisplayMode === 'inline' ? 'default' : 'outline'} size="sm" onClick={() => setMcqDisplayMode('inline')} className="font-arabic text-[10px] h-7 px-2">
                        في السطر
                      </Button>
                    </div>
                  </div>
                )}

                {/* MCQ panel position - only when panel mode */}
                {quizInteraction === 'mcq' && mcqDisplayMode === 'panel' && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-xs font-arabic text-foreground">موضع اللوحة</label>
                    </div>
                    <div className="flex gap-1">
                      <Button variant={mcqPanelPosition === 'top' ? 'default' : 'outline'} size="sm" onClick={() => setMcqPanelPosition('top')} className="font-arabic text-[10px] h-7 px-2">
                        فوق الصفحة
                      </Button>
                      <Button variant={mcqPanelPosition === 'bottom' ? 'default' : 'outline'} size="sm" onClick={() => setMcqPanelPosition('bottom')} className="font-arabic text-[10px] h-7 px-2">
                        أسفل الصفحة
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reveal granularity */}
                <div className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex flex-col">
                    <label className="text-xs font-arabic text-foreground">وحدة الكشف</label>
                    <span className="text-[10px] text-muted-foreground font-arabic">
                      {revealGranularity === 'word' ? 'كلمة بكلمة' : revealGranularity === 'ayah' ? 'آية كاملة' : 'مقطع وقفي'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                    <Button variant={revealGranularity === 'word' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('word')} className="font-arabic text-[10px] h-7 px-2">
                      كلمة
                    </Button>
                    <Button variant={revealGranularity === 'ayah' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('ayah')} className="font-arabic text-[10px] h-7 px-2">
                      آية
                    </Button>
                    <Button variant={revealGranularity === 'waqf-segment' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('waqf-segment')} className="font-arabic text-[10px] h-7 px-2">
                      مقطع وقفي
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-foreground">
                    حجم النقاط: <span className="text-primary font-bold">{Math.round(dotScale * 100)}%</span>
                  </label>
                  <Slider
                    value={[dotScale]}
                    onValueChange={([v]) => setDotScale(v)}
                    min={0.2}
                    max={2}
                    step={0.1}
                  />
                </div>

                <Button
                  onClick={() => { setQuizSource('custom'); handleStartMultiPage(); }}
                  className="w-full font-arabic"
                  disabled={!pageData || (quizScope === 'current-page' ? pageItems.length === 0 : storedItems.filter(i => quizPagesRange.includes(i.data.page)).length === 0)}
                >
                  <Play className="w-4 h-4 ml-2" />
                  ابدأ الاختبار {quizScope === 'current-page' ? `(صفحة ${currentPage})` : `(${quizPagesRange.length} صفحة)`}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Auto quiz */}
        {!quizStarted && activeTab === 'auto-quiz' && (
          <TahfeezAutoQuizSettings
            currentPage={currentPage}
            quizPagesRange={quizPagesRange}
            onStart={() => { setQuizSource('auto'); handleStartMultiPage(); }}
            disabled={!pageData}
          />
        )}

        {/* Tab 4: SRS Review */}
        {!quizStarted && activeTab === 'srs-review' && (
          <div className="space-y-4 animate-fade-in">
            <TahfeezSRSPanel
              currentPage={currentPage}
              totalPages={totalPages}
              pageData={pageData}
              allPages={pages}
              onNavigateToPage={goToPage}
              renderPageWithBlanks={(pg, blankedKeys, card) => {
                const pgData = pages.find(p => p.pageNumber === pg);
                if (!pgData) return null;
                const answerRevealed = blankedKeys.length === 0;

                if (card.type === 'tahfeez-word') {
                  // Word-level: blank only the specific word key
                  const wordKey = card.contentKey;
                  if (import.meta.env.DEV) console.log('[tahfeez][SRS-render] word card:', card.id, 'key:', wordKey, 'revealed:', answerRevealed);
                  return (
                    <TahfeezQuizView
                      page={pgData}
                      quizSource="auto"
                      storedItems={[]}
                      autoBlankMode="ayah-count"
                      waqfCombinedModes={[]}
                      blankCount={0}
                      ayahCount={1}
                      activeBlankKey={answerRevealed ? null : wordKey}
                      revealedKeys={answerRevealed ? new Set([wordKey]) : new Set()}
                      showAll={false}
                      forceBlankedKeys={[wordKey]}
                    />
                  );
                }

                // Ayah-level: use stable ayah ID for precise binding
                const stableAyahId = typeof card.meta?.ayahStableId === 'string' ? String(card.meta.ayahStableId) : null;
                const forcedAyahIndex = typeof card.meta?.ayahIndex === 'number' ? Number(card.meta.ayahIndex) : null;
                if (import.meta.env.DEV) console.log('[tahfeez][SRS-render] ayah card:', card.id, 'stableId:', stableAyahId, 'ayahIndex:', forcedAyahIndex, 'revealed:', answerRevealed);
                return (
                  <TahfeezQuizView
                    page={pgData}
                    quizSource="auto"
                    storedItems={[]}
                    autoBlankMode="ayah-count"
                    waqfCombinedModes={[]}
                    blankCount={blankCount}
                    ayahCount={1}
                    activeBlankKey={null}
                    revealedKeys={new Set()}
                    showAll={false}
                    forceAyahIds={stableAyahId ? [stableAyahId] : undefined}
                    forceAyahIndices={!stableAyahId && forcedAyahIndex !== null ? [forcedAyahIndex] : undefined}
                    revealedAyahIds={answerRevealed && stableAyahId ? [stableAyahId] : undefined}
                  />
                );
              }}
            />
          </div>
        )}

        {/* Quiz view */}
        <AutoPlayDebugPanel visible={process.env.NODE_ENV !== 'production'} />
        {quizStarted && pageData && (autoBlankMode === 'next-ayah-mcq' || autoBlankMode === 'next-waqf-mcq') && (
          <div className="space-y-4 animate-fade-in">
            {/* Multi-page progress */}
            {quizPagesRange.length > 1 && (
              <div className="page-frame p-2 flex items-center justify-center gap-2">
                <span className="text-xs font-arabic text-muted-foreground">
                  صفحة {quizPagesRange.indexOf(currentPage) + 1} من {quizPagesRange.length}
                </span>
              </div>
            )}
            <TahfeezSegmentMCQView
              page={pageData}
              mode={autoBlankMode as 'next-ayah-mcq' | 'next-waqf-mcq'}
              inline={segmentMcqInline}
              choicesAtBlank={segmentMcqChoicesAtBlank && segmentMcqInline}
              multiPage={segmentMcqMultiPage && quizPagesRange.length > 1}
              accumulatedStats={segmentMcqAccumulatedStats}
              onFinish={() => { setQuizStarted(false); setSegmentMcqAccumulatedStats(null); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); }}
              onRestart={() => { setSegmentMcqAccumulatedStats(null); }}
              onNextPage={(stats) => {
                const nextIdx = quizPagesRange.indexOf(currentPage) + 1;
                if (nextIdx < quizPagesRange.length) {
                  setSegmentMcqAccumulatedStats(stats);
                  goToPage(quizPagesRange[nextIdx]);
                  setQuizPageIdx(nextIdx);
                } else {
                  // Last page - show results by resetting multiPage flag temporarily
                  setSegmentMcqAccumulatedStats(null);
                }
              }}
            />
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); }} className="font-arabic">
                إعادة
              </Button>
              {/* Next page for segment MCQ */}
              {quizPagesRange.indexOf(currentPage) < quizPagesRange.length - 1 && (
                <Button variant="default" size="sm" onClick={() => {
                  const nextIdx = quizPagesRange.indexOf(currentPage) + 1;
                  if (nextIdx < quizPagesRange.length) {
                    goToPage(quizPagesRange[nextIdx]);
                    setQuizPageIdx(nextIdx);
                  }
                }} className="font-arabic">
                  <ChevronsRight className="w-4 h-4 ml-1" />
                  الصفحة التالية
                </Button>
              )}
            </div>
          </div>
        )}
        {quizStarted && pageData && autoBlankMode !== 'next-ayah-mcq' && autoBlankMode !== 'next-waqf-mcq' && (
          <div className="space-y-4 animate-fade-in">
            {/* Multi-page progress */}
            {quizPagesRange.length > 1 && (
              <div className="page-frame p-2 flex items-center justify-center gap-2">
                <span className="text-xs font-arabic text-muted-foreground">
                  صفحة {quizPagesRange.indexOf(currentPage) + 1} من {quizPagesRange.length}
                </span>
              </div>
            )}

            {/* Inline word count controls (no progress bar / percentage / word count) */}
            {autoBlankMode === 'ayah-count' && hiddenWordsMode === 'fixed-count' && (
              <div className="page-frame p-2">
                <div className="flex items-center gap-2" dir="rtl">
                  <span className="text-xs font-arabic text-muted-foreground whitespace-nowrap">كلمات: <span className="text-primary font-bold">{hiddenWordsCount}</span></span>
                  <Slider className="flex-1" value={[hiddenWordsCount]} onValueChange={([v]) => setHiddenWordsCount(v)} min={1} max={20} step={1} />
                </div>
              </div>
            )}
            {autoBlankMode === 'ayah-count' && hiddenWordsMode === 'percentage' && (
              <div className="page-frame p-2">
                <div className="flex items-center gap-2" dir="rtl">
                  <span className="text-xs font-arabic text-muted-foreground whitespace-nowrap">نسبة: <span className="text-primary font-bold">{hiddenWordsPercentage}%</span></span>
                  <Slider className="flex-1" value={[hiddenWordsPercentage]} onValueChange={([v]) => setHiddenWordsPercentage(v)} min={5} max={90} step={5} />
                </div>
              </div>
            )}
            {(['beginning', 'middle', 'end', 'beginning-middle', 'middle-end', 'beginning-end', 'beginning-middle-end'] as string[]).includes(autoBlankMode) && (
              <div className="page-frame p-2">
                <div className="flex items-center gap-2" dir="rtl">
                  <span className="text-xs font-arabic text-muted-foreground whitespace-nowrap">كلمات: <span className="text-primary font-bold">{blankCount}</span></span>
                  <Slider className="flex-1" value={[blankCount]} onValueChange={([v]) => setBlankCount(v)} min={1} max={10} step={1} />
                </div>
              </div>
            )}

            {/* Session review settings hidden during active quiz — accessible via ⚙️ button */}

            {/* Runtime debug panel removed */}

            {/* MCQ Panel - TOP position */}
            {quizInteraction === 'mcq' && mcqDisplayMode === 'panel' && mcqPanelPosition === 'top' && (
              <TahfeezMCQPanel
                activeKey={activeBlankKey}
                wordTextsMap={wordTextsMapRef.current}
                allWordTexts={allPageWordTexts}
                onAnswer={handleMCQAnswer}
                stats={mcqStats}
                showResults={mcqShowResults}
                onRestart={() => {
                  setQuizStarted(false);
                  setTimeout(() => {
                    setQuizSource(quizSource);
                    handleStartMultiPage();
                  }, 100);
                }}
              />
            )}

            <TahfeezQuizView
              page={pageData}
              quizSource={quizSource}
              storedItems={storedItems}
              autoBlankMode={autoBlankMode}
              waqfCombinedModes={waqfCombinedModes}
              quizScope={quizScope}
              blankCount={blankCount}
              ayahCount={ayahCount}
              activeBlankKey={activeBlankKey}
              revealedKeys={revealedKeys}
              showAll={showAll}
              storeMode={storeWhileQuiz}
              onStoreWord={(lineIdx, tokenIdx, text) => {
                // Toggle: if already stored, remove; otherwise add
                const existingItem = storedItems.find(item => {
                  if (item.data.page !== currentPage) return false;
                  if (item.type === 'word') {
                    const w = item.data;
                    return w.wordIndex === tokenIdx && w.originalWord === text && (w.lineIdx === undefined || w.lineIdx === lineIdx);
                  }
                  return false;
                });
                if (existingItem) {
                  removeItem(getItemKey(existingItem));
                  toast('تم إزالة الكلمة من المخزون', { duration: 1000 });
                } else {
                  addItem({
                    type: 'word',
                    data: {
                      surahNumber: 0,
                      ayahNumber: 0,
                      wordIndex: tokenIdx,
                      originalWord: text,
                      page: currentPage,
                      lineIdx,
                    }
                  });
                  toast('تم تخزين الكلمة ✓', { duration: 1000 });
                }
              }}
              onClickActiveBlank={() => {
                if (!activeBlankKey) return;
                if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
                const groups = revealGranularity === 'ayah' ? ayahKeyGroupsRef.current : revealGranularity === 'waqf-segment' ? waqfKeyGroupsRef.current : null;
                if (groups && groups.length > 0) {
                  const groupIdx = groups.findIndex(g => g.includes(activeBlankKey));
                  const groupKeys = groupIdx >= 0 ? groups[groupIdx] : [activeBlankKey];
                  setRevealedKeys(prev => {
                    if (singleWordMode) return new Set(groupKeys);
                    const next = new Set(prev);
                    groupKeys.forEach(k => next.add(k));
                    return next;
                  });
                  setActiveBlankKey(null);
                  const lastGroupKey = groupKeys[groupKeys.length - 1];
                  const lastIdx = blankedKeysList.indexOf(lastGroupKey);
                  const nextIdx = lastIdx >= 0 ? lastIdx + 1 : blankedKeysList.indexOf(activeBlankKey) + 1;
                  setTimeout(() => restartAutoRevealFrom(nextIdx, blankedKeysList[nextIdx] ?? null), 300);
                } else {
                  setRevealedKeys(prev => singleWordMode ? new Set([activeBlankKey]) : new Set([...prev, activeBlankKey]));
                  setActiveBlankKey(null);
                  const idx = blankedKeysList.indexOf(activeBlankKey);
                  if (idx >= 0) {
                    setTimeout(() => restartAutoRevealFrom(idx + 1, blankedKeysList[idx + 1] ?? null), 300);
                  }
                }
              }}
              onClickBlankWord={(key) => {
                if (quizInteraction === 'tap-only') {
                  // Tap-only: reveal clicked blank (or group) and advance
                  const groups = revealGranularity === 'ayah' ? ayahKeyGroupsRef.current : revealGranularity === 'waqf-segment' ? waqfKeyGroupsRef.current : null;
                  if (groups && groups.length > 0) {
                    const groupIdx = groups.findIndex(g => g.includes(key));
                    const groupKeys = groupIdx >= 0 ? groups[groupIdx] : [key];
                    setRevealedKeys(prev => {
                      if (singleWordMode) return new Set(groupKeys);
                      const next = new Set(prev);
                      groupKeys.forEach(k => next.add(k));
                      return next;
                    });
                    const lastGroupKey = groupKeys[groupKeys.length - 1];
                    const lastIdx = blankedKeysList.indexOf(lastGroupKey);
                    const nextIdx = lastIdx >= 0 ? lastIdx + 1 : blankedKeysList.indexOf(key) + 1;
                    if (nextIdx < blankedKeysList.length) {
                      setActiveBlankKey(blankedKeysList[nextIdx]);
                    } else {
                      setActiveBlankKey(null);
                      setShowAll(true);
                    }
                  } else {
                    setRevealedKeys(prev => singleWordMode ? new Set([key]) : new Set([...prev, key]));
                    const idx = blankedKeysList.indexOf(key);
                    const nextIdx = idx + 1;
                    if (nextIdx < blankedKeysList.length) {
                      setActiveBlankKey(blankedKeysList[nextIdx]);
                    } else {
                      setActiveBlankKey(null);
                      setShowAll(true);
                    }
                  }
                  return;
                }
                // Jump quiz to start from clicked word
                const idx = blankedKeysList.indexOf(key);
                if (idx < 0) return;
                if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
                if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                setIsPaused(false);
                setShowAll(false);
                setActiveBlankKey(null);
                // Keep already revealed words before this index
                restartAutoRevealFrom(idx, key);
              }}
              inlineMCQ={quizInteraction === 'mcq' && mcqDisplayMode === 'inline'}
              allWordTexts={allPageWordTexts}
              onInlineMCQAnswer={handleMCQAnswer}
            />

            {/* MCQ Panel - BOTTOM position */}
            {quizInteraction === 'mcq' && mcqDisplayMode === 'panel' && mcqPanelPosition === 'bottom' && (
              <TahfeezMCQPanel
                activeKey={activeBlankKey}
                wordTextsMap={wordTextsMapRef.current}
                allWordTexts={allPageWordTexts}
                onAnswer={handleMCQAnswer}
                stats={mcqStats}
                showResults={mcqShowResults}
                onRestart={() => {
                  setQuizStarted(false);
                  setTimeout(() => {
                    setQuizSource(quizSource);
                    handleStartMultiPage();
                  }, 100);
                }}
              />
            )}

            {/* MCQ Results (for inline mode, show results panel when done) */}
            {quizInteraction === 'mcq' && mcqDisplayMode === 'inline' && mcqShowResults && (
              <TahfeezMCQPanel
                activeKey={null}
                wordTextsMap={wordTextsMapRef.current}
                allWordTexts={allPageWordTexts}
                onAnswer={handleMCQAnswer}
                stats={mcqStats}
                showResults={true}
                onRestart={() => {
                  setQuizStarted(false);
                  setTimeout(() => {
                    setQuizSource(quizSource);
                    handleStartMultiPage();
                  }, 100);
                }}
              />
            )}

            {/* Mic indicator */}
            {quizInteraction !== 'mcq' && voiceMode && speech.isListening && (
              <div className="flex items-center justify-center gap-2 text-xs font-arabic text-primary animate-pulse">
                <Mic className="w-4 h-4" />
                <span>يستمع... تحدث الآن</span>
                {speech.transcript && <span className="text-muted-foreground truncate max-w-[150px]">"{speech.transcript}"</span>}
              </div>
            )}

            {/* Session estimated remaining time — only when top bars visible (hidden-bars has its own overlay) */}
            {!shouldHideTopBars && (
              <div className="flex items-center justify-center gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded-full">
                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums" dir="rtl">
                    {engine.phase === 'completed' ? 'انتهت' : sessionRemainingMs > 0 ? `المتبقي: ${formatSessionTime(sessionRemainingMs)}` : isPaused ? 'متوقفة' : `المتبقي: ${formatSessionTime(0)}`}
                  </span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePauseResume} className="font-arabic">
                {isPaused ? <Play className="w-4 h-4 ml-1" /> : <Pause className="w-4 h-4 ml-1" />}
                {isPaused ? 'استئناف' : 'إيقاف'}
              </Button>
              <Button variant={storeWhileQuiz ? 'default' : 'outline'} size="sm" onClick={() => setStoreWhileQuiz(v => !v)} className="font-arabic">
                <Save className="w-4 h-4 ml-1" />
                تخزين
              </Button>
              {/* Toggle voice on/off during quiz */}
              {speech.isSupported && (
                <Button
                  variant={voiceMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (voiceMode) { speech.stop(); setVoiceMode(false); }
                    else setVoiceMode(true);
                  }}
                  className="font-arabic"
                >
                  {voiceMode ? <Mic className="w-4 h-4 ml-1" /> : <MicOff className="w-4 h-4 ml-1" />}
                  {voiceMode ? 'صوتي' : 'صوتي'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleRevealAll} className="font-arabic" disabled={showAll}>
                <Eye className="w-4 h-4 ml-1" />
                كشف الكل
              </Button>
              {/* Next page button — shown only at end of range for manual override */}
              {showAll && quizPagesRange.indexOf(currentPage) < quizPagesRange.length - 1 && (
                <Button variant="default" size="sm" onClick={() => {
                  if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
                  const nextIdx = quizPagesRange.indexOf(currentPage) + 1;
                  if (nextIdx < quizPagesRange.length) {
                    autoResumeQuizRef.current = true;
                    goToPage(quizPagesRange[nextIdx]);
                    setQuizPageIdx(nextIdx);
                  }
                }} className="font-arabic">
                  <ChevronsRight className="w-4 h-4 ml-1" />
                  الصفحة التالية
                </Button>
              )}
              {/* Session settings sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="font-arabic">
                    <Settings className="w-4 h-4 ml-1" />
                    إعدادات
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="overflow-y-auto w-[340px] sm:max-w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="font-arabic text-right">إعدادات الجلسة</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <TahfeezAutoQuizSettings
                      currentPage={currentPage}
                      quizPagesRange={quizPagesRange}
                      onStart={() => {}}
                      disabled={false}
                      compact
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="sm" onClick={handleResetPage} className="font-arabic" title="إعادة الصفحة الحالية فقط">
                <RotateCcw className="w-4 h-4 ml-1" />
                إعادة الصفحة
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetSession} className="font-arabic text-destructive hover:text-destructive" title="إعادة الجلسة كاملة من البداية">
                <Undo2 className="w-4 h-4 ml-1" />
                إعادة الجلسة
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setQuizStarted(false); engine.stop(); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); speech.stop(); }} className="font-arabic">
                إنهاء
              </Button>
            </div>
          </div>
        )}

        {/* Floating speed control during quiz — only when bars are hidden to avoid overlap */}
        {quizStarted && hideBars && (
          <SpeedControlWidget
            value={timerSeconds}
            onChange={(v) => setTimerSeconds(v)}
            label="مدة ظهور الكلمة"
            min={0.1}
            max={30}
          />
        )}
      </div>
    </div>
  );
}

function StoredItemBadge({ item }: { item: TahfeezItem }) {
  const removeItem = useTahfeezStore(s => s.removeItem);
  const getItemKey = useTahfeezStore(s => s.getItemKey);

  const text = item.type === 'word' ? item.data.originalWord : item.data.originalText;
  const page = item.data.page;
  const label = item.type === 'phrase' ? '📝' : '';

  return (
    <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-arabic group">
      {label}{text}
      <span className="text-xs text-muted-foreground mr-1">ص{page}</span>
      <button
        onClick={() => removeItem(getItemKey(item))}
        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity mr-1"
      >
        ×
      </button>
    </span>
  );
}
