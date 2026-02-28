import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { useSessionsStore } from '@/stores/sessionsStore';
import { toast } from 'sonner';
import { useQuranData } from '@/hooks/useQuranData';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { useSpeech } from '@/hooks/useSpeech';
import { matchHiddenWordsInOrder, normalizeSpeechArabic, splitWords } from '@/utils/quranSpeechMatch';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, EyeOff, ArrowRight, Save, Trash2, GraduationCap, ListChecks, Zap, Book, Layers, Hash, FileText, Search, X, ChevronLeft, Download, Upload, Settings2, ChevronsRight, Undo2, Mic, MicOff, SlidersHorizontal, Palette } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
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
import { SettingsDialog } from '@/components/SettingsDialog';
import { AutoPlayDebugPanel } from '@/components/AutoPlayDebugPanel';
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

// Voice debug overlay component - shows real-time speech state on device
function VoiceDebugOverlay({ speech, activeBlankKey, wordTextsMap }: {
  speech: ReturnType<typeof useSpeech>;
  activeBlankKey: string | null;
  wordTextsMap: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const transcript = speech.transcriptRef.current || '';
  const targetWord = activeBlankKey ? (wordTextsMap[activeBlankKey] || '') : '';
  const last60 = transcript.length > 60 ? '…' + transcript.slice(-60) : transcript;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 text-white text-xs p-2 font-mono" dir="ltr">
      <div>🎤 {speech.isListening ? '✅ listening' : '❌ not listening'} | {speech.providerType} | perm={speech.permissionState} | t={transcript.length}</div>
      {speech.error && <div className="text-red-400 truncate">⚠️ err: {speech.error}</div>}
      <div className="text-green-400 truncate">📝 "{last60}"</div>
      <div className="text-yellow-400">🎯 target: "{targetWord}"</div>
    </div>
  );
}

export default function TahfeezPage() {
  const {
    storedItems, clearAllItems, addItem, removeItem, getItemKey,
    quizSource, setQuizSource,
    autoBlankMode, setAutoBlankMode,
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
  } = useTahfeezStore();

  const speech = useSpeech();

  const { currentPage, getCurrentPageData, goToPage, totalPages, nextPage, prevPage } = useQuranData();
  useSettingsApplier(); // Apply font/display settings globally
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'auto15');
  const keepScreenAwake = useSettingsStore((s) => s.settings.autoplay.keepScreenAwake ?? false);
  const pageData = getCurrentPageData();

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
        if (keys.length > 0) {
          settled = true;
          // Update refs SYNCHRONOUSLY before state updates so advance() reads correct data
          blankedKeysListRef.current = keys;
          firstKeysSetRef.current = new Set(fKeys);
          wordTextsMapRef.current = wordTexts;
          setBlankedKeysList(keys);
          setFirstKeysSet(new Set(fKeys));

          // Auto-resume after page transition OR first start
          if (autoResumeQuizRef.current || isFirstStartRef.current) {
            autoResumeQuizRef.current = false;
            isFirstStartRef.current = false;
            console.log('[tahfeez] Starting quiz, keys count:', keys.length);
            // Set state directly — no requestAnimationFrame delay
            setRevealedKeys(new Set());
            setShowAll(false);
            setActiveBlankKey(null);
            setCurrentRevealIdx(0);
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
          setRevealedKeys(prev => new Set([...prev, key]));
          setActiveBlankKey(null);
          // Don't stop speech between words - keep mic running for continuous recognition
          revealTimerRef.current = setTimeout(() => advance(idx + 1), 80);
        };

        const startVoiceOrTimer = () => {
          setActiveBlankKey(key);
          console.log('[tahfeez][voice-check]', JSON.stringify({
            useVoice,
            wordText: wordText?.substring(0, 20),
            isSupported: speechRef.current.isSupported,
            isListening: speechRef.current.isListening,
            providerType: speechRef.current.providerType,
            transcriptLen: (speechRef.current.transcriptRef.current || '').length,
          }));
          if (useVoice && wordText && speechRef.current.isSupported) {
            const sr = speechRef.current;
            // Track the transcript snapshot at the start of this word.
            let lastKnownTranscript = sr.transcriptRef.current || '';
            let baseTranscriptLen = lastKnownTranscript.length;

            // Only start speech if not already listening
            if (!sr.isListening) {
              try {
                const startResult = sr.start('ar-SA');
                if (startResult && typeof startResult.then === 'function') {
                  startResult.then((started: boolean) => {
                    if (!started) {
                      console.log('[tahfeez] Speech failed to start, waiting');
                      revealTimerRef.current = setTimeout(() => revealAndAdvance(), 60000);
                    }
                  }).catch(() => {
                    revealTimerRef.current = setTimeout(() => revealAndAdvance(), 60000);
                  });
                }
              } catch {
                revealTimerRef.current = setTimeout(() => revealAndAdvance(), 60000);
              }
            }

            // Poll transcript for match every 100ms
            let voicePollCount = 0;
            const maxPolls = 600; // 60 seconds max
            // Track which words we've already matched to avoid re-matching
            const matchedWordsSet = new Set<string>();
            
            const pollForMatch = () => {
              voicePollCount++;
              const currentTranscript = speechRef.current.transcriptRef.current || '';
              
              // Use FULL transcript for matching (not substring-based)
              // Native engine resets transcript on auto-restart, so baseline approach is unreliable
              const normWord = wordText.replace(/[\u0610-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
              const shortWord = normWord.length <= 3;
              const level = matchLevelRef.current;
              const threshMap = { strict: shortWord ? 0.65 : 0.85, medium: shortWord ? 0.50 : 0.75, loose: shortWord ? 0.35 : 0.55 };
              const thresh = threshMap[level] || threshMap.medium;
              
              // Log EVERY poll for first 5, then every 10 — critical for native debugging
              if (voicePollCount <= 5 || voicePollCount % 10 === 1) {
                console.log('[tahfeez][poll]', JSON.stringify({
                  poll: voicePollCount,
                  word: wordText,
                  normWord,
                  transcript: currentTranscript.substring(Math.max(0, currentTranscript.length - 80)),
                  tLen: currentTranscript.length,
                  thresh,
                  isListening: speechRef.current.isListening,
                  provider: speechRef.current.providerType,
                }));
              }
              
              if (currentTranscript) {
                // Strategy 1: Match using the full transcript
                const targetWords = [wordText];
                const result = matchHiddenWordsInOrder(currentTranscript, targetWords, thresh);
                if (result.success) {
                  console.log('[tahfeez] ✓ Voice match (S1)!', wordText);
                  revealAndAdvance();
                  return;
                }
                
                // Strategy 2: Direct normalized word search in transcript
                const normTarget = normalizeSpeechArabic(wordText);
                const spokenWords = splitWords(normalizeSpeechArabic(currentTranscript));
                if (normTarget && spokenWords.some(sw => sw === normTarget || sw.includes(normTarget) || normTarget.includes(sw))) {
                  console.log('[tahfeez] ✓ Voice match (S2)!', wordText);
                  revealAndAdvance();
                  return;
                }
                
                // Strategy 3: Check only new portion since last poll
                const newPart = currentTranscript.substring(baseTranscriptLen).trim();
                if (newPart) {
                  const newResult = matchHiddenWordsInOrder(newPart, targetWords, thresh);
                  if (newResult.success) {
                    console.log('[tahfeez] ✓ Voice match (new part)!', newPart, '→', wordText);
                    revealAndAdvance();
                    return;
                  }
                }
              }
              
              // Detect transcript reset (speech engine auto-restarted)
              if (currentTranscript.length < baseTranscriptLen) {
                baseTranscriptLen = 0;
                lastKnownTranscript = '';
              }
              lastKnownTranscript = currentTranscript;
              baseTranscriptLen = currentTranscript.length;
              
              if (voicePollCount >= maxPolls) {
                console.log('[tahfeez] Voice timeout, revealing');
                revealAndAdvance();
                return;
              }
              revealTimerRef.current = setTimeout(pollForMatch, 100);
            };
            revealTimerRef.current = setTimeout(pollForMatch, 100);
          } else {
            // Timer mode: reveal after timerSeconds
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
              <SettingsDialog>
                <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="الإعدادات">
                  <Settings2 className="w-4 h-4" />
                </button>
              </SettingsDialog>
              <button onClick={() => setShowIndex(true)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="فهرس المصحف">
                <Book className="w-4 h-4" />
              </button>
              <Link to="/mushaf" className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="بوابة الغريب">
                <BookOpen className="w-4 h-4" />
              </Link>
              <Link to="/" className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </Link>
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

      {/* Voice debug overlay - shows transcript in real-time on device */}
      {quizStarted && voiceMode && (
        <VoiceDebugOverlay speech={speech} activeBlankKey={activeBlankKey} wordTextsMap={wordTextsMapRef.current} />
      )}

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

      <div className={`mx-auto space-y-6 max-w-2xl w-full px-3 py-2 sm:py-6`} style={{ transform: `scale(${pinchScale})`, transformOrigin: 'top center', transition: pinchRef.current ? 'none' : 'transform 0.2s ease' }}>
        {/* Tab 1: Store words */}
        {!quizStarted && activeTab === 'store' && (
          <div className="space-y-4 animate-fade-in">
            {pageData && (
              <TahfeezSelectionView page={pageData} />
            )}

            {storedItems.length > 0 && (
              <div className="page-frame p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-arabic font-bold text-sm text-foreground">
                    المخزون ({storedItems.length})
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
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {storedItems.map((item, i) => (
                    <StoredItemBadge key={i} item={item} />
                  ))}
                </div>
              </div>
            )}
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
                  <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds} ثانية</label>
                  <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(v)} min={1} max={30} step={1} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds} ثانية</label>
                  <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={1} max={10} step={1} />
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

                {/* Voice Recognition Mode */}
                {speech.isSupported && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <label className="text-sm font-arabic font-medium text-foreground flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        وضع التعرف على الصوت
                      </label>
                      <p className="text-xs font-arabic text-muted-foreground mt-0.5">انطق الكلمة المخفية لكشفها بدلاً من المؤقت</p>
                    </div>
                    <Switch
                      checked={voiceMode}
                      onCheckedChange={setVoiceMode}
                    />
                  </div>
                )}

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
                    variant={autoBlankMode === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAutoBlankMode(opt.value)}
                    className="font-arabic text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

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
              <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds} ثانية</label>
              <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(v)} min={1} max={30} step={1} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds} ثانية</label>
              <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={1} max={10} step={1} />
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

            {/* Voice Recognition Mode */}
            {speech.isSupported && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <label className="text-sm font-arabic font-medium text-foreground flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    وضع التعرف على الصوت
                  </label>
                  <p className="text-xs font-arabic text-muted-foreground mt-0.5">انطق الكلمة المخفية لكشفها بدلاً من المؤقت</p>
                </div>
                <Switch
                  checked={voiceMode}
                  onCheckedChange={setVoiceMode}
                />
              </div>
            )}

            <Button onClick={() => { setQuizSource('auto'); handleStartMultiPage(); }} className="w-full font-arabic" disabled={!pageData}>
              <Play className="w-4 h-4 ml-2" />
              ابدأ الاختبار {quizScope === 'current-page' ? `(صفحة ${currentPage})` : `(${quizPagesRange.length} صفحة)`}
            </Button>
          </div>
        )}

        {/* Quiz view */}
        <AutoPlayDebugPanel visible={process.env.NODE_ENV !== 'production'} />
        {quizStarted && pageData && (
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
                {voiceMode && speech.isListening && (
                  <span className="flex items-center gap-1 text-xs font-arabic text-primary animate-pulse">
                    <Mic className="w-3.5 h-3.5" />
                    يستمع...
                  </span>
                )}
                {voiceMode && speech.transcript && !showAll && (
                  <span className="text-xs font-arabic text-muted-foreground truncate max-w-[120px]" title={speech.transcript}>
                    «{speech.transcript}»
                  </span>
                )}
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

            <TahfeezQuizView
              page={pageData}
              quizSource={quizSource}
              storedItems={storedItems}
              autoBlankMode={autoBlankMode}
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
                // Stop timers, reveal the word immediately, advance (keep speech running)
                if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
                setRevealedKeys(prev => new Set([...prev, activeBlankKey]));
                setActiveBlankKey(null);
                const idx = blankedKeysList.indexOf(activeBlankKey);
                if (idx >= 0) {
                  // Advance to next by updating currentRevealIdx — the effect will pick it up
                  setTimeout(() => setCurrentRevealIdx(idx + 1), 300);
                }
              }}
            />

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="font-arabic">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 font-arabic" style={{ direction: 'rtl' }}>
                  <DropdownMenuLabel className="text-xs">درجة المطابقة</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={matchLevel} onValueChange={(v) => setMatchLevel(v as any)}>
                    <DropdownMenuRadioItem value="strict" className="text-xs">صارم</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="medium" className="text-xs">متوسط</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="loose" className="text-xs">مرن</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">لون الكلمة بعد ظهورها</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={revealedColor} onValueChange={(v) => setRevealedColor(v as any)}>
                    <DropdownMenuRadioItem value="green" className="text-xs">
                      <span className="w-3 h-3 rounded-full ml-2 inline-block" style={{ background: 'hsl(140 55% 35%)' }} />أخضر
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="blue" className="text-xs">
                      <span className="w-3 h-3 rounded-full ml-2 inline-block" style={{ background: 'hsl(210 70% 45%)' }} />أزرق
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="orange" className="text-xs">
                      <span className="w-3 h-3 rounded-full ml-2 inline-block" style={{ background: 'hsl(30 80% 45%)' }} />برتقالي
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="purple" className="text-xs">
                      <span className="w-3 h-3 rounded-full ml-2 inline-block" style={{ background: 'hsl(270 60% 50%)' }} />بنفسجي
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="primary" className="text-xs">
                      <span className="w-3 h-3 rounded-full ml-2 inline-block bg-primary" />أساسي
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); speech.stop(); }} className="font-arabic">
                إعادة
              </Button>
            </div>
          </div>
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
