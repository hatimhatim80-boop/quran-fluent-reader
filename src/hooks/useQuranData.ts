import { useState, useEffect, useCallback } from 'react';
import { Surah, GhareebWord, SavedProgress } from '@/types/quran';
import { loadQuranData } from '@/utils/quranParser';

const STORAGE_KEY = 'quran-app-progress';

export function useQuranData() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ghareebWords, setGhareebWords] = useState<GhareebWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentSurahIndex, setCurrentSurahIndex] = useState(0);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const { surahs: loadedSurahs, ghareebWords: loadedWords } = await loadQuranData();
        
        if (loadedSurahs.length === 0) {
          setError('لم يتم العثور على بيانات القرآن');
        } else {
          setSurahs(loadedSurahs);
          setGhareebWords(loadedWords);
          
          // Load saved progress
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const progress: SavedProgress = JSON.parse(saved);
              setCurrentSurahIndex(Math.min(progress.currentSurahIndex || 0, loadedSurahs.length - 1));
              setCurrentVerseIndex(progress.currentVerseIndex || 0);
              setCurrentWordIndex(progress.currentWordIndex ?? -1);
            } catch (e) {
              console.error('Failed to load progress:', e);
            }
          }
        }
      } catch (e) {
        setError('حدث خطأ في تحميل البيانات');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, []);

  // Save progress
  useEffect(() => {
    if (surahs.length > 0) {
      const progress: SavedProgress = {
        currentSurahIndex,
        currentVerseIndex,
        currentWordIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [currentSurahIndex, currentVerseIndex, currentWordIndex, surahs.length]);

  const currentSurah = surahs[currentSurahIndex];
  const currentVerse = currentSurah?.verses[currentVerseIndex];

  // Get ghareeb words for current verse
  const getVerseGhareebWords = useCallback((): GhareebWord[] => {
    if (!currentSurah || !currentVerse) return [];
    
    return ghareebWords
      .filter(w => 
        w.surahName === currentSurah.name && 
        w.verseNumber === currentVerse.verseNumber
      )
      .sort((a, b) => a.order - b.order);
  }, [currentSurah, currentVerse, ghareebWords]);

  // Get ghareeb words for current surah
  const getSurahGhareebWords = useCallback((): GhareebWord[] => {
    if (!currentSurah) return [];
    
    return ghareebWords
      .filter(w => w.surahName === currentSurah.name)
      .sort((a, b) => {
        if (a.verseNumber !== b.verseNumber) return a.verseNumber - b.verseNumber;
        return a.order - b.order;
      });
  }, [currentSurah, ghareebWords]);

  const goToSurah = useCallback((index: number) => {
    const validIndex = Math.max(0, Math.min(index, surahs.length - 1));
    setCurrentSurahIndex(validIndex);
    setCurrentVerseIndex(0);
    setCurrentWordIndex(-1);
  }, [surahs.length]);

  const goToVerse = useCallback((index: number) => {
    if (!currentSurah) return;
    const validIndex = Math.max(0, Math.min(index, currentSurah.verses.length - 1));
    setCurrentVerseIndex(validIndex);
    setCurrentWordIndex(-1);
  }, [currentSurah]);

  const nextVerse = useCallback(() => {
    if (!currentSurah) return;
    
    if (currentVerseIndex < currentSurah.verses.length - 1) {
      setCurrentVerseIndex(v => v + 1);
      setCurrentWordIndex(-1);
    } else if (currentSurahIndex < surahs.length - 1) {
      // Move to next surah
      setCurrentSurahIndex(s => s + 1);
      setCurrentVerseIndex(0);
      setCurrentWordIndex(-1);
    }
  }, [currentSurah, currentVerseIndex, currentSurahIndex, surahs.length]);

  const prevVerse = useCallback(() => {
    if (currentVerseIndex > 0) {
      setCurrentVerseIndex(v => v - 1);
      setCurrentWordIndex(-1);
    } else if (currentSurahIndex > 0) {
      // Move to previous surah's last verse
      const prevSurah = surahs[currentSurahIndex - 1];
      setCurrentSurahIndex(s => s - 1);
      setCurrentVerseIndex(prevSurah.verses.length - 1);
      setCurrentWordIndex(-1);
    }
  }, [currentVerseIndex, currentSurahIndex, surahs]);

  const nextSurah = useCallback(() => {
    if (currentSurahIndex < surahs.length - 1) {
      goToSurah(currentSurahIndex + 1);
    }
  }, [currentSurahIndex, surahs.length, goToSurah]);

  const prevSurah = useCallback(() => {
    if (currentSurahIndex > 0) {
      goToSurah(currentSurahIndex - 1);
    }
  }, [currentSurahIndex, goToSurah]);

  return {
    surahs,
    ghareebWords,
    isLoading,
    error,
    currentSurah,
    currentVerse,
    currentSurahIndex,
    currentVerseIndex,
    currentWordIndex,
    setCurrentWordIndex,
    getVerseGhareebWords,
    getSurahGhareebWords,
    goToSurah,
    goToVerse,
    nextVerse,
    prevVerse,
    nextSurah,
    prevSurah,
    totalSurahs: surahs.length,
  };
}
