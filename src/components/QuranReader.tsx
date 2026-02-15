import React, { useCallback, useEffect, useState } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';



import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
import { Toolbar } from './Toolbar';
import { QuranIndex } from './QuranIndex';
import { DiagnosticModeBadge } from './DiagnosticModeActivator';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDevDebugContextStore } from '@/stores/devDebugContextStore';
import { useDiagnosticModeStore } from '@/stores/diagnosticModeStore';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSessionsStore } from '@/stores/sessionsStore';
import { Loader2, List, SlidersHorizontal, ChevronRight, ChevronLeft, Maximize2, Minimize2, GraduationCap, Save, X, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function QuranReader() {
  const {
    pages, isLoading, error, currentPage, currentWordIndex, setCurrentWordIndex,
    totalPages, getCurrentPageData, getPageGhareebWords, allGhareebWords,
    goToPage, nextPage, prevPage, ghareebPageMap,
  } = useQuranData();

  const settings = useSettingsApplier();
  const clearAllOverrides = useHighlightOverrideStore((s) => s.clearAllOverrides);
  useEffect(() => { clearAllOverrides(); }, [clearAllOverrides]);

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
  const [fullscreen, setFullscreen] = useState(false);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = React.useRef<{ startDist: number; startScale: number } | null>(null);
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

  const {
    isPlaying, speed, setSpeed, play, pause, stop, nextWord, prevWord, jumpTo,
  } = useAutoPlay({ words: renderedWords, currentWordIndex, setCurrentWordIndex });

  const handleRenderedWordsChange = useCallback((words: GhareebWord[]) => {
    if (settings.debugMode) console.log('[QuranReader] Rendered words:', words.length);
    setRenderedWords(words);
  }, [settings.debugMode]);

  const handleWordClick = useCallback((_: GhareebWord, index: number) => { jumpTo(index); }, [jumpTo]);

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
    <div className={`bg-background flex ${fullscreen ? 'h-screen' : 'min-h-screen'}`} dir="rtl" ref={contentRef}>
      <DiagnosticModeBadge />

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
        {!fullscreen && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
            <div className="max-w-2xl mx-auto px-3 py-2">
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
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className={`max-w-2xl mx-auto w-full px-1 sm:px-3 ${fullscreen ? 'flex-1 flex flex-col justify-center py-1' : 'py-2 sm:py-6'}`} ref={pageContentRef}>
          {settings.debugMode && isPlaying && (
            <div className="fixed top-16 left-4 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded-lg font-mono">
              Running {currentWordIndex + 1} / {renderedWords.length}
            </div>
          )}

          <div style={{ transform: pinchScale !== 1 ? `scale(${pinchScale})` : undefined, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
            {pageData && (
              <PageView
                page={pageData}
                ghareebWords={pageWords}
                highlightedWordIndex={currentWordIndex}
                meaningEnabled={meaningActive}
                isPlaying={isPlaying}
                onWordClick={handleWordClick}
                onRenderedWordsChange={handleRenderedWordsChange}
                hidePageBadge={fullscreen}
                fullscreen={fullscreen}
              />
            )}
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        {!fullscreen && (
        <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50">
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
                {!fullscreen && (
                  <div className="bg-card border border-border rounded-full px-3 py-1 flex items-center gap-1">
                    <span className="font-arabic text-sm font-bold text-foreground">{currentPage}</span>
                    <span className="text-muted-foreground text-[10px] font-arabic">/ {totalPages}</span>
                  </div>
                )}

                {/* Fullscreen toggle */}
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    fullscreen ? 'bg-primary text-primary-foreground' : 'nav-button'
                  }`}
                  title={fullscreen ? 'إظهار الأشرطة' : 'وضع القراءة'}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
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

        {/* Footer - hidden in fullscreen */}
        {!fullscreen && (
          <div className="text-center text-[9px] text-muted-foreground/50 font-arabic py-1">
            يُحفظ تقدمك تلقائياً
          </div>
        )}
      </div>
    </div>
  );
}
