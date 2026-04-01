import { describe, expect, it } from 'vitest';
import type { SRSCard } from '@/stores/srsStore';
import {
  getNextDueCountdownLabel,
  insertQueueEntries,
  partitionSessionCards,
  promoteDueQueue,
  type ReviewQueueEntry,
} from '@/utils/reviewQueue';

function createCard(id: string, nextReview: number): SRSCard {
  return {
    id,
    type: 'ghareeb',
    page: 1,
    contentKey: id,
    label: id,
    meta: {},
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview,
    lastReview: 0,
    createdAt: 0,
  };
}

describe('reviewQueue ordering', () => {
  it('preserves the original session order when splitting active and delayed cards', () => {
    const cards = [
      createCard('a', 5_000),
      createCard('b', 0),
      createCard('c', 2_000),
      createCard('d', 0),
    ];

    const { activeQueue, delayedQueue } = partitionSessionCards(cards, 1_000);

    expect(activeQueue.map((entry) => entry.card.id)).toEqual(['b', 'd']);
    expect(delayedQueue.map((entry) => entry.card.id)).toEqual(['a', 'c']);
  });

  it('inserts newly ready cards by fixed session order instead of due time', () => {
    const existingQueue: ReviewQueueEntry[] = [
      { card: createCard('d', 0), dueAt: 0, order: 3 },
    ];
    const readyEntries: ReviewQueueEntry[] = [
      { card: createCard('b', 60_000), dueAt: 60_000, order: 1 },
      { card: createCard('c', 1_000), dueAt: 1_000, order: 2 },
    ];

    const merged = insertQueueEntries(existingQueue, readyEntries);

    expect(merged.map((entry) => entry.card.id)).toEqual(['b', 'c', 'd']);
  });

  it('promotes due cards without changing their preserved order', () => {
    const delayedQueue: ReviewQueueEntry[] = [
      { card: createCard('a', 60_000), dueAt: 60_000, order: 0 },
      { card: createCard('b', 1_000), dueAt: 1_000, order: 1 },
      { card: createCard('c', 2_000), dueAt: 2_000, order: 2 },
    ];

    const { readyQueue, delayedQueue: remaining } = promoteDueQueue(delayedQueue, 3_000);

    expect(readyQueue.map((entry) => entry.card.id)).toEqual(['b', 'c']);
    expect(remaining.map((entry) => entry.card.id)).toEqual(['a']);
  });

  it('uses the nearest due time for countdown even when delayed order is fixed', () => {
    const delayedQueue: ReviewQueueEntry[] = [
      { card: createCard('a', 60_000), dueAt: 60_000, order: 0 },
      { card: createCard('b', 30_000), dueAt: 30_000, order: 1 },
    ];

    expect(getNextDueCountdownLabel(delayedQueue, 0)).toBe('٣٠ ث');
  });
});