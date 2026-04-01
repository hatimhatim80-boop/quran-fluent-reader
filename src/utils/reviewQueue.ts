import { SRSCard } from '@/stores/srsStore';

export interface ReviewQueueEntry {
  card: SRSCard;
  dueAt: number;
  order: number;
}

function compareQueueEntries(a: ReviewQueueEntry, b: ReviewQueueEntry) {
  if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
  return a.order - b.order;
}

export function insertQueueEntries(
  queue: ReviewQueueEntry[],
  entries: ReviewQueueEntry[]
): ReviewQueueEntry[] {
  return [...queue, ...entries].sort(compareQueueEntries);
}

export function removeQueueEntry(
  queue: ReviewQueueEntry[],
  cardId: string
): ReviewQueueEntry[] {
  return queue.filter((entry) => entry.card.id !== cardId);
}

export function partitionSessionCards(cards: SRSCard[], now = Date.now()) {
  const activeQueue: ReviewQueueEntry[] = [];
  const delayedQueue: ReviewQueueEntry[] = [];

  cards.forEach((card, order) => {
    const dueAt = Number.isFinite(card.nextReview) ? card.nextReview : now;
    const entry: ReviewQueueEntry = { card, dueAt, order };
    if (dueAt <= now) activeQueue.push(entry);
    else delayedQueue.push(entry);
  });

  activeQueue.sort(compareQueueEntries);
  delayedQueue.sort(compareQueueEntries);

  return {
    activeQueue,
    delayedQueue,
    nextOrder: cards.length,
  };
}

export function promoteDueQueue(queue: ReviewQueueEntry[], now = Date.now()) {
  const readyQueue: ReviewQueueEntry[] = [];
  const delayedQueue: ReviewQueueEntry[] = [];

  queue.forEach((entry) => {
    if (entry.dueAt <= now) readyQueue.push(entry);
    else delayedQueue.push(entry);
  });

  readyQueue.sort(compareQueueEntries);
  delayedQueue.sort(compareQueueEntries);

  return { readyQueue, delayedQueue };
}

export function getNextDueCountdownLabel(queue: ReviewQueueEntry[], now = Date.now()) {
  if (queue.length === 0) return null;
  const nearestDueAt = queue[0].dueAt;
  const remainingSeconds = Math.max(0, Math.ceil((nearestDueAt - now) / 1000));
  const formatter = new Intl.NumberFormat('ar-SA');

  if (remainingSeconds < 60) return `${formatter.format(remainingSeconds)} ث`;

  return `${formatter.format(Math.ceil(remainingSeconds / 60))} د`;
}