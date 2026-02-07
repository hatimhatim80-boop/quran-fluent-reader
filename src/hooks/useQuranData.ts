import { useState, useEffect } from 'react';
import { QuranPage, GhareebWord, SavedProgress } from '@/types/quran';

const STORAGE_KEY = 'quran-app-progress';

export function useQuranData() {
  const [pages, setPages] = useState<QuranPage[]>([]);
  const [ghareebWords, setGhareebWords] = useState<GhareebWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const progress: SavedProgress = JSON.parse(saved);
        setCurrentPage(progress.lastPage || 1);
        setCurrentWordIndex(progress.lastWordIndex ?? -1);
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    }
  }, []);

  // Save progress whenever page or word changes
  useEffect(() => {
    if (pages.length > 0) {
      const progress: SavedProgress = {
        lastPage: currentPage,
        lastWordIndex: currentWordIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [currentPage, currentWordIndex, pages.length]);

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n');
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const loadPagesCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      const header = rows[0];
      const pageNumIndex = header.findIndex(h => h.toLowerCase().includes('page_number'));
      const textIndex = header.findIndex(h => h.toLowerCase().includes('page_text'));
      
      const parsed: QuranPage[] = rows.slice(1).map(row => ({
        page_number: parseInt(row[pageNumIndex], 10),
        page_text: row[textIndex] || '',
      })).filter(p => !isNaN(p.page_number));
      
      setPages(parsed.sort((a, b) => a.page_number - b.page_number));
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const loadGhareebCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      const header = rows[0];
      const pageNumIndex = header.findIndex(h => h.toLowerCase().includes('page_number'));
      const orderIndex = header.findIndex(h => h.toLowerCase().includes('order'));
      const wordIndex = header.findIndex(h => h.toLowerCase().includes('word_text'));
      const meaningIndex = header.findIndex(h => h.toLowerCase().includes('meaning'));
      
      const parsed: GhareebWord[] = rows.slice(1).map(row => ({
        page_number: parseInt(row[pageNumIndex], 10),
        order: parseInt(row[orderIndex], 10),
        word_text: row[wordIndex] || '',
        meaning: row[meaningIndex] || '',
      })).filter(w => !isNaN(w.page_number) && w.word_text);
      
      setGhareebWords(parsed.sort((a, b) => {
        if (a.page_number !== b.page_number) return a.page_number - b.page_number;
        return a.order - b.order;
      }));
    };
    reader.readAsText(file);
  };

  const getPageWords = (pageNumber: number): GhareebWord[] => {
    return ghareebWords
      .filter(w => w.page_number === pageNumber)
      .sort((a, b) => a.order - b.order);
  };

  const totalPages = pages.length > 0 ? Math.max(...pages.map(p => p.page_number)) : 604;

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
    setCurrentWordIndex(-1);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  const getCurrentPageData = (): QuranPage | undefined => {
    return pages.find(p => p.page_number === currentPage);
  };

  return {
    pages,
    ghareebWords,
    isLoading,
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
  };
}
