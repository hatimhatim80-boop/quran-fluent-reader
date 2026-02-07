import React, { useCallback, useState } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { GhareebWord } from '@/types/quran';
import { PageView } from './PageView';
import { PageNavigation } from './PageNavigation';
import { AutoPlayControls } from './AutoPlayControls';
import { Loader2, BookOpen, Play, Pause } from 'lucide-react';

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
    console.log('[QuranReader] Rendered words received:', words.length);
    setRenderedWords(words);
  }, []);

  // When user clicks a word, jump to it (works during playback too)
  const handleWordClick = useCallback((_: GhareebWord, index: number) => {
    jumpTo(index);
  }, [jumpTo]);

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
        {/* Minimal Header */}
        <header className="text-center pb-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-arabic text-foreground">
                القرآن الكريم
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Single Play/Pause button */}
              <button
                type="button"
                className={`nav-button w-10 h-10 rounded-lg ${isPlaying ? 'bg-primary/20 border-primary' : ''}`}
                aria-pressed={isPlaying}
                onClick={() => isPlaying ? pause() : play()}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل معاني الكلمات'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 mr-[-2px]" />
                )}
              </button>
              
              {/* Status badge - shows rendered word count */}
              {(isPlaying || currentWordIndex >= 0) && renderedWords.length > 0 && (
                <span className="text-xs font-arabic text-muted-foreground bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">
                  {currentWordIndex + 1} / {renderedWords.length}
                </span>
              )}
            </div>
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