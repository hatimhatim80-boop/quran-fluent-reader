import React, { useState, useCallback } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { FileUploader } from './FileUploader';
import { QuranPageView } from './QuranPageView';
import { MeaningBox } from './MeaningBox';
import { NavigationControls } from './NavigationControls';
import { AutoPlayControls } from './AutoPlayControls';

export function QuranReader() {
  const {
    pages,
    currentPage,
    currentWordIndex,
    setCurrentWordIndex,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    getCurrentPageData,
    getPageWords,
    loadPagesCSV,
    loadGhareebCSV,
    loadPagesData,
    loadGhareebData,
  } = useQuranData();

  const [selectedWord, setSelectedWord] = useState<GhareebWord | null>(null);
  const [ghareebLoaded, setGhareebLoaded] = useState(false);

  const currentPageData = getCurrentPageData();
  const pageWords = getPageWords(currentPage);

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
  React.useEffect(() => {
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

  const handleGhareebCSV = (file: File) => {
    loadGhareebCSV(file);
    setGhareebLoaded(true);
  };

  const handleGhareebData = (words: GhareebWord[]) => {
    loadGhareebData(words);
    setGhareebLoaded(true);
  };

  // Show file uploader if no pages loaded
  if (pages.length === 0) {
    return (
      <FileUploader
        onPagesUpload={loadPagesCSV}
        onGhareebUpload={handleGhareebCSV}
        onPagesData={loadPagesData}
        onGhareebData={handleGhareebData}
        pagesLoaded={pages.length > 0}
        ghareebLoaded={ghareebLoaded}
      />
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
            مع شرح الكلمات الغريبة
          </p>
        </header>

        {/* Quran Page */}
        {currentPageData ? (
          <QuranPageView
            pageText={currentPageData.page_text}
            pageNumber={currentPageData.page_number}
            ghareebWords={pageWords}
            highlightedWordIndex={currentWordIndex}
            onWordClick={handleWordClick}
          />
        ) : (
          <div className="page-frame p-8 text-center">
            <p className="font-arabic text-muted-foreground">
              الصفحة غير موجودة
            </p>
          </div>
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
        <NavigationControls
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
