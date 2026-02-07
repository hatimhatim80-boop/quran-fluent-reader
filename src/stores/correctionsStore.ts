import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Correction types
export type CorrectionType = 
  | 'page_override'      // تصحيح الصفحة فقط
  | 'full_match'         // تصحيح المطابقة بالكامل
  | 'meaning_override';  // تصحيح المعنى / ربط المعنى

// A single correction entry
export interface WordCorrection {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // Original word identification
  originalKey: string; // surah_ayah_wordIndex
  originalWord: string;
  originalSurah: number;
  originalAyah: number;
  originalWordIndex: number;
  originalPage: number;
  
  // Correction type
  type: CorrectionType;
  
  // Page correction
  correctedPage?: number;
  
  // Full match correction
  correctedSurah?: number;
  correctedAyah?: number;
  correctedWordIndex?: number;
  
  // Meaning correction
  meaningIdOverride?: string; // Link to correct meaning in dataset
  meaningTextOverride?: string; // Manual override
  
  // Metadata
  ignored: boolean;
  notes?: string;
}

// Apply correction to all duplicates options
export type DuplicateScope = 
  | 'single'           // فقط هذه الكلمة
  | 'same_page'        // نفس الكلمة في نفس الصفحة
  | 'all_pages'        // نفس الكلمة في كل الصفحات
  | 'same_surah_ayah'; // نفس السورة/الآية/مؤشر الكلمة

interface CorrectionsState {
  corrections: WordCorrection[];
  undoStack: WordCorrection[][];
  
  // CRUD operations
  addCorrection: (correction: Omit<WordCorrection, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCorrection: (id: string, updates: Partial<WordCorrection>) => void;
  deleteCorrection: (id: string) => void;
  
  // Bulk operations
  applyToDuplicates: (correction: WordCorrection, scope: DuplicateScope, allWords: Array<{ word: string; surah: number; ayah: number; wordIndex: number; page: number }>) => number;
  
  // Query operations
  getCorrection: (key: string) => WordCorrection | undefined;
  getCorrectionsByPage: (page: number) => WordCorrection[];
  getIgnoredKeys: () => Set<string>;
  
  // Undo/Redo
  undo: () => void;
  canUndo: () => boolean;
  
  // Export/Import
  exportCorrections: () => string;
  importCorrections: (json: string) => { success: boolean; count: number };
  
  // Reset
  resetAll: () => void;
}

function generateId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useCorrectionsStore = create<CorrectionsState>()(
  persist(
    (set, get) => ({
      corrections: [],
      undoStack: [],

      addCorrection: (correctionData) => {
        const id = generateId();
        const now = new Date().toISOString();
        
        const correction: WordCorrection = {
          ...correctionData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        
        set((state) => ({
          corrections: [...state.corrections, correction],
          undoStack: [...state.undoStack, state.corrections].slice(-10), // Keep last 10 states
        }));
        
        return id;
      },

      updateCorrection: (id, updates) => {
        set((state) => ({
          corrections: state.corrections.map((c) =>
            c.id === id
              ? { ...c, ...updates, updatedAt: new Date().toISOString() }
              : c
          ),
          undoStack: [...state.undoStack, state.corrections].slice(-10),
        }));
      },

      deleteCorrection: (id) => {
        set((state) => ({
          corrections: state.corrections.filter((c) => c.id !== id),
          undoStack: [...state.undoStack, state.corrections].slice(-10),
        }));
      },

      applyToDuplicates: (correction, scope, allWords) => {
        const { corrections } = get();
        const newCorrections: WordCorrection[] = [];
        
        for (const word of allWords) {
          let shouldApply = false;
          
          switch (scope) {
            case 'single':
              shouldApply = false; // Already applied to original
              break;
            case 'same_page':
              shouldApply = 
                word.word === correction.originalWord && 
                word.page === correction.originalPage &&
                `${word.surah}_${word.ayah}_${word.wordIndex}` !== correction.originalKey;
              break;
            case 'all_pages':
              shouldApply = 
                word.word === correction.originalWord &&
                `${word.surah}_${word.ayah}_${word.wordIndex}` !== correction.originalKey;
              break;
            case 'same_surah_ayah':
              shouldApply = 
                word.surah === correction.originalSurah &&
                word.ayah === correction.originalAyah &&
                word.wordIndex === correction.originalWordIndex &&
                `${word.surah}_${word.ayah}_${word.wordIndex}` !== correction.originalKey;
              break;
          }
          
          if (shouldApply) {
            const key = `${word.surah}_${word.ayah}_${word.wordIndex}`;
            const existing = corrections.find((c) => c.originalKey === key);
            
            if (!existing) {
              newCorrections.push({
                id: generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                originalKey: key,
                originalWord: word.word,
                originalSurah: word.surah,
                originalAyah: word.ayah,
                originalWordIndex: word.wordIndex,
                originalPage: word.page,
                type: correction.type,
                correctedPage: correction.correctedPage,
                correctedSurah: correction.correctedSurah,
                correctedAyah: correction.correctedAyah,
                correctedWordIndex: correction.correctedWordIndex,
                meaningIdOverride: correction.meaningIdOverride,
                meaningTextOverride: correction.meaningTextOverride,
                ignored: correction.ignored,
                notes: correction.notes,
              });
            }
          }
        }
        
        if (newCorrections.length > 0) {
          set((state) => ({
            corrections: [...state.corrections, ...newCorrections],
            undoStack: [...state.undoStack, state.corrections].slice(-10),
          }));
        }
        
        return newCorrections.length;
      },

      getCorrection: (key) => {
        return get().corrections.find((c) => c.originalKey === key && !c.ignored);
      },

      getCorrectionsByPage: (page) => {
        return get().corrections.filter(
          (c) => (c.correctedPage === page || c.originalPage === page) && !c.ignored
        );
      },

      getIgnoredKeys: () => {
        return new Set(
          get().corrections.filter((c) => c.ignored).map((c) => c.originalKey)
        );
      },

      undo: () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return;
        
        const previousState = undoStack[undoStack.length - 1];
        set({
          corrections: previousState,
          undoStack: undoStack.slice(0, -1),
        });
      },

      canUndo: () => get().undoStack.length > 0,

      exportCorrections: () => {
        const data = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          corrections: get().corrections,
        };
        return JSON.stringify(data, null, 2);
      },

      importCorrections: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.corrections && Array.isArray(data.corrections)) {
            set((state) => ({
              corrections: [...state.corrections, ...data.corrections],
              undoStack: [...state.undoStack, state.corrections].slice(-10),
            }));
            return { success: true, count: data.corrections.length };
          }
          return { success: false, count: 0 };
        } catch {
          return { success: false, count: 0 };
        }
      },

      resetAll: () => {
        set((state) => ({
          corrections: [],
          undoStack: [...state.undoStack, state.corrections].slice(-10),
        }));
      },
    }),
    {
      name: 'quran-app-corrections',
    }
  )
);
