import React, { useState, useCallback, useEffect } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';
import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
import { Loader2, BookOpen } from 'lucide-react';

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
    goToPage,
    nextPage,
    prevPage,
  } = useQuranData();

  const [selectedWord, setSelectedWord] = useState<GhareebWord | null>(null);

  const pageData = getCurrentPageData();
  const pageWords = getPageGhareebWords;

  const {
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
  } = useAutoPlay({
    words: pageWords,
    currentWordIndex,
    setCurrentWordIndex,
  });

  // Auto-start playback when page has ghareeb words
  useEffect(() => {
    if (pageWords.length > 0 && currentWordIndex < 0) {
      // Small delay to let page render first
      const timer = setTimeout(() => {
        play();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, pageWords.length]);

  useEffect(() => {
    if (currentWordIndex >= 0 && currentWordIndex < pageWords.length) {
      setSelectedWord(pageWords[currentWordIndex]);
    }
  }, [currentWordIndex, pageWords]);

  const handleWordClick = useCallback((word: GhareebWord, index: number) => {
    setSelectedWord(word);
    setCurrentWordIndex(index);
  }, [setCurrentWordIndex]);

  const handleCloseMeaning = useCallback(() => {
    setSelectedWord(null);
    if (!isPlaying) {
      setCurrentWordIndex(-1);
    }
  }, [isPlaying, setCurrentWordIndex]);

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

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        {/* Minimal Header */}
        <header className="text-center pb-2">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-arabic text-foreground">
              القرآن الكريم
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-arabic">
            الميسر في غريب القرآن
          </p>
        </header>

        {/* Page View */}
        {pageData && (
          <PageView
            page={pageData}
            ghareebWords={pageWords}
            highlightedWordIndex={currentWordIndex}
            onWordClick={handleWordClick}
        />
        )}

        {/* Auto-Play Controls - Compact */}
        {pageWords.length > 0 && (
          <div className="page-frame p-4">
            <AutoPlayControls
              isPlaying={isPlaying}
              speed={speed}
              wordsCount={pageWords.length}
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
