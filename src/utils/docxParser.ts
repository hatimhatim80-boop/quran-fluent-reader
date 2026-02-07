import mammoth from 'mammoth';
import { QuranPage, GhareebWord } from '@/types/quran';

export async function parseQuranPagesDocx(file: File): Promise<QuranPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  
  const pages: QuranPage[] = [];
  
  // Split by page markers (e.g., "صفحة 1" or "--- 1 ---" or just numbers on separate lines)
  // Try multiple patterns
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentPageNumber = 0;
  let currentPageText = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line is a page number indicator
    const pageMatch = trimmedLine.match(/^(?:صفحة\s*)?(\d+)(?:\s*[-–—:.])?$/);
    const pageMarkerMatch = trimmedLine.match(/^[-–—=]+\s*(\d+)\s*[-–—=]+$/);
    
    if (pageMatch || pageMarkerMatch) {
      // Save previous page if exists
      if (currentPageNumber > 0 && currentPageText.trim()) {
        pages.push({
          page_number: currentPageNumber,
          page_text: currentPageText.trim(),
        });
      }
      
      currentPageNumber = parseInt((pageMatch || pageMarkerMatch)![1], 10);
      currentPageText = '';
    } else if (currentPageNumber > 0) {
      currentPageText += (currentPageText ? ' ' : '') + trimmedLine;
    }
  }
  
  // Don't forget the last page
  if (currentPageNumber > 0 && currentPageText.trim()) {
    pages.push({
      page_number: currentPageNumber,
      page_text: currentPageText.trim(),
    });
  }
  
  return pages.sort((a, b) => a.page_number - b.page_number);
}

export async function parseGhareebWordsDocx(file: File): Promise<GhareebWord[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  
  const words: GhareebWord[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentPageNumber = 0;
  let orderInPage = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line is a page number indicator
    const pageMatch = trimmedLine.match(/^(?:صفحة\s*)?(\d+)(?:\s*[-–—:.])?$/);
    const pageMarkerMatch = trimmedLine.match(/^[-–—=]+\s*(\d+)\s*[-–—=]+$/);
    
    if (pageMatch || pageMarkerMatch) {
      currentPageNumber = parseInt((pageMatch || pageMarkerMatch)![1], 10);
      orderInPage = 0;
    } else if (currentPageNumber > 0) {
      // Try to parse word and meaning
      // Format: "word: meaning" or "word - meaning" or "word | meaning"
      const wordMeaningMatch = trimmedLine.match(/^(.+?)[\s]*[:\-–—|][\s]*(.+)$/);
      
      if (wordMeaningMatch) {
        orderInPage++;
        words.push({
          page_number: currentPageNumber,
          order: orderInPage,
          word_text: wordMeaningMatch[1].trim(),
          meaning: wordMeaningMatch[2].trim(),
        });
      }
    }
  }
  
  return words.sort((a, b) => {
    if (a.page_number !== b.page_number) return a.page_number - b.page_number;
    return a.order - b.order;
  });
}
