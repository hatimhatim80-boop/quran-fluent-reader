import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';
import { Surah } from '@/types/quran';

interface SurahNavigationProps {
  surahs: Surah[];
  currentSurahIndex: number;
  currentVerseIndex: number;
  totalVerses: number;
  onPrevSurah: () => void;
  onNextSurah: () => void;
  onPrevVerse: () => void;
  onNextVerse: () => void;
  onGoToSurah: (index: number) => void;
  onGoToVerse: (index: number) => void;
}

export function SurahNavigation({
  surahs,
  currentSurahIndex,
  currentVerseIndex,
  totalVerses,
  onPrevSurah,
  onNextSurah,
  onPrevVerse,
  onNextVerse,
  onGoToSurah,
  onGoToVerse,
}: SurahNavigationProps) {
  const [showSurahList, setShowSurahList] = useState(false);
  const [verseInput, setVerseInput] = useState('');

  const handleVerseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const verse = parseInt(verseInput, 10);
    if (!isNaN(verse) && verse >= 1 && verse <= totalVerses) {
      onGoToVerse(verse - 1);
      setVerseInput('');
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Surah Navigation */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={onPrevSurah}
          disabled={currentSurahIndex <= 0}
          className="nav-button w-10 h-10 sm:w-12 sm:h-12 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="السورة السابقة"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <button
          onClick={() => setShowSurahList(!showSurahList)}
          className="nav-button px-4 py-2 rounded-lg flex items-center gap-2 font-arabic"
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-sm sm:text-base">
            {surahs[currentSurahIndex]?.name || 'اختر سورة'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({currentSurahIndex + 1}/{surahs.length})
          </span>
        </button>

        <button
          onClick={onNextSurah}
          disabled={currentSurahIndex >= surahs.length - 1}
          className="nav-button w-10 h-10 sm:w-12 sm:h-12 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="السورة التالية"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Surah List Dropdown */}
      {showSurahList && (
        <div className="page-frame p-4 max-h-64 overflow-y-auto animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {surahs.map((surah, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onGoToSurah(idx);
                  setShowSurahList(false);
                }}
                className={`p-2 rounded-lg text-sm font-arabic transition-all ${
                  idx === currentSurahIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-primary/20'
                }`}
              >
                <span className="text-xs text-muted-foreground ml-1">{idx + 1}.</span>
                {surah.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Verse Navigation */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={onPrevVerse}
          disabled={currentSurahIndex <= 0 && currentVerseIndex <= 0}
          className="nav-button w-10 h-10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="الآية السابقة"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <form onSubmit={handleVerseSubmit} className="flex items-center gap-2">
          <span className="text-muted-foreground font-arabic text-sm">آية</span>
          <input
            type="number"
            min={1}
            max={totalVerses}
            value={verseInput}
            onChange={(e) => setVerseInput(e.target.value)}
            placeholder={`${currentVerseIndex + 1}`}
            className="w-14 h-10 text-center rounded-lg border-2 border-border bg-card text-foreground font-arabic focus:border-primary focus:outline-none transition-colors text-sm"
          />
          <span className="text-muted-foreground font-arabic text-sm">
            / {totalVerses}
          </span>
        </form>

        <button
          onClick={onNextVerse}
          disabled={currentSurahIndex >= surahs.length - 1 && currentVerseIndex >= totalVerses - 1}
          className="nav-button w-10 h-10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="الآية التالية"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
