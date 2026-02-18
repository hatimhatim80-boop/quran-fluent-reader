import { useState, useEffect, useCallback, useMemo } from 'react';
import { QuranPage, GhareebWord, SavedProgress } from '@/types/quran';
import { parseMushafText } from '@/utils/quranParser';
import { loadGhareebData, getWordsForPage } from '@/utils/ghareebLoader';
import { useDataStore } from '@/stores/dataStore';
import { getData } from '@/services/dataSource';
import { useSettingsStore } from '@/stores/settingsStore';

const STORAGE_KEY = 'quran-app-progress';

export function useQuranData() {
  const [pages, setPages] = useState<QuranPage[]>([]);
  const [ghareebPageMap, setGhareebPageMap] = useState<Map<number, GhareebWord[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get user overrides from dataStore
  const applyOverrides = useDataStore((s) => s.applyOverrides);
  const userOverrides = useDataStore((s) => s.userOverrides);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Load Mushaf text (15-line Madina layout) and ghareeb data in parallel
        const [mushafText, ghareebMap] = await Promise.all([
          getData('mushaf'),
          loadGhareebData(),
        ]);
        const loadedPages = parseMushafText(mushafText);
        
        if (loadedPages.length === 0) {
          setError('لم يتم العثور على بيانات القرآن');
        } else {
          setPages(loadedPages);
          setGhareebPageMap(ghareebMap);
          
          // ── 1. تطبيق النطاق المؤقت على الـ store قبل أي شيء آخر ──
          // يُخزَّن بواسطة GhareebEntryDialog لتجاوز مشكلة zustand persist غير المتزامن
          const pendingRange = localStorage.getItem('quran-app-ghareeb-pending-range');
          if (pendingRange) {
            localStorage.removeItem('quran-app-ghareeb-pending-range');
            try {
              const rangePayload = JSON.parse(pendingRange);
              // طبّق على الـ store مباشرة (getState().setAutoplay متزامن)
              useSettingsStore.getState().setAutoplay(rangePayload);
              console.log('[useQuranData] ✅ Applied pending ghareeb range:', rangePayload);
            } catch (e) {
              console.warn('[useQuranData] Failed to parse pending range:', e);
            }
          }

          // ── 2. تحديد الصفحة الابتدائية ──
          // Check if there's a ghareeb range start page (set by GhareebEntryDialog)
          // Must be read BEFORE saved progress so it takes priority
          const ghareebStartPage = localStorage.getItem('quran-app-ghareeb-start-page');
          if (ghareebStartPage) {
            localStorage.removeItem('quran-app-ghareeb-start-page');
            const pageNum = parseInt(ghareebStartPage, 10);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
              setCurrentPage(Math.min(pageNum, loadedPages.length));
              setCurrentWordIndex(-1);
            }
          } else {
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

  // Get ghareeb words for current page using text-based matching + user overrides
  const getPageGhareebWords = useMemo((): GhareebWord[] => {
    const pageData = pages.find(p => p.pageNumber === currentPage);
    if (!pageData) return [];
    
    // Get base words from file
    const baseWords = getWordsForPage(ghareebPageMap, currentPage, pageData.text);
    
    // Apply user overrides (edits, deletions, additions)
    return applyOverrides(baseWords).filter(w => w.pageNumber === currentPage);
  }, [ghareebPageMap, currentPage, pages, applyOverrides, userOverrides]);

  // Get ALL ghareeb words from all pages (for file editor)
  const allGhareebWords = useMemo((): GhareebWord[] => {
    const all: GhareebWord[] = [];
    ghareebPageMap.forEach((words) => {
      all.push(...words);
    });
    return all;
  }, [ghareebPageMap]);

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
    // For global audit
    ghareebPageMap,
  };
}
