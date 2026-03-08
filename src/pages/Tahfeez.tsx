import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { MCQStats, TahfeezMCQPanel } from '@/components/TahfeezMCQPanel';
import { TahfeezSegmentMCQView } from '@/components/TahfeezSegmentMCQView';
import { useSessionsStore } from '@/stores/sessionsStore';
import { toast } from 'sonner';
import { useQuranData } from '@/hooks/useQuranData';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { useSpeech } from '@/hooks/useSpeech';
import { normalizeArabic } from '@/utils/quranParser';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, EyeOff, ArrowRight, Save, Trash2, GraduationCap, ListChecks, Zap, Book, Layers, Hash, FileText, Search, X, ChevronLeft, Download, Upload, ChevronsRight, Undo2, Palette, Mic, MicOff, MousePointerClick } from 'lucide-react';
import { SpeedControlWidget } from '@/components/SpeedControlWidget';

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
// ---- Quran Index Data ----
const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name,
  startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

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
  } = useTahfeezStore();

  const speech = useSpeech();

  const { currentPage, getCurrentPageData, goToPage, totalPages, nextPage, prevPage } = useQuranData();
  useSettingsApplier(); // Apply font/display settings globally
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'auto15');
  const autoplaySpeed = useSettingsStore((s) => s.settings.autoplay.speed);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const keepScreenAwake = useSettingsStore((s) => s.settings.autoplay.keepScreenAwake ?? false);
  const pageData = getCurrentPageData();

  // Restore page from session on mount + scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const startPage = localStorage.getItem('quran-app-tahfeez-start-page');
    if (startPage) {
      localStorage.removeItem('quran-app-tahfeez-start-page');
      const p = parseInt(startPage, 10);
      if (!isNaN(p) && p >= 1 && p <= 604) goToPage(p);
    }
  }, [goToPage]);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentPage]);

  // Auto-save session progress
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const updateSession = useSessionsStore((s) => s.updateSession);
  const getSession = useSessionsStore((s) => s.getSession);
  
  useEffect(() => {
    if (activeSessionId) {
      const session = getSession(activeSessionId);
      const tahfeezItemsSnapshot = session?.type === 'tahfeez' ? storedItems : undefined;
      updateSession(activeSessionId, { 
        currentPage,
        tahfeezItems: tahfeezItemsSnapshot,
      });
    }
  }, [currentPage, storedItems, activeSessionId, updateSession, getSession]);

  const [quizStarted, setQuizStarted] = useState(false);
  const [storeWhileQuiz, setStoreWhileQuiz] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  useKeepAwake(keepScreenAwake && quizStarted && !isPaused);
  const [showAll, setShowAll] = useState(false);
  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [blankedKeysList, setBlankedKeysList] = useState<string[]>([]);
  const [firstKeysSet, setFirstKeysSet] = useState<Set<string>>(new Set());
  const [currentRevealIdx, setCurrentRevealIdx] = useState(-1);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  const [indexTab, setIndexTab] = useState('surahs');
  const [hideBars, setHideBars] = useState(false);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const [quizPageIdx, setQuizPageIdx] = useState(0);

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

  // Pinch-to-zoom + swipe handler
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
  useEffect(() => {
    if (!quizStarted) return;
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      // Clear all timers first
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      // Full state reset for the new page
      setShowAll(false);
      setRevealedKeys(new Set());
      setActiveBlankKey(null);
      setCurrentRevealIdx(-1);
      setBlankedKeysList([]);
      setFirstKeysSet(new Set());
      setIsPaused(false);
      // Flag to auto-start when blanked keys are loaded from DOM
      autoResumeQuizRef.current = true;
    }
  }, [currentPage, quizStarted]);

  // Read blanked keys from the quiz view after it renders.
  // Uses MutationObserver for instant detection instead of slow polling.
  // If page has no blanked items after timeout → skip to next page automatically.
  useEffect(() => {
    if (!quizStarted) return;

    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const processKeys = (el: HTMLElement) => {
      try {
        // Verify the element belongs to the current page (avoid stale data from previous page)
        const elPage = el.getAttribute('data-page');
        if (elPage && Number(elPage) !== currentPageRef.current) return false;
        
        const keys = JSON.parse(el.getAttribute('data-keys') || '[]');
        const fKeys = JSON.parse(el.getAttribute('data-first-keys') || '[]');
        const wordTexts = JSON.parse(el.getAttribute('data-word-texts') || '{}');
        const ayahGrps = JSON.parse(el.getAttribute('data-ayah-groups') || '[]');
        const waqfGrps = JSON.parse(el.getAttribute('data-waqf-groups') || '[]');
        if (keys.length > 0) {
          settled = true;
          // Update refs SYNCHRONOUSLY before state updates so advance() reads correct data
          blankedKeysListRef.current = keys;
          firstKeysSetRef.current = new Set(fKeys);
          wordTextsMapRef.current = wordTexts;
          ayahKeyGroupsRef.current = ayahGrps;
          waqfKeyGroupsRef.current = waqfGrps;
          setBlankedKeysList(keys);
          setFirstKeysSet(new Set(fKeys));
          // Collect all word texts on this page for MCQ distractors
          setAllPageWordTexts(Object.values(wordTexts));

          // Auto-resume after page transition OR first start
          if (autoResumeQuizRef.current || isFirstStartRef.current) {
            autoResumeQuizRef.current = false;
            isFirstStartRef.current = false;
            console.log('[tahfeez] Starting quiz, keys count:', keys.length);
            // Set state directly — no requestAnimationFrame delay
            setRevealedKeys(new Set());
            setShowAll(false);
            setActiveBlankKey(null);
            if (quizInteraction === 'mcq') {
              // MCQ mode: set active blank to first key, update total
              setMcqCurrentIdx(0);
              setActiveBlankKey(keys[0]);
              setMcqStats(prev => ({ ...prev, total: keys.length }));
            } else if (quizInteraction === 'tap-only') {
              // Tap-only: set first blank as active, no timer
              setActiveBlankKey(keys[0]);
            } else {
              setCurrentRevealIdx(0);
            }
          }
          return true;
        }
      } catch {}
      return false;
    };

    // Try immediately (element may already be rendered)
    const el = document.getElementById('tahfeez-blanked-keys');
    if (el && processKeys(el)) {
      return; // done instantly
    }

    // Use MutationObserver to detect attribute changes on the hidden element
    const observer = new MutationObserver(() => {
      if (settled) return;
      const el = document.getElementById('tahfeez-blanked-keys');
      if (el && processKeys(el)) {
        observer.disconnect();
        if (fallbackTimer) clearTimeout(fallbackTimer);
      }
    });

    // Observe the entire container for subtree changes and attribute mutations
    const container = document.body;
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-keys'] });

    // Fallback timeout: if no keys after 5s, skip page
    fallbackTimer = setTimeout(() => {
      if (settled) return;
      observer.disconnect();
      if (autoResumeQuizRef.current || isFirstStartRef.current) {
        autoResumeQuizRef.current = false;
        isFirstStartRef.current = false;
        const autoplaySettings = useSettingsStore.getState().settings.autoplay;
        const delayMs = (autoplaySettings.autoAdvanceDelay || 1.5) * 1000;
        console.log('[tahfeez] No blanked keys on page', currentPageRef.current, '— skipping to next in', delayMs, 'ms');

        setTimeout(() => {
          const curPage = currentPageRef.current;
          const range = quizPagesRangeRef.current;
          const currentPageIdx = range.indexOf(curPage);

          if (range.length > 1 && currentPageIdx >= 0 && currentPageIdx < range.length - 1) {
            setQuizPageIdx(prev => prev + 1);
            goToPage(range[currentPageIdx + 1]);
          } else {
            nextPage();
          }
        }, delayMs);
      }
    }, 5000);

    return () => {
      observer.disconnect();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, pageData, currentPage]);

  // Ref to track reveal index internally (avoids re-triggering the advance effect)
  const currentRevealIdxRef = useRef(-1);

  // Auto-reveal sequencing
  // IMPORTANT: Does NOT depend on currentRevealIdx state to avoid re-triggering.
  // advance() chains itself via setTimeout. The effect only starts/stops the chain.
  useEffect(() => {
    if (!quizStarted || isPaused || showAll || blankedKeysListRef.current.length === 0) return;
    // Skip auto-reveal chain in MCQ and tap-only modes
    if (quizInteraction === 'mcq' || quizInteraction === 'tap-only') return;
    // Don't start if currentRevealIdx is still -1 (waiting for auto-resume)
    if (currentRevealIdx < 0) return;

    // Mark: we only start the chain once per effect run
    const startIdx = currentRevealIdx;
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

              if (currentPageIdx >= 0 && currentPageIdx < range.length - 1) {
                const nextPageInRange = range[currentPageIdx + 1];
                setQuizPageIdx(currentPageIdx + 1);
                autoResumeQuizRef.current = true;
                goToPage(nextPageInRange);
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
            // Find the group containing the current key
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
            // Find the next key AFTER this entire group
            const lastGroupKey = groupKeys[groupKeys.length - 1];
            const lastIdx = list.indexOf(lastGroupKey);
            const nextIdx = lastIdx >= 0 ? lastIdx + 1 : idx + 1;
            revealTimerRef.current = setTimeout(() => advance(nextIdx), 150);
          } else {
            // Word-by-word (default)
            if (singleWordMode) {
              setRevealedKeys(new Set([key]));
            } else {
              setRevealedKeys(prev => new Set([...prev, key]));
            }
            setActiveBlankKey(null);
            revealTimerRef.current = setTimeout(() => advance(idx + 1), 150);
          }
        };

        const startVoiceOrTimer = () => {
          setActiveBlankKey(key);
          if (useVoice && wordText && speechRef.current.isSupported) {
            // Voice mode: start listening and match against expected word
            const sp = speechRef.current;
            sp.start('ar-SA').then(ok => {
              if (!ok) {
                // Fallback to timer if speech fails
                revealTimerRef.current = setTimeout(() => revealAndAdvance(), timerSecondsRef.current * 1000);
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
            // Timer mode (no voice)
            revealTimerRef.current = setTimeout(() => {
              revealAndAdvance();
            }, timerSecondsRef.current * 1000);
          }
        };

        if (isFirstKey) {
          const fwDelay = firstWordTimerSecondsRef.current * 1000;
          if (fwDelay <= 0) {
            startVoiceOrTimer();
          } else {
            setActiveBlankKey(null);
            revealTimerRef.current = setTimeout(() => {
              startVoiceOrTimer();
            }, fwDelay);
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
  // CRITICAL: currentRevealIdx is here ONLY to start the chain (from -1 → 0).
  // advance() chains itself via setTimeout and does NOT update currentRevealIdx state.
  }, [quizStarted, isPaused, showAll, currentRevealIdx]);

  const handleStart = () => {
    try {
      // Clear any lingering timers from previous runs
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      revealTimerRef.current = null;
      autoAdvanceTimerRef.current = null;

      isFirstStartRef.current = true;
      autoResumeQuizRef.current = false;
      setQuizStarted(true);
      setIsPaused(false);
      setShowAll(false);
      setRevealedKeys(new Set());
      setActiveBlankKey(null);
      setCurrentRevealIdx(-1);
      setBlankedKeysList([]);
      setQuizPageIdx(0);
      // Reset MCQ state
      setMcqStats({ correct: 0, wrong: 0, total: 0, startTime: Date.now(), answers: [] });
      setMcqShowResults(false);
      setMcqCurrentIdx(0);
    } catch (err) {
      console.error('[tahfeez] Error in handleStart:', err);
      toast.error('حدث خطأ أثناء بدء الاختبار');
    }
  };

  const handleStartMultiPage = () => {
    try {
      if (quizPagesRange.length > 0) {
        goToPage(quizPagesRange[0]);
      }
      handleStart();
    } catch (err) {
      console.error('[tahfeez] Error in handleStartMultiPage:', err);
      toast.error('حدث خطأ أثناء بدء الاختبار');
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      // Resume from next unrevealed
      const nextIdx = blankedKeysList.findIndex(k => !revealedKeys.has(k));
      if (nextIdx >= 0) setCurrentRevealIdx(nextIdx);
    } else {
      setIsPaused(true);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      speech.stop();
    }
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
            const curPage = currentPageRef.current;
            const range = quizPagesRangeRef.current;
            const currentPageIdx = range.indexOf(curPage);
            if (currentPageIdx >= 0 && currentPageIdx < range.length - 1) {
              const nextPageInRange = range[currentPageIdx + 1];
              setQuizPageIdx(currentPageIdx + 1);
              autoResumeQuizRef.current = true;
              goToPage(nextPageInRange);
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

  const filteredSurahs = useMemo(() => {
    if (!indexSearch.trim()) return SURAHS;
    const q = indexSearch.trim();
    return SURAHS.filter(s => s.name.includes(q) || s.number.toString() === q);
  }, [indexSearch]);

  const tabs = [
    { id: 'store' as const, icon: Save, label: 'تخزين' },
    { id: 'custom-quiz' as const, icon: ListChecks, label: 'اختبار المخزون' },
    { id: 'auto-quiz' as const, icon: Zap, label: 'اختبار تلقائي' },
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
      {!hideBars && (
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
              <button onClick={() => setHideBars(true)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="إخفاء الأزرار">
                <EyeOff className="w-4 h-4" />
              </button>
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
      {hideBars && (
        <HiddenBarsOverlay onShow={() => setHideBars(false)} onNextPage={nextPage} onPrevPage={prevPage} />
      )}

      {/* Voice debug overlay disabled */}

      {/* Tab icons */}
      {!quizStarted && !hideBars && (
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
      {!quizStarted && !hideBars && (
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
                  <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds < 1 ? `${(firstWordTimerSeconds * 1000).toFixed(0)}ms` : `${firstWordTimerSeconds} ثانية`}</label>
                  <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={0.1} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds < 1 ? `${(timerSeconds * 1000).toFixed(0)}ms` : `${timerSeconds} ثانية`}</label>
                  <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={0.1} />
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
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار تلقائي</h2>

            <div className="space-y-3">
              <label className="text-sm font-arabic text-muted-foreground">نمط الإخفاء</label>
              <div className="flex flex-wrap gap-2">
              {[
                  { value: 'beginning' as const, label: 'أول الآية' },
                  { value: 'middle' as const, label: 'وسط الآية' },
                  { value: 'end' as const, label: 'آخر الآية' },
                  { value: 'beginning-middle' as const, label: 'أول + وسط' },
                  { value: 'middle-end' as const, label: 'وسط + آخر' },
                  { value: 'beginning-end' as const, label: 'أول + آخر' },
                  { value: 'beginning-middle-end' as const, label: 'أول + وسط + آخر' },
                  { value: 'full-ayah' as const, label: 'آية كاملة' },
                  { value: 'ayah-count' as const, label: 'عدد آيات' },
                  { value: 'full-page' as const, label: 'صفحة كاملة' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={autoBlankMode === opt.value && waqfCombinedModes.length === 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setAutoBlankMode(opt.value); setWaqfCombinedModes([]); }}
                    className="font-arabic text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
                {/* Waqf modes - multi-selectable */}
                {[
                  { value: 'between-waqf' as const, label: 'بين علامتي وقف' },
                  { value: 'waqf-to-ayah' as const, label: 'وقف ← رأس الآية' },
                  { value: 'ayah-to-waqf' as const, label: 'رأس الآية ← وقف' },
                ].map(opt => {
                  const isActive = waqfCombinedModes.includes(opt.value);
                  return (
                    <Button
                      key={opt.value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        let newModes: typeof waqfCombinedModes;
                        if (isActive) {
                          newModes = waqfCombinedModes.filter(m => m !== opt.value);
                        } else {
                          newModes = [...waqfCombinedModes, opt.value];
                        }
                        setWaqfCombinedModes(newModes);
                        if (newModes.length > 0) {
                          setAutoBlankMode(newModes[0]);
                        }
                      }}
                      className="font-arabic text-xs"
                    >
                      {opt.label}
                    </Button>
                  );
                })}
                {/* Segment MCQ modes */}
                {[
                  { value: 'next-ayah-mcq' as const, label: 'اختر الآية التالية' },
                  { value: 'next-waqf-mcq' as const, label: 'اختر ما بعد الوقف' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={autoBlankMode === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setAutoBlankMode(opt.value); setWaqfCombinedModes([]); }}
                    className="font-arabic text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* Inline display toggle for segment MCQ */}
              {(autoBlankMode === 'next-ayah-mcq' || autoBlankMode === 'next-waqf-mcq') && (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg border">
                    <label className="text-xs font-arabic text-foreground">عرض الاختيارات على صفحة القرآن</label>
                    <Switch
                      checked={segmentMcqInline}
                      onCheckedChange={(v) => setSegmentMcqInline(v)}
                    />
                  </div>
                  {segmentMcqInline && (
                    <div className="flex items-center justify-between p-2 rounded-lg border">
                      <label className="text-xs font-arabic text-foreground">عرض الخيارات في موقع الإخفاء</label>
                      <Switch
                        checked={segmentMcqChoicesAtBlank}
                        onCheckedChange={(v) => setSegmentMcqChoicesAtBlank(v)}
                      />
                    </div>
                  )}
                </>
              )}

              {(['beginning', 'middle', 'end', 'beginning-middle', 'middle-end', 'beginning-end', 'beginning-middle-end'] as const).includes(autoBlankMode as any) && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الكلمات: {blankCount}</label>
                  <Slider value={[blankCount]} onValueChange={([v]) => setBlankCount(v)} min={1} max={10} step={1} />
                </div>
              )}

              {autoBlankMode === 'ayah-count' && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الآيات: {ayahCount}</label>
                  <Slider value={[ayahCount]} onValueChange={([v]) => setAyahCount(v)} min={1} max={15} step={1} />
                </div>
              )}

              <div className="flex items-center justify-between p-2 rounded-lg border">
                <label className="text-xs font-arabic text-foreground">كلمة واحدة فقط (تختفي بعد ظهورها)</label>
                <Switch
                  checked={singleWordMode}
                  onCheckedChange={(v) => setSingleWordMode(v)}
                />
              </div>

              {/* Voice recognition toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex flex-col">
                  <label className="text-xs font-arabic text-foreground">التسميع الصوتي</label>
                  <span className="text-[10px] text-muted-foreground font-arabic">
                    {speech.isSupported ? 'يكشف الكلمة عند نطقها صحيحاً' : 'غير متاح في هذا المتصفح'}
                  </span>
                </div>
                <Switch
                  checked={voiceMode}
                  onCheckedChange={(v) => setVoiceMode(v)}
                  disabled={!speech.isSupported}
                />
              </div>
            </div>

            {/* Color settings for active word and revealed words */}
            <div className="space-y-3">
              <label className="text-sm font-arabic text-muted-foreground">إعدادات الألوان</label>
              
              {/* Active word color */}
              <div className="space-y-1.5">
                <label className="text-xs font-arabic text-muted-foreground">لون الكلمة أثناء الظهور</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'gold' as const, label: 'ذهبي', color: 'hsl(45 95% 55%)' },
                    { value: 'green' as const, label: 'أخضر', color: 'hsl(140 60% 40%)' },
                    { value: 'blue' as const, label: 'أزرق', color: 'hsl(210 70% 50%)' },
                    { value: 'orange' as const, label: 'برتقالي', color: 'hsl(30 80% 50%)' },
                    { value: 'purple' as const, label: 'بنفسجي', color: 'hsl(270 60% 50%)' },
                    { value: 'red' as const, label: 'أحمر', color: 'hsl(0 70% 50%)' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setActiveWordColor(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all border ${activeWordColor === opt.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Revealed word color */}
              <div className="space-y-1.5">
                <label className="text-xs font-arabic text-muted-foreground">لون الكلمة بعد ظهورها</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'green' as const, label: 'أخضر', color: 'hsl(140 55% 35%)' },
                    { value: 'blue' as const, label: 'أزرق', color: 'hsl(210 70% 45%)' },
                    { value: 'orange' as const, label: 'برتقالي', color: 'hsl(30 80% 45%)' },
                    { value: 'purple' as const, label: 'بنفسجي', color: 'hsl(270 60% 50%)' },
                    { value: 'primary' as const, label: 'أساسي', color: 'hsl(var(--primary))' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRevealedColor(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all border ${revealedColor === opt.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* With/without background */}
              <div className="flex items-center justify-between p-2 rounded-lg border">
                <label className="text-xs font-arabic text-foreground">إظهار خلفية ملونة للكلمة بعد ظهورها</label>
                <Switch
                  checked={revealedWithBg}
                  onCheckedChange={(v) => setRevealedWithBg(v)}
                />
              </div>
            </div>

            {/* Quiz scope */}
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من صفحة:</label>
                    <Input type="number" min={1} max={604} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-20" />
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى صفحة:</label>
                    <Input type="number" min={1} max={604} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-20" />
                  </div>
                </div>
              )}

              {quizScope === 'surah' && (
                <div className="space-y-2">
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
                </div>
              )}

              {quizScope === 'juz' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من جزء:</label>
                    <Input type="number" min={1} max={30} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى جزء:</label>
                    <Input type="number" min={1} max={30} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                  </div>
                </div>
              )}

              {quizScope === 'hizb' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">من حزب:</label>
                    <Input type="number" min={1} max={60} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                    <label className="text-xs font-arabic text-muted-foreground whitespace-nowrap">إلى حزب:</label>
                    <Input type="number" min={1} max={60} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-8 text-xs w-16" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds < 1 ? `${(firstWordTimerSeconds * 1000).toFixed(0)}ms` : `${firstWordTimerSeconds} ثانية`}</label>
              <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={0.1} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds < 1 ? `${(timerSeconds * 1000).toFixed(0)}ms` : `${timerSeconds} ثانية`}</label>
              <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(+v.toFixed(2))} min={0.1} max={30} step={0.1} />
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

            {/* MCQ display mode toggle */}
            {quizInteraction === 'mcq' && (
              <div className="flex items-center justify-between p-2 rounded-lg border">
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
              <div className="flex items-center justify-between p-2 rounded-lg border">
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

            {/* Dot scale slider */}
            <div className="space-y-1 p-2 rounded-lg border">
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

            <Button onClick={() => { setQuizSource('auto'); handleStartMultiPage(); }} className="w-full font-arabic" disabled={!pageData}>
              <Play className="w-4 h-4 ml-2" />
              ابدأ الاختبار {quizScope === 'current-page' ? `(صفحة ${currentPage})` : `(${quizPagesRange.length} صفحة)`}
            </Button>
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
              onFinish={() => { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); }}
              onRestart={() => {}}
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

            {/* Progress + Voice indicator */}
            <div className="page-frame p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-arabic text-muted-foreground">
                  {revealedKeys.size} / {blankedKeysList.length} كلمة
                </span>
                {/* Voice indicator — disabled */}
              </div>
              <span className={`text-lg font-bold font-arabic ${showAll ? 'text-green-600' : 'text-foreground'}`}>
                {showAll ? '✓ تم الكشف' : `${progress}%`}
              </span>
            </div>

            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

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
                  setTimeout(() => setCurrentRevealIdx(nextIdx), 300);
                } else {
                  setRevealedKeys(prev => singleWordMode ? new Set([activeBlankKey]) : new Set([...prev, activeBlankKey]));
                  setActiveBlankKey(null);
                  const idx = blankedKeysList.indexOf(activeBlankKey);
                  if (idx >= 0) {
                    setTimeout(() => setCurrentRevealIdx(idx + 1), 300);
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
                setCurrentRevealIdx(idx);
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
              
              <Button variant="outline" size="sm" onClick={() => { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); speech.stop(); }} className="font-arabic">
                إعادة
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
            step={0.1}
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
