import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

// IndexedDB storage
const DB_NAME = 'srs-persist';
const STORE_NAME = 'keyval';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const db = await getDB();
      return ((await db.get(STORE_NAME, name)) as string) ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch {
      localStorage.setItem(name, value);
    }
    try { localStorage.setItem(name, value); } catch {}
  },
  removeItem: async (name) => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, name);
    } catch {}
    try { localStorage.removeItem(name); } catch {}
  },
};

// ── SM-2 Algorithm ──────────────────────────────────────────────────────────

export type SRSRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface SRSCard {
  id: string;
  type: 'ghareeb' | 'tahfeez-ayah' | 'tahfeez-words' | 'tahfeez-word';
  page: number;
  contentKey: string;
  label: string;
  meta: Record<string, unknown>;

  // SM-2 fields
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number;
  createdAt: number;

  // Extended fields
  flagged?: boolean;
  tags?: string[];
  successCount?: number;
  failCount?: number;
}

export interface SRSReviewLog {
  cardId: string;
  rating: SRSRating;
  timestamp: number;
  prevInterval: number;
  newInterval: number;
}

function sm2(card: SRSCard, rating: SRSRating): Pick<SRSCard, 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'lastReview'> {
  const now = Date.now();
  let { easeFactor, interval, repetitions } = card;

  if (rating < 3) {
    repetitions = 0;
    interval = rating === 0 ? 0.007 : 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReview = now + interval * 24 * 60 * 60 * 1000;
  return { easeFactor, interval, repetitions, nextReview, lastReview: now };
}

export const RATING_OPTIONS: { rating: SRSRating; label: string; color: string; icon: string }[] = [
  { rating: 0, label: 'أعد', color: 'text-red-600', icon: '🔄' },
  { rating: 2, label: 'صعب', color: 'text-orange-500', icon: '😓' },
  { rating: 3, label: 'جيد', color: 'text-blue-500', icon: '👍' },
  { rating: 5, label: 'سهل', color: 'text-green-600', icon: '⭐' },
];

export function formatInterval(days: number): string {
  const minutes = Math.round(days * 24 * 60);
  if (minutes < 1) return 'الآن';
  if (minutes === 1) return '١ دقيقة';
  if (minutes < 60) return `${new Intl.NumberFormat('ar-SA').format(minutes)} دقيقة`;
  const hours = Math.round(days * 24);
  if (hours < 24) return `${new Intl.NumberFormat('ar-SA').format(hours)} ساعة`;
  if (days < 2) return 'غداً';
  if (days < 7) return `${new Intl.NumberFormat('ar-SA').format(Math.round(days))} أيام`;
  if (days < 30) return `${new Intl.NumberFormat('ar-SA').format(Math.round(days / 7))} أسابيع`;
  if (days < 365) return `${new Intl.NumberFormat('ar-SA').format(Math.round(days / 30))} أشهر`;
  return `${(days / 365).toFixed(1)} سنة`;
}

export function previewIntervals(card: SRSCard): { rating: SRSRating; interval: number }[] {
  return RATING_OPTIONS.map(({ rating }) => ({
    rating,
    interval: sm2(card, rating).interval,
  }));
}

interface SRSState {
  cards: SRSCard[];
  reviewLogs: SRSReviewLog[];

  addCard: (card: Omit<SRSCard, 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'lastReview' | 'createdAt' | 'successCount' | 'failCount'>) => void;
  removeCard: (id: string) => void;
  hasCard: (id: string) => boolean;
  toggleFlag: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;

  rateCard: (id: string, rating: SRSRating, manualInterval?: number) => void;

  getDueCards: (type?: SRSCard['type'], maxCount?: number, pageFilter?: number[]) => SRSCard[];
  getDueCount: (type?: SRSCard['type'], pageFilter?: number[]) => number;
  getCardsByPage: (page: number, type?: SRSCard['type']) => SRSCard[];
  getFlaggedCards: (type?: SRSCard['type']) => SRSCard[];
  getCardsByPages: (pages: number[], type?: SRSCard['type']) => SRSCard[];

  exportData: () => string;
  importData: (json: string) => boolean;
  clearAll: () => void;
}

export const useSRSStore = create<SRSState>()(
  persist(
    (set, get) => ({
      cards: [],
      reviewLogs: [],

      addCard: (cardData) => {
        const existing = get().cards;
        if (existing.some(c => c.id === cardData.id)) return;
        const now = Date.now();
        const card: SRSCard = {
          ...cardData,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: now,
          lastReview: 0,
          createdAt: now,
          successCount: 0,
          failCount: 0,
        };
        set({ cards: [...existing, card] });
      },

      removeCard: (id) => {
        set({ cards: get().cards.filter(c => c.id !== id) });
      },

      hasCard: (id) => get().cards.some(c => c.id === id),

      toggleFlag: (id) => {
        set({ cards: get().cards.map(c => c.id === id ? { ...c, flagged: !c.flagged } : c) });
      },

      addTag: (id, tag) => {
        set({
          cards: get().cards.map(c =>
            c.id === id ? { ...c, tags: [...new Set([...(c.tags || []), tag])] } : c
          ),
        });
      },

      removeTag: (id, tag) => {
        set({
          cards: get().cards.map(c =>
            c.id === id ? { ...c, tags: (c.tags || []).filter(t => t !== tag) } : c
          ),
        });
      },

      rateCard: (id, rating, manualInterval) => {
        const cards = get().cards;
        const idx = cards.findIndex(c => c.id === id);
        if (idx < 0) return;
        const card = cards[idx];

        let updates: Pick<SRSCard, 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'lastReview'>;

        if (manualInterval !== undefined) {
          const now = Date.now();
          updates = {
            ...sm2(card, rating),
            interval: manualInterval,
            nextReview: now + manualInterval * 24 * 60 * 60 * 1000,
            lastReview: now,
          };
        } else {
          updates = sm2(card, rating);
        }

        const log: SRSReviewLog = {
          cardId: id,
          rating,
          timestamp: Date.now(),
          prevInterval: card.interval,
          newInterval: updates.interval,
        };

        const newCards = [...cards];
        newCards[idx] = {
          ...card,
          ...updates,
          successCount: (card.successCount || 0) + (rating >= 3 ? 1 : 0),
          failCount: (card.failCount || 0) + (rating < 3 ? 1 : 0),
        };
        set({
          cards: newCards,
          reviewLogs: [...get().reviewLogs, log],
        });
      },

      getDueCards: (type, maxCount, pageFilter) => {
        const now = Date.now();
        let due = get().cards.filter(c => c.nextReview <= now);
        if (type) due = due.filter(c => c.type === type);
        if (pageFilter && pageFilter.length > 0) {
          const pageSet = new Set(pageFilter);
          due = due.filter(c => pageSet.has(c.page));
        }
        due.sort((a, b) => a.nextReview - b.nextReview);
        if (maxCount) due = due.slice(0, maxCount);
        return due;
      },

      getDueCount: (type, pageFilter) => {
        const now = Date.now();
        let due = get().cards.filter(c => c.nextReview <= now);
        if (type) due = due.filter(c => c.type === type);
        if (pageFilter && pageFilter.length > 0) {
          const pageSet = new Set(pageFilter);
          due = due.filter(c => pageSet.has(c.page));
        }
        return due.length;
      },

      getCardsByPage: (page, type) => {
        let cards = get().cards.filter(c => c.page === page);
        if (type) cards = cards.filter(c => c.type === type);
        return cards;
      },

      getFlaggedCards: (type) => {
        let cards = get().cards.filter(c => c.flagged);
        if (type) cards = cards.filter(c => c.type === type);
        return cards;
      },

      getCardsByPages: (pages, type) => {
        const pageSet = new Set(pages);
        let cards = get().cards.filter(c => pageSet.has(c.page));
        if (type) cards = cards.filter(c => c.type === type);
        return cards;
      },

      exportData: () => {
        return JSON.stringify({
          version: '1.1',
          exportedAt: new Date().toISOString(),
          cards: get().cards,
          reviewLogs: get().reviewLogs,
        }, null, 2);
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.cards) {
            const existingIds = new Set(get().cards.map(c => c.id));
            const newCards = (data.cards as SRSCard[]).filter(c => !existingIds.has(c.id));
            set({
              cards: [...get().cards, ...newCards],
              reviewLogs: [...get().reviewLogs, ...(data.reviewLogs || [])],
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      clearAll: () => set({ cards: [], reviewLogs: [] }),
    }),
    {
      name: 'srs.v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        cards: state.cards,
        reviewLogs: state.reviewLogs,
      }),
    }
  )
);
