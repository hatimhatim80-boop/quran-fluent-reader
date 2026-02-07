import React, { useCallback, useState } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';
import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
import { Toolbar } from './Toolbar';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { Loader2 } from 'lucide-react';

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
  } = useQuranData();

  // Apply settings to CSS variables in real-time
  const settings = useSettingsApplier();

  // SINGLE SOURCE OF TRUTH: rendered words from PageView
  const [renderedWords, setRenderedWords] = useState<GhareebWord[]>([]);

  const pageData = getCurrentPageData();
  const pageWords = getPageGhareebWords; // Used as input to PageView matching

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
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        {/* Toolbar */}
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
            // Force re-render by triggering page reload
            window.location.reload();
          }}
        />

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

        {/* Auto-Play Controls - uses rendered words count */}
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

        {/* Navigation */}
        <PageNavigation
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={prevPage}
          onNextPage={nextPage}
          onGoToPage={goToPage}
        />

        {/* Footer - Minimal */}
        <footer className="text-center text-[10px] text-muted-foreground/60 font-arabic pb-4">
          يُحفظ تقدمك تلقائياً
        </footer>
      </div>
    </div>
  );
}