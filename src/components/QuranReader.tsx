import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AutoPlayDebugPanel } from './AutoPlayDebugPanel';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';


import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
import { Toolbar } from './Toolbar';
import { QuranIndex } from './QuranIndex';
import { DiagnosticModeBadge } from './DiagnosticModeActivator';
import { HiddenBarsOverlay } from './HiddenBarsOverlay';
import { FirstTimeSetupDialog } from './FirstTimeSetupDialog';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDevDebugContextStore } from '@/stores/devDebugContextStore';
import { useDiagnosticModeStore } from '@/stores/diagnosticModeStore';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSessionsStore } from '@/stores/sessionsStore';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { Loader2, List, SlidersHorizontal, ChevronRight, ChevronLeft, Eye, EyeOff, GraduationCap, X, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GhareebEntryDialog, GhareebEntryResetButton } from './GhareebEntryDialog';

const JUZ_DATA_READER = [
  { number: 1, page: 1 }, { number: 2, page: 22 }, { number: 3, page: 42 },
  { number: 4, page: 62 }, { number: 5, page: 82 }, { number: 6, page: 102 },
  { number: 7, page: 121 }, { number: 8, page: 142 }, { number: 9, page: 162 },
  { number: 10, page: 182 }, { number: 11, page: 201 }, { number: 12, page: 222 },
  { number: 13, page: 242 }, { number: 14, page: 262 }, { number: 15, page: 282 },
  { number: 16, page: 302 }, { number: 17, page: 322 }, { number: 18, page: 342 },
  { number: 19, page: 362 }, { number: 20, page: 382 }, { number: 21, page: 402 },
  { number: 22, page: 422 }, { number: 23, page: 442 }, { number: 24, page: 462 },
  { number: 25, page: 482 }, { number: 26, page: 502 }, { number: 27, page: 522 },
  { number: 28, page: 542 }, { number: 29, page: 562 }, { number: 30, page: 582 },
];

const SURAHS_READER = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name,
  startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

export function QuranReader() {
  const {
    pages, isLoading, error, currentPage, currentWordIndex, setCurrentWordIndex,
    totalPages, getCurrentPageData, getPageGhareebWords, allGhareebWords,
    goToPage, nextPage, prevPage, ghareebPageMap,
  } = useQuranData();

  const settings = useSettingsApplier();
  const clearAllOverrides = useHighlightOverrideStore((s) => s.clearAllOverrides);
  useEffect(() => { clearAllOverrides(); }, [clearAllOverrides]);

  // Navigate to ghareeb range start page if set
  useEffect(() => {
    const startPage = localStorage.getItem('quran-app-ghareeb-start-page');
    if (startPage) {
      localStorage.removeItem('quran-app-ghareeb-start-page');
      const pageNum = parseInt(startPage, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
        goToPage(pageNum);
      }
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save session progress
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const updateSession = useSessionsStore((s) => s.updateSession);
  
  useEffect(() => {
    if (activeSessionId) {
      updateSession(activeSessionId, { currentPage });
    }
  }, [currentPage, activeSessionId, updateSession]);

  const [renderedWords, setRenderedWords] = useState<GhareebWord[]>([]);
  const [showIndex, setShowIndex] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [hideBars, setHideBars] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = React.useRef<{ startDist: number; startScale: number } | null>(null);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(() => !localStorage.getItem('quran-app-setup-done'));
  const contentRef = React.useRef<HTMLDivElement>(null);
  const pageContentRef = React.useRef<HTMLDivElement>(null);
  const swipeRef = React.useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const navigate = useNavigate();
  const tahfeezMode = useTahfeezStore((s) => s.selectionMode);
  const setTahfeezMode = useTahfeezStore((s) => s.setSelectionMode);
  const tahfeezSelectedCount = useTahfeezStore((s) => s.selectedWords.length);
  const clearTahfeezSelection = useTahfeezStore((s) => s.clearSelection);

  const pageData = getCurrentPageData();
  const pageWords = getPageGhareebWords;

  // DEV Debug context
  const setDevDebugContext = useDevDebugContextStore((s) => s.setContext);
  const isDiagnosticEnabled = useDiagnosticModeStore((s) => s.isEnabled);
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (!isDiagnosticEnabled && !isDev) return;
    if (!pageData) return;
    setDevDebugContext({
      source: 'reader', page: pageData, pageNumber: currentPage,
      ghareebWords: pageWords, renderedWords,
      invalidateCache: () => window.location.reload(),
      allPages: pages, ghareebPageMap, onNavigateToPage: goToPage,
    });
  }, [currentPage, pageData, pageWords, renderedWords, setDevDebugContext, isDiagnosticEnabled, isDev, pages, ghareebPageMap, goToPage]);

  const autoAdvancePage = useSettingsStore(s => s.settings.autoplay.autoAdvancePage);
  const ghareebRangeType = useSettingsStore(s => s.settings.autoplay.ghareebRangeType);
  const ghareebRangeFrom = useSettingsStore(s => s.settings.autoplay.ghareebRangeFrom);
  const ghareebRangeTo = useSettingsStore(s => s.settings.autoplay.ghareebRangeTo);
  const autoPlayOnWordClick = useSettingsStore(s => s.settings.autoplay.autoPlayOnWordClick);
  const keepScreenAwake = useSettingsStore(s => s.settings.autoplay.keepScreenAwake ?? false);

  // Keep currentPage in a ref so handlePageEnd always reads the latest value (avoids stale closure)
  const currentPageRef = React.useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Compute pages range for Ghareeb auto-advance
  const ghareebPagesRange = useMemo(() => {
    if (ghareebRangeType === 'all') return null; // no restriction
    if (ghareebRangeType === 'page-range') {
      const from = Math.min(ghareebRangeFrom, ghareebRangeTo);
      const to = Math.max(ghareebRangeFrom, ghareebRangeTo);
      const pages: number[] = [];
      for (let p = from; p <= Math.min(to, 604); p++) pages.push(p);
      return pages;
    }
    if (ghareebRangeType === 'surah') {
      const from = Math.min(ghareebRangeFrom, ghareebRangeTo);
      const to = Math.max(ghareebRangeFrom, ghareebRangeTo);
      // startPage = first page of surahFrom
      const startSurahInfo = SURAH_INFO[from];
      if (!startSurahInfo) return null;
      const startPage = startSurahInfo[0];
      // endPage = last page of surahTo (= startPage of next surah - 1)
      const nextSurah = SURAHS_READER.find(s => s.number === to + 1);
      const endPage = nextSurah ? nextSurah.startPage - 1 : 604;
      const pages: number[] = [];
      for (let p = startPage; p <= Math.min(endPage, 604); p++) pages.push(p);
      return pages;
    }
    if (ghareebRangeType === 'juz') {
      const from = Math.min(ghareebRangeFrom, ghareebRangeTo);
      const to = Math.max(ghareebRangeFrom, ghareebRangeTo);
      const startPage = JUZ_DATA_READER[Math.max(0, from - 1)]?.page || 1;
      const endPage = to < 30 ? (JUZ_DATA_READER[to]?.page || 605) - 1 : 604;
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) pages.push(p);
      return pages;
    }
    if (ghareebRangeType === 'hizb') {
      const from = Math.min(ghareebRangeFrom, ghareebRangeTo);
      const to = Math.max(ghareebRangeFrom, ghareebRangeTo);
      const fromJuzIdx = Math.floor((from - 1) / 2);
      const toJuzIdx = Math.floor((to - 1) / 2);
      const isSecondHalf = (from - 1) % 2 === 1;
      const toIsSecondHalf = (to - 1) % 2 === 1;
      const fromJuz = JUZ_DATA_READER[fromJuzIdx];
      const toJuzEntry = JUZ_DATA_READER[toJuzIdx];
      if (!fromJuz || !toJuzEntry) return null;
      const startPage = isSecondHalf
        ? Math.floor((fromJuz.page + (JUZ_DATA_READER[fromJuzIdx + 1]?.page || 605)) / 2)
        : fromJuz.page;
      let endPage: number;
      if (toIsSecondHalf) {
        endPage = (toJuzIdx + 1 < 30 ? (JUZ_DATA_READER[toJuzIdx + 1]?.page || 605) : 605) - 1;
      } else {
        const juzEnd = JUZ_DATA_READER[toJuzIdx + 1]?.page || 605;
        endPage = Math.floor((toJuzEntry.page + juzEnd) / 2) - 1;
      }
      const pages: number[] = [];
      for (let p = startPage; p <= Math.min(endPage, 604); p++) pages.push(p);
      return pages;
    }
    return null;
  }, [ghareebRangeType, ghareebRangeFrom, ghareebRangeTo]);

  // Determine what nextPage to call based on range.
  // Uses currentPageRef (not currentPage state) to always read the LATEST page
  // and avoid stale closure bugs in setTimeout chains.
  const ghareebPagesRangeRef = React.useRef(ghareebPagesRange);
  useEffect(() => { ghareebPagesRangeRef.current = ghareebPagesRange; }, [ghareebPagesRange]);
  const autoAdvancePageRef = React.useRef(autoAdvancePage);
  useEffect(() => { autoAdvancePageRef.current = autoAdvancePage; }, [autoAdvancePage]);

  const handlePageEnd = useCallback(() => {
    const curPage = currentPageRef.current;
    const range = ghareebPagesRangeRef.current;
    const hasRange = range !== null;

    // If a specific range is defined, always advance within it (regardless of autoAdvancePage setting)
    // If no range (all), respect the autoAdvancePage setting
    if (!hasRange && !autoAdvancePageRef.current) return;

    console.log('[handlePageEnd] ✅ called. curPage:', curPage, 'range:', range ? `${range[0]}-${range[range.length-1]}` : 'all');

    if (range) {
      const idx = range.indexOf(curPage);
      if (idx >= 0 && idx < range.length - 1) {
        goToPage(range[idx + 1]);
      }
      // else: end of defined range - stop naturally
    } else {
      nextPage();
    }
  // goToPage and nextPage are stable from useQuranData
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goToPage, nextPage]);

  const {
    isPlaying, speed, setSpeed, play, pause, stop, nextWord, prevWord, jumpTo,
  } = useAutoPlay({ words: renderedWords, currentWordIndex, setCurrentWordIndex, onPageEnd: handlePageEnd, portal: 'غريب', currentPage });

  useKeepAwake(keepScreenAwake && isPlaying);

  const handleRenderedWordsChange = useCallback((words: GhareebWord[]) => {
    if (settings.debugMode) console.log('[QuranReader] Rendered words:', words.length);
    setRenderedWords(words);
  }, [settings.debugMode]);

  const handleWordClick = useCallback((_: GhareebWord, index: number) => {
    jumpTo(index);
    // If autoPlayOnWordClick is enabled and not already playing, start playing
    if (autoPlayOnWordClick && !isPlaying) {
      // Small delay to let jumpTo settle
      setTimeout(() => play(), 50);
    }
  }, [jumpTo, autoPlayOnWordClick, isPlaying, play]);

  const handlePlayPause = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  // Pinch-to-zoom handler
  useEffect(() => {
    const el = pageContentRef.current;
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
        // Cancel swipe if vertical movement is dominant
        const dy = Math.abs(e.touches[0].clientY - swipeRef.current.startY);
        const dx = Math.abs(e.touches[0].clientX - swipeRef.current.startX);
        if (dy > dx * 1.5) swipeRef.current = null;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      // Handle swipe for page navigation
      if (swipeRef.current && e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
        const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.startY);
        const elapsed = Date.now() - swipeRef.current.startTime;
        const absDx = Math.abs(dx);
        // Require: horizontal > 60px, faster than 400ms, and more horizontal than vertical
        if (absDx > 60 && elapsed < 400 && absDx > dy * 1.5) {
          // RTL: swipe left = next page, swipe right = prev page (reversed for RTL)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="font-arabic text-muted-foreground">جاري تحميل القرآن الكريم...</p>
        </div>
      </div>
    );
  }

  if (error || pages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="page-frame p-8 max-w-md text-center">
          <p className="font-arabic text-destructive text-lg mb-2">{error || 'لم يتم تحميل البيانات'}</p>
          <p className="font-arabic text-muted-foreground text-sm">تأكد من وجود ملفات البيانات في مجلد public/data</p>
        </div>
      </div>
    );
  }

  const meaningActive = isPlaying || currentWordIndex >= 0;

  return (
    <div className="bg-background flex min-h-screen" dir="rtl" ref={contentRef}>
      <DiagnosticModeBadge />
      <FirstTimeSetupDialog open={showFirstTimeSetup} onClose={() => setShowFirstTimeSetup(false)} />
      <GhareebEntryDialog open={showEntryDialog} onClose={() => setShowEntryDialog(false)} />

      {/* Index Sidebar */}
      {showIndex && (
        <div className="fixed inset-0 z-40 flex sm:relative sm:inset-auto">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm sm:hidden" onClick={() => setShowIndex(false)} />
          <div className="relative z-50 w-72 sm:w-60 h-screen shrink-0 border-l border-border shadow-xl sm:shadow-none bg-card">
            <QuranIndex currentPage={currentPage} onNavigateToPage={goToPage} onClose={() => setShowIndex(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        {!hideBars && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="max-w-2xl mx-auto px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Toolbar
                  isPlaying={isPlaying}
                  onPlayPause={handlePlayPause}
                  wordsCount={renderedWords.length}
                  currentWordIndex={currentWordIndex}
                  currentPage={currentPage}
                  pages={pages}
                  pageWords={renderedWords}
                  allWords={allGhareebWords}
                  renderedWords={renderedWords}
                  onNavigateToPage={goToPage}
                  onHighlightWord={jumpTo}
                  onRefreshData={() => window.location.reload()}
                  onForceRebuild={() => window.location.reload()}
                />
                <GhareebEntryResetButton onReset={() => setShowEntryDialog(true)} />
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div
          className="w-full max-w-2xl mx-auto px-1 sm:px-3 py-2 sm:py-6"
          ref={pageContentRef}
        >
          {settings.debugMode && isPlaying && (
            <div className="fixed top-16 right-4 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded-lg font-mono">
              Running {currentWordIndex + 1} / {renderedWords.length}
            </div>
          )}
          <AutoPlayDebugPanel visible={!!settings.debugMode} />

          <div style={{ transform: pinchScale !== 1 ? `scale(${pinchScale})` : undefined, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
            {pageData ? (
              <PageView
                page={pageData}
                ghareebWords={pageWords}
                highlightedWordIndex={currentWordIndex}
                meaningEnabled={meaningActive}
                isPlaying={isPlaying}
                onWordClick={handleWordClick}
                onRenderedWordsChange={handleRenderedWordsChange}
                hidePageBadge={false}
              />
            ) : null}
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        {!hideBars && (
        <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="max-w-2xl mx-auto px-3 py-2">
            {/* Page navigation - always visible */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage <= 1}
                  className="nav-button w-10 h-10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  title="الصفحة الأولى"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={prevPage}
                  disabled={currentPage <= 1}
                  className="nav-button w-10 h-10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Index toggle */}
                <button
                  onClick={() => setShowIndex(!showIndex)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    showIndex ? 'bg-primary text-primary-foreground' : 'nav-button'
                  }`}
                  title="فهرس المصحف"
                >
                  <List className="w-3.5 h-3.5" />
                </button>

                {/* Controls toggle */}
                <button
                  onClick={() => setShowControls(!showControls)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    showControls ? 'bg-primary text-primary-foreground' : 'nav-button'
                  }`}
                  title="أدوات التشغيل"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                {/* Tahfeez mode - navigate to /tahfeez */}
                <button
                  onClick={() => navigate('/tahfeez')}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative nav-button`}
                  title="بوابة التحفيظ"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  {tahfeezSelectedCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center font-bold">
                      {tahfeezSelectedCount > 99 ? '99+' : tahfeezSelectedCount}
                    </span>
                  )}
                </button>

                {/* Page indicator */}
                <div className="bg-card border border-border rounded-full px-3 py-1 flex items-center gap-1">
                  <span className="font-arabic text-sm font-bold text-foreground">{currentPage}</span>
                  <span className="text-muted-foreground text-[10px] font-arabic">/ {totalPages}</span>
                </div>

                {/* Hide bars toggle */}
                <button
                  onClick={() => setHideBars(true)}
                  className="nav-button w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  title="إخفاء الأزرار"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  className="nav-button w-10 h-10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="nav-button w-10 h-10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  title="الصفحة الأخيرة"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Expandable autoplay controls */}
            {showControls && renderedWords.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50 animate-fade-in">
                <AutoPlayControls
                  isPlaying={isPlaying}
                  speed={speed}
                  wordsCount={renderedWords.length}
                  currentWordIndex={currentWordIndex}
                  onPlay={play}
                  onPause={pause}
                  onStop={stop}
                  onNext={nextWord}
                  onPrev={prevWord}
                  onSpeedChange={setSpeed}
                />
              </div>
            )}

            {/* Tahfeez selection bar */}
            {tahfeezMode && (
              <div className="mt-2 pt-2 border-t border-border/50 animate-fade-in flex items-center justify-between gap-2">
                <span className="text-xs font-arabic text-primary font-bold">
                  وضع التحفيظ ({tahfeezSelectedCount} كلمة)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={clearTahfeezSelection}
                    className="nav-button h-7 px-2 rounded-full flex items-center gap-1 text-xs font-arabic"
                    disabled={tahfeezSelectedCount === 0}
                  >
                    <X className="w-3 h-3" />
                    مسح
                  </button>
                  <button
                    onClick={() => navigate('/tahfeez')}
                    className="control-button h-7 px-3 rounded-full flex items-center gap-1 text-xs font-arabic"
                  >
                    <GraduationCap className="w-3 h-3" />
                    بوابة التحفيظ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Show bars button - floating when bars are hidden, appears on double-tap for 3s */}
        {hideBars && (
          <HiddenBarsOverlay onShow={() => setHideBars(false)} onNextPage={nextPage} onPrevPage={prevPage} />
        )}

        {/* Footer */}
        {!hideBars && (
          <div className="text-center text-[9px] text-muted-foreground/50 font-arabic py-1">
            يُحفظ تقدمك تلقائياً
          </div>
        )}
      </div>
    </div>
  );
}
