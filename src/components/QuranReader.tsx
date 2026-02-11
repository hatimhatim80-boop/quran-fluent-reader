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
import { useDevDebugContextStore } from '@/stores/devDebugContextStore';
import { useDiagnosticModeStore } from '@/stores/diagnosticModeStore';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import { Loader2, List, SlidersHorizontal } from 'lucide-react';

export function QuranReader() {
  const {
    pages,
    isLoading,
    error,
    currentPage,
    currentWordIndex,
    setCurrentWordIndex,
    totalPages,
    getCurrentPageData,
    getPageGhareebWords,
    allGhareebWords,
    goToPage,
    nextPage,
    prevPage,
    ghareebPageMap,
  } = useQuranData();

  // Apply settings to CSS variables in real-time
  const settings = useSettingsApplier();

  // Clear all highlight overrides on startup (remove old dev debug edits)
  const clearAllOverrides = useHighlightOverrideStore((s) => s.clearAllOverrides);
  useEffect(() => {
    clearAllOverrides();
  }, [clearAllOverrides]);

  // SINGLE SOURCE OF TRUTH: rendered words from PageView
  const [renderedWords, setRenderedWords] = useState<GhareebWord[]>([]);
  const [showIndex, setShowIndex] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const pageData = getCurrentPageData();
  const pageWords = getPageGhareebWords; // Used as input to PageView matching

  // DEV Debug (global overlay) context
  const setDevDebugContext = useDevDebugContextStore((s) => s.setContext);
  const isDiagnosticEnabled = useDiagnosticModeStore((s) => s.isEnabled);
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    // Set context if EITHER diagnostic mode is enabled OR we're in dev environment
    if (!isDiagnosticEnabled && !isDev) return;
    if (!pageData) return;

    setDevDebugContext({
      source: 'reader',
      page: pageData,
      pageNumber: currentPage,
      ghareebWords: pageWords,
      renderedWords,
      invalidateCache: () => window.location.reload(),
      // Global audit data
      allPages: pages,
      ghareebPageMap,
      onNavigateToPage: goToPage,
    });
  }, [currentPage, pageData, pageWords, renderedWords, setDevDebugContext, isDiagnosticEnabled, isDev, pages, ghareebPageMap, goToPage]);

  const {
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
    jumpTo,
  } = useAutoPlay({
    words: renderedWords, // Use rendered words for autoplay
    currentWordIndex,
    setCurrentWordIndex,
  });

  // Callback when PageView reports its rendered words
  const handleRenderedWordsChange = useCallback((words: GhareebWord[]) => {
    if (settings.debugMode) {
      console.log('[QuranReader] Rendered words received:', words.length);
    }
    setRenderedWords(words);
  }, [settings.debugMode]);

  // When user clicks a word, jump to it (works during playback too)
  const handleWordClick = useCallback((_: GhareebWord, index: number) => {
    jumpTo(index);
  }, [jumpTo]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Loading state
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

  // Error state
  if (error || pages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="page-frame p-8 max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="font-arabic text-destructive text-lg mb-2">{error || 'لم يتم تحميل البيانات'}</p>
          <p className="font-arabic text-muted-foreground text-sm">
            تأكد من وجود ملفات البيانات في مجلد public/data
          </p>
        </div>
      </div>
    );
  }

  // Determine if meanings should show (playing or has selection)
  const meaningActive = isPlaying || currentWordIndex >= 0;

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Diagnostic Mode Badge - fixed position */}
      <DiagnosticModeBadge />

      {/* Index Sidebar */}
      {showIndex && (
        <div className="fixed inset-0 z-40 flex sm:relative sm:inset-auto">
          {/* Backdrop on mobile */}
          <div className="fixed inset-0 bg-black/30 sm:hidden" onClick={() => setShowIndex(false)} />
          <div className="relative z-50 w-72 sm:w-64 h-screen shrink-0 border-l border-border shadow-lg sm:shadow-none bg-card">
            <QuranIndex
              currentPage={currentPage}
              onNavigateToPage={goToPage}
              onClose={() => setShowIndex(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5">
          {/* Index Toggle + Toolbar */}
          <div className="flex items-start gap-2">
            <button
              onClick={() => setShowIndex(!showIndex)}
              className={`nav-button w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-[2px] ${showIndex ? 'bg-primary/20 border-primary' : ''}`}
              title="فهرس المصحف"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="flex-1">
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
                onRefreshData={() => {
                  window.location.reload();
                }}
                onForceRebuild={() => {
                  window.location.reload();
                }}
              />
            </div>
          </div>

          {/* Debug display when enabled */}
          {settings.debugMode && isPlaying && (
            <div className="fixed top-4 left-4 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded-lg font-mono">
              Running {currentWordIndex + 1} / {renderedWords.length}
            </div>
          )}

          {/* Page View */}
          {pageData && (
            <PageView
              page={pageData}
              ghareebWords={pageWords}
              highlightedWordIndex={currentWordIndex}
              meaningEnabled={meaningActive}
              isPlaying={isPlaying}
              onWordClick={handleWordClick}
              onRenderedWordsChange={handleRenderedWordsChange}
            />
          )}

          {/* Controls Toggle */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowControls(!showControls)}
              className={`nav-button px-4 h-8 rounded-full flex items-center justify-center gap-1.5 text-xs font-arabic ${showControls ? 'bg-primary/20 border-primary' : ''}`}
              title="إظهار/إخفاء أدوات التشغيل"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showControls ? 'إخفاء التحكم' : 'أدوات التشغيل'}</span>
            </button>
          </div>

          {/* Auto-Play Controls + Navigation - conditionally shown */}
          {showControls && (
            <div className="space-y-5 animate-fade-in">
              {renderedWords.length > 0 && (
                <div className="page-frame p-4">
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

              <PageNavigation
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevPage={prevPage}
                onNextPage={nextPage}
                onGoToPage={goToPage}
              />
            </div>
          )}

          {/* Footer - Minimal */}
          <footer className="text-center text-[10px] text-muted-foreground/60 font-arabic pb-4">
            يُحفظ تقدمك تلقائياً
          </footer>
        </div>
      </div>
    </div>
  );
}