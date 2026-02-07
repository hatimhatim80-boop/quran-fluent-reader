import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';
import { MeaningBox } from './MeaningBox';
import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
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
    goToPage,
    nextPage,
    prevPage,
  } = useQuranData();

  const [selectedWord, setSelectedWord] = useState<GhareebWord | null>(null);

  const pageData = getCurrentPageData();
  const pageWords = useMemo(() => getPageGhareebWords(), [getPageGhareebWords]);

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

  // Update selected word when highlighted word changes
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
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="font-arabic text-muted-foreground">جاري تحميل القرآن الكريم...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || pages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="page-frame p-8 max-w-md text-center">
          <p className="font-arabic text-destructive text-lg mb-2">⚠️ {error || 'لم يتم تحميل البيانات'}</p>
          <p className="font-arabic text-muted-foreground text-sm">
            تأكد من وجود ملفات البيانات في مجلد public/data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold font-arabic text-foreground">
            القرآن الكريم
          </h1>
          <p className="text-muted-foreground font-arabic text-sm mt-1">
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

        {/* Meaning Box */}
        <MeaningBox word={selectedWord} onClose={handleCloseMeaning} />

        {/* Auto-Play Controls */}
        <div className="page-frame p-4 sm:p-6">
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

        {/* Navigation */}
        <PageNavigation
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={prevPage}
          onNextPage={nextPage}
          onGoToPage={goToPage}
        />

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground font-arabic pt-4">
          يُحفظ تقدمك تلقائياً
        </footer>
      </div>
    </div>
  );
}
