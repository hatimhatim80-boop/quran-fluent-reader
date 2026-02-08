import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Highlight Override Store
 * 
 * Controls which words should be highlighted/unhighlighted in the Quran reader.
 * This is separate from word edits - it only controls the visual highlighting.
 * 
 * Key format: `${pageNumber}_${lineIndex}_${tokenIndex}` or `${surah}_${ayah}_${wordIndex}`
 */

export interface HighlightOverride {
  // Primary key: page-based position (stable across text changes)
  positionKey: string; // e.g., "583_5_3" = page 583, line 5, token 3
  
  // Secondary key: surah/ayah/wordIndex (for cross-reference)
  identityKey: string; // e.g., "78_1_2" = surah 78, ayah 1, word 2
  
  // The actual word text (for display/debugging)
  wordText: string;
  
  // Override type
  highlight: boolean; // true = force highlight, false = force remove highlight
  
  // Optional: meaning to use when highlighting a new word
  meaning?: string;
  surahNumber?: number;
  verseNumber?: number;
  wordIndex?: number;
  surahName?: string;
  
  // Metadata
  createdAt: string;
  pageNumber: number;
  lineIndex?: number;
  tokenIndex?: number;
}

interface HighlightOverrideState {
  overrides: HighlightOverride[];
  version: number; // Increment on every change for reactivity
  
  // Add or update override
  setOverride: (override: Omit<HighlightOverride, 'createdAt'>) => void;
  
  // Remove override (restore to default behavior)
  removeOverride: (positionKey: string) => void;
  
  // Query
  getOverride: (positionKey: string) => HighlightOverride | undefined;
  getOverrideByIdentity: (identityKey: string) => HighlightOverride | undefined;
  getOverridesForPage: (pageNumber: number) => HighlightOverride[];
  
  // Check if word should be highlighted (considering overrides)
  shouldHighlight: (positionKey: string, identityKey: string, defaultHighlight: boolean) => boolean;
  
  // Bulk operations
  clearPageOverrides: (pageNumber: number) => void;
  clearAllOverrides: () => void;
  
  // Export/import
  exportOverrides: () => string;
  importOverrides: (json: string) => { success: boolean; count: number };
}

export const useHighlightOverrideStore = create<HighlightOverrideState>()(
  persist(
    (set, get) => ({
      overrides: [],
      version: 0,
      
      setOverride: (overrideData) => {
        const now = new Date().toISOString();
        const override: HighlightOverride = { ...overrideData, createdAt: now };
        
        set((state) => {
          // Remove existing override for same position
          const filtered = state.overrides.filter(
            (o) => o.positionKey !== override.positionKey
          );
          
          return {
            overrides: [...filtered, override],
            version: state.version + 1,
          };
        });
      },
      
      removeOverride: (positionKey) => {
        set((state) => ({
          overrides: state.overrides.filter((o) => o.positionKey !== positionKey),
          version: state.version + 1,
        }));
      },
      
      getOverride: (positionKey) => {
        return get().overrides.find((o) => o.positionKey === positionKey);
      },
      
      getOverrideByIdentity: (identityKey) => {
        return get().overrides.find((o) => o.identityKey === identityKey);
      },
      
      getOverridesForPage: (pageNumber) => {
        return get().overrides.filter((o) => o.pageNumber === pageNumber);
      },
      
      shouldHighlight: (positionKey, identityKey, defaultHighlight) => {
        const override = get().overrides.find(
          (o) => o.positionKey === positionKey || o.identityKey === identityKey
        );
        
        if (override) {
          return override.highlight;
        }
        
        return defaultHighlight;
      },
      
      clearPageOverrides: (pageNumber) => {
        set((state) => ({
          overrides: state.overrides.filter((o) => o.pageNumber !== pageNumber),
          version: state.version + 1,
        }));
      },
      
      clearAllOverrides: () => {
        set({ overrides: [], version: 0 });
      },
      
      exportOverrides: () => {
        const { overrides } = get();
        return JSON.stringify({
          version: '1.0',
          type: 'highlight-overrides',
          exportedAt: new Date().toISOString(),
          overrides,
        }, null, 2);
      },
      
      importOverrides: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.overrides && Array.isArray(data.overrides)) {
            set((state) => ({
              overrides: [...state.overrides, ...data.overrides],
              version: state.version + 1,
            }));
            return { success: true, count: data.overrides.length };
          }
          return { success: false, count: 0 };
        } catch {
          return { success: false, count: 0 };
        }
      },
    }),
    {
      name: 'quran-highlight-overrides',
    }
  )
);

// Helper to generate position key
export function makePositionKey(pageNumber: number, lineIndex: number, tokenIndex: number): string {
  return `${pageNumber}_${lineIndex}_${tokenIndex}`;
}

// Helper to generate identity key
export function makeIdentityKey(surahNumber: number, verseNumber: number, wordIndex: number): string {
  return `${surahNumber}_${verseNumber}_${wordIndex}`;
}
