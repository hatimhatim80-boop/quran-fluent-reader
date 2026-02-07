import { useState, useEffect, useCallback } from 'react';
import { QuranPage, GhareebWord, SavedProgress } from '@/types/quran';
import { loadQuranData } from '@/utils/quranParser';

const STORAGE_KEY = 'quran-app-progress';

export function useQuranData() {
  const [pages, setPages] = useState<QuranPage[]>([]);
  const [ghareebWords, setGhareebWords] = useState<GhareebWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const { pages: loadedPages, ghareebWords: loadedWords } = await loadQuranData();
        
        if (loadedPages.length === 0) {
          setError('لم يتم العثور على بيانات القرآن');
        } else {
          setPages(loadedPages);
          setGhareebWords(loadedWords);
          
          // Load saved progress
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const progress: SavedProgress = JSON.parse(saved);
              setCurrentPage(Math.min(progress.currentPage || 1, loadedPages.length));
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
    if (pages.length > 0) {
      const progress: SavedProgress = {
        currentPage,
        currentWordIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [currentPage, currentWordIndex, pages.length]);

  const totalPages = pages.length || 604;

  // Get current page data
  const getCurrentPageData = useCallback((): QuranPage | undefined => {
    return pages.find(p => p.pageNumber === currentPage);
  }, [pages, currentPage]);

  // Get ghareeb words for current page
  const getPageGhareebWords = useCallback((): GhareebWord[] => {
    return ghareebWords
      .filter(w => w.pageNumber === currentPage)
      .sort((a, b) => a.order - b.order);
  }, [ghareebWords, currentPage]);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
    setCurrentWordIndex(-1);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  return {
    pages,
    ghareebWords,
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
  };
}
