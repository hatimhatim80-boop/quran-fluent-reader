import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GhareebWord } from '@/types/quran';
import { canonicalize, canonicalFormsCompatible } from '@/utils/canonicalMatch';
import { ChevronLeft, ChevronRight, RotateCcw, X, Shuffle, Settings } from 'lucide-react';
import { MeaningQuizConfig, DEFAULT_MEANING_QUIZ_CONFIG, STORAGE_KEY as MQ_SETTINGS_STORAGE_KEY } from './GhareebMeaningQuizSetup';
import { MeaningQuizLiveSettings } from './MeaningQuizLiveSettings';
import { MeaningSource } from '@/hooks/useAllGhareebSources';
import { useSessionsStore } from '@/stores/sessionsStore';
import { useSRSStore, type SRSRating } from '@/stores/srsStore';

/** Question type identifier (per spec): meaning_to_mushaf_word */
export const QUIZ_TYPE_MEANING_TO_MUSHAF_WORD = 'meaning_to_mushaf_word' as const;

interface GhareebMeaningQuizProps {
  /** Pool of Ghareeb words to draw questions from. */
  pool: GhareebWord[];
  /** Source-of-truth list of all Ghareeb words (used to find duplicate positions for the same meaning). */
  allWords: GhareebWord[];
  /** Quiz behavior config from the setup screen. */
  config?: MeaningQuizConfig;
  /** If provided, progress is persisted to this session. */
  sessionId?: string;
  /** Initial question index (for resume). */
  initialIndex?: number;
  onClose: () => void;
  onNavigateToPage: (page: number) => void;
  /** Render a Mushaf page (no highlight passed by us — the target must be hidden). */
  renderPage: (page: number) => React.ReactNode;
  /** Optional: parent rebuilds pool/allWords when the user changes the meaning source live. */
  onSourceChange?: (src: MeaningSource) => Promise<void> | void;
}

interface QuizQuestion {
  id: string;
  target: GhareebWord;
  /** All uniqueKeys in `allWords` that share the same canonical word + meaning as the target. */
  acceptableKeys: Set<string>;
  /** Canonical forms of acceptable answers (fast match by text). */
  acceptableCanon: Set<string>;
}

interface WordStats {
  shownCount: number;
  correctCount: number;
  wrongCount: number;
  fastCorrectCount: number;
  slowCorrectCount: number;
  lastAnswerTimeMs: number; // 0 if none
  lastShownAt: number;      // 0 if none
}

interface MeaningReviewQueueEntry {
  questionIndex: number;
  dueAt: number;
  order: number;
  kind: 'new' | 'scheduled';
}

const EMPTY_STATS: WordStats = {
  shownCount: 0, correctCount: 0, wrongCount: 0,
  fastCorrectCount: 0, slowCorrectCount: 0,
  lastAnswerTimeMs: 0, lastShownAt: 0,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(pool: GhareebWord[], allWords: GhareebWord[]): QuizQuestion[] {
  const t0 = performance.now();
  // Pre-index allWords by canonical meaning to avoid O(pool * allWords) scans.
  const byMeaning = new Map<string, Array<{ canonWord: string; word: GhareebWord }>>();
  for (const cand of allWords) {
    if (!cand.meaning || !cand.wordText) continue;
    const m = canonicalize(cand.meaning);
    let bucket = byMeaning.get(m);
    if (!bucket) { bucket = []; byMeaning.set(m, bucket); }
    bucket.push({ canonWord: canonicalize(cand.wordText), word: cand });
  }

  const seenMeaningWord = new Set<string>();
  const list: QuizQuestion[] = [];
  for (const w of pool) {
    if (!w.meaning || !w.wordText) continue;
    const targetCanonWord = canonicalize(w.wordText);
    const targetCanonMeaning = canonicalize(w.meaning);
    const sig = `${targetCanonWord}__${targetCanonMeaning}`;
    if (seenMeaningWord.has(sig)) continue;
    seenMeaningWord.add(sig);

    const acceptableKeys = new Set<string>([w.uniqueKey]);
    const acceptableCanon = new Set<string>([targetCanonWord]);
    const bucket = byMeaning.get(targetCanonMeaning) || [];
    for (const { canonWord, word: cand } of bucket) {
      if (canonWord === targetCanonWord || canonicalFormsCompatible(cand.wordText, w.wordText)) {
        acceptableKeys.add(cand.uniqueKey);
        acceptableCanon.add(canonWord);
      }
    }

    list.push({
      id: `${w.uniqueKey}_${list.length}`,
      target: w,
      acceptableKeys,
      acceptableCanon,
    });
  }
  console.log(`[MeaningQuiz] buildQuestions: pool=${pool.length} allWords=${allWords.length} → ${list.length} questions in ${(performance.now() - t0).toFixed(1)}ms`);
  return list;
}

/** Speed bucket from answer time in ms. */
function speedBucket(ms: number): 'fast' | 'medium' | 'slow' {
  if (ms <= 3000) return 'fast';
  if (ms <= 8000) return 'medium';
  return 'slow';
}

/** Compute priority weight for a question per the smart-random spec. */
function computePriority(s: WordStats): number {
  // Base 100, boost wrongs/slow, dampen fast/shown. Floor at 5 so nothing dies.
  const p = 100
    + s.wrongCount * 30
    + s.slowCorrectCount * 15
    - s.fastCorrectCount * 10
    - s.shownCount * 5;
  return Math.max(5, p);
}

/** Weighted random pick. */
function weightedPick<T>(items: T[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * items.length);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return items.length - 1;
}

/** Pick the next question index based on the configured strategy. */
function pickNextIndex(
  candidateIndices: number[],
  questions: QuizQuestion[],
  stats: Map<string, WordStats>,
  mode: 'fair' | 'smart' | 'mushaf' | 'leastShown',
  avoidId?: string,
): number {
  if (candidateIndices.length === 0) return 0;
  if (candidateIndices.length === 1) return candidateIndices[0];

  const filtered = candidateIndices.filter((i) => questions[i]?.id !== avoidId);
  const pool = filtered.length ? filtered : candidateIndices;

  if (mode === 'mushaf') {
    // Stable mushaf order: surah, verse, wordIndex, page.
    const sorted = [...pool].sort((a, b) => {
      const A = questions[a].target, B = questions[b].target;
      return (A.surahNumber - B.surahNumber)
        || (A.verseNumber - B.verseNumber)
        || (A.wordIndex - B.wordIndex)
        || (A.pageNumber - B.pageNumber);
    });
    // Among unseen first, otherwise least-recently shown.
    const unseen = sorted.filter(i => (stats.get(questions[i].target.uniqueKey)?.shownCount || 0) === 0);
    if (unseen.length) return unseen[0];
    return sorted.sort((a, b) =>
      (stats.get(questions[a].target.uniqueKey)?.lastShownAt || 0)
      - (stats.get(questions[b].target.uniqueKey)?.lastShownAt || 0)
    )[0];
  }

  if (mode === 'leastShown') {
    return [...pool].sort((a, b) => {
      const sa = stats.get(questions[a].target.uniqueKey)?.shownCount || 0;
      const sb = stats.get(questions[b].target.uniqueKey)?.shownCount || 0;
      if (sa !== sb) return sa - sb;
      const la = stats.get(questions[a].target.uniqueKey)?.lastShownAt || 0;
      const lb = stats.get(questions[b].target.uniqueKey)?.lastShownAt || 0;
      return la - lb;
    })[0];
  }

  if (mode === 'fair') {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // smart: priority-weighted random; never-shown gets a strong boost so all words rotate in.
  const weights = pool.map((i) => {
    const s = stats.get(questions[i].target.uniqueKey) || EMPTY_STATS;
    let w = computePriority(s);
    if (s.shownCount === 0) w += 120; // ensure new words appear early
    return w;
  });
  const idx = weightedPick(pool, weights);
  return pool[idx];
}

function buildMeaningReviewQueues(questionCount: number, currentQuestionIndex: number) {
  const activeQueue: MeaningReviewQueueEntry[] = [];
  let order = 0;

  for (let i = 0; i < questionCount; i += 1) {
    if (i === currentQuestionIndex) continue;
    activeQueue.push({
      questionIndex: i,
      dueAt: 0,
      order: order++,
      kind: 'new',
    });
  }

  return {
    activeQueue,
    delayedQueue: [] as MeaningReviewQueueEntry[],
    nextOrder: order,
  };
}

function sortMeaningReviewQueue(queue: MeaningReviewQueueEntry[]) {
  return [...queue].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'scheduled' ? -1 : 1;
    if (a.kind === 'scheduled' && a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return a.order - b.order;
  });
}

function promoteMeaningReviewQueue(queue: MeaningReviewQueueEntry[], now = Date.now()) {
  const readyQueue: MeaningReviewQueueEntry[] = [];
  const delayedQueue: MeaningReviewQueueEntry[] = [];

  queue.forEach((entry) => {
    if (entry.dueAt <= now) readyQueue.push(entry);
    else delayedQueue.push(entry);
  });

  return {
    readyQueue: sortMeaningReviewQueue(readyQueue),
    delayedQueue: sortMeaningReviewQueue(delayedQueue),
  };
}

function getMeaningNextDueCountdownLabel(queue: MeaningReviewQueueEntry[], now = Date.now()) {
  if (queue.length === 0) return null;
  const nearestDueAt = queue.reduce(
    (nearest, entry) => Math.min(nearest, entry.dueAt),
    Number.POSITIVE_INFINITY,
  );
  const remainingSeconds = Math.max(0, Math.ceil((nearestDueAt - now) / 1000));
  const formatter = new Intl.NumberFormat('ar-SA');

  if (remainingSeconds < 60) return `${formatter.format(remainingSeconds)} ث`;
  return `${formatter.format(Math.ceil(remainingSeconds / 60))} د`;
}

export function GhareebMeaningQuiz({
  pool,
  allWords,
  config: providedConfig,
  sessionId,
  initialIndex,
  onClose,
  onNavigateToPage,
  renderPage,
  onSourceChange,
}: GhareebMeaningQuizProps) {
  const updateSession = useSessionsStore((s) => s.updateSession);
  // Live config: editable mid-session via the gear button.
  const [config, setConfig] = useState<MeaningQuizConfig>(providedConfig ?? DEFAULT_MEANING_QUIZ_CONFIG);
  // Sync when parent provides a new config (e.g., after source change).
  useEffect(() => {
    if (providedConfig) setConfig(providedConfig);
  }, [providedConfig]);
  const [showLiveSettings, setShowLiveSettings] = useState(false);

  const persistConfig = useCallback((next: MeaningQuizConfig) => {
    setConfig(next);
    try { localStorage.setItem(MQ_SETTINGS_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
    if (sessionId) {
      const session = useSessionsStore.getState().getSession(sessionId);
      const existing = (session?.quizSettings || {}) as Record<string, unknown>;
      updateSession(sessionId, { quizSettings: { ...existing, config: next } });
    }
  }, [sessionId, updateSession]);

  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildQuestions(pool, allWords));
  // Per-word stats keyed by target.uniqueKey (kept in a ref so updates don't re-render).
  const statsRef = useRef<Map<string, WordStats>>(new Map());
  // History of shown question indices (into `questions`). Allows back-navigation.
  const [history, setHistory] = useState<number[]>(() => (questions.length ? [Math.min(initialIndex ?? 0, questions.length - 1)] : []));
  const [histPos, setHistPos] = useState<number>(0);
  // Timestamp when current question became visible (for speed measurement).
  const shownAtRef = useRef<number>(performance.now());

  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [solved, setSolved] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  /** When set, the SRS rating buttons are shown and auto-advance is blocked until the user picks a rating. */
  const [pendingRateCardId, setPendingRateCardId] = useState<string | null>(null);
  const [activeReviewQueue, setActiveReviewQueue] = useState<MeaningReviewQueueEntry[]>([]);
  const [delayedReviewQueue, setDelayedReviewQueue] = useState<MeaningReviewQueueEntry[]>([]);
  const [nextDueCountdown, setNextDueCountdown] = useState<string | null>(null);
  const requiresReviewDurationSelection = !!config.rescheduleCorrectAsSRS;
  const shouldShowReviewDurationButtons = solved && requiresReviewDurationSelection;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const clearHighlightTimerRef = useRef<number | null>(null);
  const nextQueueOrderRef = useRef(0);
  const questionNextReviewRef = useRef<Map<number, number>>(new Map());

  const idx = history[histPos];
  const current = typeof idx === 'number' ? questions[idx] : undefined;
  const isUnlimited = !config.questionLimit || config.questionLimit <= 0;
  const limit = config.questionLimit && config.questionLimit > 0 ? config.questionLimit : Infinity;

  // Re-build questions when pool/allWords change.
  useEffect(() => {
    const next = buildQuestions(pool, allWords);
    const startIdx = next.length ? Math.min(initialIndex ?? 0, next.length - 1) : undefined;
    setQuestions(next);
    statsRef.current = new Map();
    questionNextReviewRef.current = new Map();
    setHistory(typeof startIdx === 'number' ? [startIdx] : []);
    setHistPos(0);
    setSolved(false);
    setWrongCount(0);
    if (config.rescheduleCorrectAsSRS && typeof startIdx === 'number') {
      const queues = buildMeaningReviewQueues(next.length, startIdx);
      setActiveReviewQueue(queues.activeQueue);
      setDelayedReviewQueue(queues.delayedQueue);
      nextQueueOrderRef.current = queues.nextOrder;
      setNextDueCountdown(null);
    } else {
      setActiveReviewQueue([]);
      setDelayedReviewQueue([]);
      nextQueueOrderRef.current = 0;
      setNextDueCountdown(null);
    }
  }, [pool, allWords, initialIndex, config.rescheduleCorrectAsSRS]);

  // On every navigation step: navigate page, record "shown" stat, reset shown timer.
  // Important: depend on histPos as well, not only `current`, because the same
  // question index can be intentionally re-queued. In that case React keeps the
  // same object reference and we still must reset `solved` / `pendingRateCardId`
  // so the review-duration buttons appear again after the next correct answer.
  useEffect(() => {
    if (!current) return;
    onNavigateToPage(current.target.pageNumber);
    setSolved(false);
    setWrongCount(0);
    setPendingRateCardId(null);
    const k = current.target.uniqueKey;
    const s = statsRef.current.get(k) || { ...EMPTY_STATS };
    s.shownCount += 1;
    s.lastShownAt = Date.now();
    statsRef.current.set(k, s);
    shownAtRef.current = performance.now();
  }, [histPos, idx, current, onNavigateToPage]);

  // Persist progress to session (if any).
  useEffect(() => {
    if (!sessionId) return;
    const total = isUnlimited ? Math.max(history.length, 1) : Math.max(1, Math.min(limit, questions.length));
    const done = history.length - (solved ? 0 : 1);
    const pct = isUnlimited ? 0 : Math.min(100, Math.round((Math.max(0, done) / total) * 100));
    const session = useSessionsStore.getState().getSession(sessionId);
    const existing = (session?.quizSettings || {}) as Record<string, unknown>;
    updateSession(sessionId, {
      currentPage: current?.target.pageNumber || 1,
      lastOpenedAt: Date.now(),
      progress: pct,
      quizSettings: {
        ...existing,
        currentIndex: histPos,
        total: isUnlimited ? history.length : Math.min(limit, questions.length),
        correct: score.correct,
        wrong: score.wrong,
      },
    });
  }, [histPos, history.length, score, solved, sessionId, current, questions.length, updateSession, isUnlimited, limit]);

  // Cleanup pending timers on unmount.
  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (clearHighlightTimerRef.current) window.clearTimeout(clearHighlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (!config.rescheduleCorrectAsSRS) return;

    const tick = () => {
      const now = Date.now();
      setDelayedReviewQueue((prev) => {
        if (prev.length === 0) {
          setNextDueCountdown(null);
          return prev;
        }
        const { readyQueue, delayedQueue: nextDelayed } = promoteMeaningReviewQueue(prev, now);
        setNextDueCountdown(getMeaningNextDueCountdownLabel(nextDelayed, now));
        if (readyQueue.length > 0) {
          setActiveReviewQueue((prevActive) => sortMeaningReviewQueue([...readyQueue, ...prevActive]));
        }
        return nextDelayed;
      });
    };

    tick();
    const interval = window.setInterval(tick, 10000);
    return () => window.clearInterval(interval);
  }, [config.rescheduleCorrectAsSRS]);

  const goNext = useCallback((reason = 'manual_next', queueOverride?: {
    activeQueue?: MeaningReviewQueueEntry[];
    delayedQueue?: MeaningReviewQueueEntry[];
  }) => {
    if (histPos + 1 < history.length) {
      const nextIdx = history[histPos + 1];
      console.log('[MeaningQuiz] next question selection', {
        totalWords: questions.length,
        dueWordsCount: activeReviewQueue.length,
        futureWordsCount: delayedReviewQueue.length,
        nextWordKey: typeof nextIdx === 'number' ? questions[nextIdx]?.target.uniqueKey ?? null : null,
        nextWordNextReviewAt: typeof nextIdx === 'number' ? questionNextReviewRef.current.get(nextIdx) ?? null : null,
        reason: 'history_forward',
      });
      setHistPos(histPos + 1);
      return;
    }

    if (questions.length === 0) return;

    if (config.rescheduleCorrectAsSRS) {
      const now = Date.now();
      const baseActive = queueOverride?.activeQueue ?? activeReviewQueue;
      const baseDelayed = queueOverride?.delayedQueue ?? delayedReviewQueue;
      const { readyQueue, delayedQueue: nextDelayed } = promoteMeaningReviewQueue(baseDelayed, now);
      const promotedActive = sortMeaningReviewQueue([...baseActive, ...readyQueue]);
      const futureWordsCount = nextDelayed.length;
      const dueWordsCount = promotedActive.length;

      setDelayedReviewQueue(nextDelayed);
      setNextDueCountdown(getMeaningNextDueCountdownLabel(nextDelayed, now));

      if (promotedActive.length === 0) {
        setActiveReviewQueue([]);
        console.log('[MeaningQuiz] next question selection', {
          totalWords: questions.length,
          dueWordsCount,
          futureWordsCount,
          nextWordKey: null,
          nextWordNextReviewAt: null,
          reason: futureWordsCount > 0 ? `${reason}:waiting_for_delayed` : `${reason}:queue_exhausted`,
        });
        setHistPos(history.length);
        return;
      }

      const [nextEntry, ...remainingActive] = promotedActive;
      const nextIdx = nextEntry.questionIndex;
      setActiveReviewQueue(remainingActive);
      console.log('[MeaningQuiz] next question selection', {
        totalWords: questions.length,
        dueWordsCount,
        futureWordsCount,
        nextWordKey: questions[nextIdx]?.target.uniqueKey ?? null,
        nextWordNextReviewAt: nextEntry.kind === 'scheduled'
          ? questionNextReviewRef.current.get(nextIdx) ?? nextEntry.dueAt
          : null,
        reason: `${reason}:${nextEntry.kind === 'scheduled' ? 'scheduled_due' : 'new_unreviewed'}`,
      });
      setHistory((prev) => [...prev, nextIdx]);
      setHistPos(history.length);
      return;
    }

    if (!isUnlimited && history.length >= limit) return;
    const mode = (config.randomMode || 'smart') as 'fair' | 'smart' | 'mushaf' | 'leastShown';
    const avoidId = current?.id;
    const candidateIndices = questions.map((_, questionIndex) => questionIndex);
    const nextIdx = pickNextIndex(candidateIndices, questions, statsRef.current, mode, avoidId);
    console.log('[MeaningQuiz] next question selection', {
      totalWords: questions.length,
      dueWordsCount: questions.length,
      futureWordsCount: 0,
      nextWordKey: questions[nextIdx]?.target.uniqueKey ?? null,
      nextWordNextReviewAt: null,
      reason: `${reason}:random_mode_${mode}`,
    });
    setHistory((prev) => [...prev, nextIdx]);
    setHistPos(history.length);
  }, [
    histPos,
    history,
    questions,
    config.rescheduleCorrectAsSRS,
    config.randomMode,
    activeReviewQueue,
    delayedReviewQueue,
    isUnlimited,
    limit,
    current,
  ]);

  useEffect(() => {
    if (!config.rescheduleCorrectAsSRS) return;
    if (current || solved || pendingRateCardId || activeReviewQueue.length === 0) return;
    goNext('auto_promote_ready', { activeQueue: activeReviewQueue, delayedQueue: delayedReviewQueue });
  }, [config.rescheduleCorrectAsSRS, current, solved, pendingRateCardId, activeReviewQueue, delayedReviewQueue, goNext]);

  const goPrev = useCallback(() => {
    setHistPos((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const reshuffle = useCallback(() => {
    const next = buildQuestions(pool, allWords);
    const startIdx = next.length ? Math.floor(Math.random() * next.length) : undefined;
    setQuestions(next);
    statsRef.current = new Map();
    questionNextReviewRef.current = new Map();
    setHistory(typeof startIdx === 'number' ? [startIdx] : []);
    setHistPos(0);
    setScore({ correct: 0, wrong: 0 });
    setSolved(false);
    setWrongCount(0);
    if (config.rescheduleCorrectAsSRS && typeof startIdx === 'number') {
      const queues = buildMeaningReviewQueues(next.length, startIdx);
      setActiveReviewQueue(queues.activeQueue);
      setDelayedReviewQueue(queues.delayedQueue);
      nextQueueOrderRef.current = queues.nextOrder;
      setNextDueCountdown(null);
    } else {
      setActiveReviewQueue([]);
      setDelayedReviewQueue([]);
      nextQueueOrderRef.current = 0;
      setNextDueCountdown(null);
    }
  }, [pool, allWords, config.rescheduleCorrectAsSRS]);

  // Clear all .mq-correct from the surface (between questions).
  const clearAllHighlights = useCallback(() => {
    if (!surfaceRef.current) return;
    surfaceRef.current.querySelectorAll('.mq-correct, .mq-wrong, .mq-hint').forEach((el) => {
      el.classList.remove('mq-correct', 'mq-wrong', 'mq-hint');
    });
  }, []);

  // Clear highlights when moving between questions.
  useEffect(() => {
    clearAllHighlights();
  }, [histPos, clearAllHighlights]);

  // Find the target word element on the surface (for hint).
  const findTargetEl = useCallback((): HTMLElement | null => {
    if (!surfaceRef.current || !current) return null;
    // Try data-ghareeb-key first (used by ghareeb words).
    for (const key of current.acceptableKeys) {
      const el = surfaceRef.current.querySelector<HTMLElement>(`[data-ghareeb-key="${CSS.escape(key)}"]`);
      if (el) return el;
    }
    // Fallback: scan .quran-word and match by canonical text.
    const words = surfaceRef.current.querySelectorAll<HTMLElement>('.quran-word');
    for (const el of Array.from(words)) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (current.acceptableCanon.has(canonicalize(txt))) return el;
    }
    return null;
  }, [current]);

  // Event delegation for clicks on Quranic words.
  const handleSurfaceClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!current) return;
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const wordEl = t.closest<HTMLElement>('.quran-word');

    // Empty-area click: after solved, advance to next question if enabled.
    if (!wordEl) {
      if (solved && config.advanceOnEmptyClick && !pendingRateCardId) {
        e.preventDefault();
        e.stopPropagation();
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        clearAllHighlights();
        goNext();
      }
      return;
    }

    // After solved, ignore clicks on other words (locked state).
    if (solved) {
      if (config.advanceOnEmptyClick && !pendingRateCardId) {
        e.preventDefault();
        e.stopPropagation();
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        clearAllHighlights();
        goNext();
      }
      return;
    }

    // Exclude verse numbers, waqf marks, hizb marks, sajda marks, ornaments.
    const blocked = ['verse-number', 'waqf-mark', 'hizb-mark', 'sajda-mark', 'page-decoration'];
    if (blocked.some((c) => wordEl.classList.contains(c))) return;
    if (wordEl.closest('.verse-number, .waqf-mark, .hizb-mark, .sajda-mark')) return;

    e.preventDefault();
    e.stopPropagation();

    const clickedRaw = (wordEl.textContent || '').trim();
    if (!clickedRaw) return;

    // Match by uniqueKey (most accurate) OR canonical text in acceptable set.
    const clickedKey = wordEl.getAttribute('data-ghareeb-key') || '';
    const clickedCanon = canonicalize(clickedRaw);
    const isMatch =
      (clickedKey && current.acceptableKeys.has(clickedKey)) ||
      current.acceptableCanon.has(clickedCanon) ||
      Array.from(current.acceptableCanon).some((c) =>
        canonicalFormsCompatible(c, clickedRaw),
      );

    if (isMatch) {
      // Apply correct highlight and HOLD it for the configured duration.
      wordEl.classList.add('mq-correct');
      setSolved(true);
      setScore((s) => ({ ...s, correct: s.correct + 1 }));

      // Smart-stats: record correct + speed bucket.
      const elapsed = performance.now() - shownAtRef.current;
      const bucket = speedBucket(elapsed);
      const k = current.target.uniqueKey;
      const st = statsRef.current.get(k) || { ...EMPTY_STATS };
      st.correctCount += 1;
      st.lastAnswerTimeMs = Math.round(elapsed);
      if (bucket === 'fast') st.fastCorrectCount += 1;
      else if (bucket === 'slow') st.slowCorrectCount += 1;
      statsRef.current.set(k, st);

      // Reschedule-as-SRS toggle: ALWAYS show rating buttons after a correct answer
      // when the toggle is on. Independence from source/state/speed/repetition is
      // explicit per spec. We never silently drop the buttons — if card creation
      // fails for any reason we still show them and log the reason.
      let pendingId: string | null = null;
      const reasonsBlocked: string[] = [];
      if (config.rescheduleCorrectAsSRS) {
        const srs = useSRSStore.getState();
        const uk = current.target.uniqueKey;
        const fixedId = `ghareeb_${uk}`;
        try {
          let cardId: string | undefined = srs.hasCard(fixedId)
            ? fixedId
            : srs.cards.find(c => c.type === 'ghareeb' && c.contentKey === uk)?.id;
          if (!cardId) {
            srs.addCard({
              id: fixedId,
              type: 'ghareeb',
              page: current.target.pageNumber,
              contentKey: uk,
              label: current.target.wordText || uk,
              meta: {
                surahNumber: current.target.surahNumber,
                verseNumber: current.target.verseNumber,
                wordIndex: current.target.wordIndex,
                meaning: current.target.meaning,
              },
            });
            cardId = fixedId;
          }
          pendingId = cardId;
        } catch (e) {
          reasonsBlocked.push(`srs_error:${(e as Error)?.message || 'unknown'}`);
          // Fallback: use a synthetic id so buttons still render; rating call is no-op.
          pendingId = fixedId;
        }
      } else {
        reasonsBlocked.push('rescheduleCorrectAsSRS=false');
      }

      const shouldShow = !!config.rescheduleCorrectAsSRS;
      console.log('[MeaningQuiz] correct answer', {
        selectedWord: clickedRaw,
        targetWord: current.target.wordText,
        isCorrect: true,
        answerStatus: 'correct',
        reviewDurationSelectionEnabled: !!config.rescheduleCorrectAsSRS,
        shouldShowReviewDurationButtons: shouldShow,
        pendingRateCardId: pendingId,
        blockedReasons: reasonsBlocked,
      });

      setPendingRateCardId(config.rescheduleCorrectAsSRS ? (pendingId || `ghareeb_${current.target.uniqueKey}`) : null);

      // Re-queue this question N more times (spec: correctWordReviewRepeatCount).
      const repeat = Math.max(0, config.correctWordReviewRepeatCount || 0);

      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      if (clearHighlightTimerRef.current) window.clearTimeout(clearHighlightTimerRef.current);

      const hold = Math.max(300, config.correctHighlightDurationMs);
      // BLOCK auto-advance whenever rating buttons are pending.
      if (config.autoAdvance && !config.rescheduleCorrectAsSRS) {
        // Advance ONLY after the highlight hold duration completes.
        advanceTimerRef.current = window.setTimeout(() => {
          // Re-queue (insert same question index ahead) if requested.
          if (repeat > 0) {
            setHistory((h) => {
              const next = [...h];
              const startInsert = histPos + 1;
              for (let i = 0; i < repeat; i++) {
                const remaining = next.length - startInsert;
                const offset = Math.floor(Math.random() * Math.max(1, remaining + 1));
                next.splice(startInsert + offset, 0, idx);
              }
              return next;
            });
          }
          goNext();
        }, hold);
      }
    } else {
      // Wrong answer.
      wordEl.classList.add('mq-wrong');
      window.setTimeout(() => wordEl.classList.remove('mq-wrong'), 900);
      setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      const newWrongCount = wrongCount + 1;
      setWrongCount(newWrongCount);

      // Smart-stats: record wrong attempt.
      const k = current.target.uniqueKey;
      const st = statsRef.current.get(k) || { ...EMPTY_STATS };
      st.wrongCount += 1;
      statsRef.current.set(k, st);

      // Hint: pulse the correct location subtly (NOT a full reveal).
      if (config.hintEnabled && newWrongCount >= config.hintAfterWrong) {
        const hintEl = findTargetEl();
        if (hintEl) {
          hintEl.classList.add('mq-hint');
          window.setTimeout(() => hintEl.classList.remove('mq-hint'), 1400);
        }
      }
    }
  }, [
    current, solved, config, idx, histPos, goNext, wrongCount, findTargetEl, clearAllHighlights, pendingRateCardId,
  ]);

  /** Apply a rating to the pending card and advance to the next question. */
  const handleRateAndAdvance = useCallback((rating: SRSRating, manualInterval?: number) => {
    if (!pendingRateCardId || typeof idx !== 'number' || !current) return;
    const now = Date.now();
    const selectedDurationMs = Math.max(0, (manualInterval || 0) * 24 * 60 * 60 * 1000);
    const newNextReviewAt = now + selectedDurationMs;
    const previousNextReviewAt = questionNextReviewRef.current.get(idx) ?? null;

    try {
      useSRSStore.getState().rateCard(pendingRateCardId, rating, manualInterval);
    } catch { /* noop */ }

    questionNextReviewRef.current.set(idx, newNextReviewAt);

    const baseActiveQueue = activeReviewQueue.filter((entry) => entry.questionIndex !== idx);
    const baseDelayedQueue = delayedReviewQueue.filter((entry) => entry.questionIndex !== idx);
    const nextEntry: MeaningReviewQueueEntry = {
      questionIndex: idx,
      dueAt: newNextReviewAt,
      order: nextQueueOrderRef.current++,
      kind: 'scheduled',
    };

    const nextActiveQueue = selectedDurationMs === 0
      ? sortMeaningReviewQueue([nextEntry, ...baseActiveQueue])
      : sortMeaningReviewQueue(baseActiveQueue);
    const nextDelayedQueue = selectedDurationMs === 0
      ? sortMeaningReviewQueue(baseDelayedQueue)
      : sortMeaningReviewQueue([...baseDelayedQueue, nextEntry]);

    console.log('[MeaningQuiz] review duration selected', {
      selectedWordKey: current.target.uniqueKey,
      selectedDurationLabel: selectedDurationMs === 0
        ? 'فوري'
        : manualInterval === 1 / 1440
          ? 'بعد دقيقة'
          : manualInterval === 1 / 24
            ? 'بعد ساعة'
            : manualInterval === 1
              ? 'بعد يوم'
              : manualInterval === 3
                ? 'بعد 3 أيام'
                : manualInterval === 7
                  ? 'بعد أسبوع'
                  : 'مدة مخصصة',
      selectedDurationMs,
      previousNextReviewAt,
      newNextReviewAt,
      now,
      isDueNow: newNextReviewAt <= now,
    });

    setPendingRateCardId(null);
    setActiveReviewQueue(nextActiveQueue);
    setDelayedReviewQueue(nextDelayedQueue);
    setNextDueCountdown(getMeaningNextDueCountdownLabel(nextDelayedQueue, now));
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    clearAllHighlights();
    goNext('review_duration_selected', { activeQueue: nextActiveQueue, delayedQueue: nextDelayedQueue });
  }, [pendingRateCardId, idx, current, activeReviewQueue, delayedReviewQueue, clearAllHighlights, goNext]);

  if (questions.length === 0) {
    return (
      <div className="p-6 text-center font-arabic" dir="rtl">
        <p className="text-muted-foreground mb-4">لا توجد كلمات متاحة لهذا التدريب.</p>
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
    );
  }
  if (!current) return null;

  // Dynamic correct color based on config.
  const correctColor = config.correctHighlightColor;
  const ghareebColor = config.ghareebWordsHighlightColor;
  const ghStyle = config.ghareebWordsHighlightStyle;
  const ghEnabled = config.ghareebWordsHighlightEnabled && ghStyle !== 'none';

  // Selector targets ghareeb words on the quiz surface that are NOT in answer states.
  // Covers both `.quran-word[data-ghareeb-key]` and the global `.ghareeb-word` class
  // (which has default backgrounds/colors defined in index.css and must be neutralized).
  const baseSel =
    '[data-meaning-quiz-surface] .quran-word[data-ghareeb-key]:not(.mq-correct):not(.mq-wrong):not(.mq-hint),' +
    '[data-meaning-quiz-surface] .ghareeb-word:not(.mq-correct):not(.mq-wrong):not(.mq-hint)';

  // Full reset — strips ALL pre-answer visual treatments coming from global Ghareeb CSS.
  const ghareebReset = `${baseSel} {
    color: inherit !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border-color: transparent !important;
    outline: none !important;
    text-decoration: none !important;
    text-shadow: none !important;
    filter: none !important;
  }`;

  let ghareebCss = ghareebReset;
  if (ghEnabled) {
    if (ghStyle === 'textColor') {
      // ONLY text color — no border/background/shadow.
      ghareebCss += `\n${baseSel} { color: hsl(${ghareebColor}) !important; }`;
    } else if (ghStyle === 'background') {
      // ONLY background — no border/shadow.
      ghareebCss += `\n${baseSel} { background-color: hsl(${ghareebColor} / 0.22) !important; border-radius: 4px; }`;
    } else if (ghStyle === 'border') {
      // ONLY a non-layout-shifting border via inset box-shadow.
      ghareebCss += `\n${baseSel} { box-shadow: inset 0 0 0 1.5px hsl(${ghareebColor} / 0.85) !important; border-radius: 4px; }`;
    }
  }

  const dynamicCss = `
    ${ghareebCss}
    .mq-correct {
      background: hsl(${correctColor} / 0.40) !important;
      color: hsl(${correctColor.split(' ')[0]} 60% 18%) !important;
      border-radius: 6px;
      transition: background-color 250ms ease;
      box-shadow: 0 0 0 2px hsl(${correctColor} / 0.65) !important;
    }
    .mq-wrong {
      background: hsl(0 75% 55% / 0.35) !important;
      color: hsl(0 60% 25%) !important;
      border-radius: 6px;
      transition: background-color 200ms ease;
      box-shadow: 0 0 0 2px hsl(0 75% 55% / 0.6) !important;
      animation: mq-shake 0.35s ease-in-out;
    }
    .mq-hint {
      box-shadow: 0 0 0 2px hsl(${correctColor} / 0.55), 0 0 12px hsl(${correctColor} / 0.6) !important;
      border-radius: 6px;
      animation: mq-pulse 1.4s ease-in-out;
    }
    @keyframes mq-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
    @keyframes mq-pulse { 0%,100%{ box-shadow: 0 0 0 2px hsl(${correctColor} / 0.0), 0 0 0 hsl(${correctColor} / 0.0); } 50%{ box-shadow: 0 0 0 3px hsl(${correctColor} / 0.7), 0 0 14px hsl(${correctColor} / 0.7); } }
  `;

  return (
    <div className="relative flex h-full min-h-0 flex-col" dir="rtl">
      <style>{dynamicCss}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-arabic text-sm font-bold text-primary">المعنى ← الكلمة في المصحف</span>
          <span className="text-xs text-muted-foreground font-arabic">
            {histPos + 1} / {isUnlimited ? '∞' : Math.min(limit, questions.length)} · ✓{score.correct} · ✗{score.wrong}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLiveSettings(true)}
            title="إعدادات الجلسة"
            className="nav-button w-7 h-7 rounded-full"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={reshuffle} title="إعادة الخلط" className="nav-button w-7 h-7 rounded-full">
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={goPrev} disabled={histPos <= 0} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => goNext()} disabled={!isUnlimited && history.length >= limit && histPos >= history.length - 1} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="nav-button w-7 h-7 rounded-full mr-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meaning prompt */}
      <div className="px-4 py-3 border-b border-border bg-card/40 shrink-0 text-center">
        {config.showPromptText !== false && (
          <p className="font-arabic text-xs text-muted-foreground mb-1">
            ابحث عن الكلمة القرآنية التي يدل عليها هذا المعنى
          </p>
        )}
        <p className="font-arabic text-2xl sm:text-3xl font-bold text-foreground leading-relaxed">
          {current.target.meaning}
        </p>
        {config.showMeaningSourceName && (() => {
          const av = current.target.availableSources || [];
          let label = '';
          if (av.length === 1) {
            label = av[0] === 'muyassar' ? 'الميسّر في غريب القرآن' : 'كتاب دروبي';
          } else if (av.length > 1) {
            label = 'الميسّر + كتاب دروبي';
          }
          return label ? (
            <p className="font-arabic text-[11px] text-primary/80 mt-1">المصدر: {label}</p>
          ) : null;
        })()}
        {(() => {
          const showSurah = config.showSurahName !== false;
          const showPage = config.showPageNumber !== false;
          if (!showSurah && !showPage) return null;
          const parts: string[] = [];
          if (showSurah) parts.push(current.target.surahName);
          if (showPage) parts.push(`صفحة ${current.target.pageNumber}`);
          return (
            <p className="font-arabic text-xs text-muted-foreground mt-1">
              {parts.join(' — ')}
            </p>
          );
        })()}
      </div>

      {/* Mushaf surface */}
      <div
        ref={surfaceRef}
        className="flex-1 min-h-0 overflow-auto p-2"
        data-meaning-quiz-surface="true"
        onClickCapture={handleSurfaceClick}
      >
        {renderPage(current.target.pageNumber)}
      </div>

      {/* Footer: SRS rating buttons (when pending) OR manual next button */}
      {shouldShowReviewDurationButtons && (
        <div className="border-t border-border bg-card/70 px-3 py-2 shrink-0 space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-arabic text-center font-bold">
            ⏱ مدة الإعادة الذكية
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: 'فوري', days: 0 },
              { label: '١ دقيقة', days: 1 / 1440 },
              { label: '٥ دقائق', days: 5 / 1440 },
              { label: '١٠ دقائق', days: 10 / 1440 },
              { label: 'ساعة', days: 1 / 24 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => handleRateAndAdvance(3, days)}
                className="py-1.5 px-1 rounded-md border border-primary/30 bg-primary/5 text-[11px] font-arabic font-bold hover:bg-primary/15 hover:border-primary/50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: 'يوم', days: 1 },
              { label: '٣ أيام', days: 3 },
              { label: 'أسبوع', days: 7 },
              { label: 'أسبوعان', days: 14 },
              { label: 'شهر', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => handleRateAndAdvance(3, days)}
                className="py-1.5 px-1 rounded-md border border-border text-[11px] font-arabic hover:bg-accent transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {solved && !shouldShowReviewDurationButtons && (
        <div className="border-t border-border bg-card/60 px-4 py-2 text-center shrink-0">
          {!config.autoAdvance ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => { clearAllHighlights(); goNext(); }}
              disabled={!isUnlimited && history.length >= limit && histPos >= history.length - 1}
              className="font-arabic"
            >
              السؤال التالي
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground font-arabic">
              ينتقل تلقائياً بعد {(config.correctHighlightDurationMs / 1000).toFixed(1)} ث...
            </p>
          )}
          {!isUnlimited && history.length >= limit && histPos >= history.length - 1 && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" className="font-arabic gap-1" onClick={reshuffle}>
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة
              </Button>
              <Button size="sm" variant="outline" className="font-arabic" onClick={onClose}>
                إنهاء
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Live in-session settings overlay */}
      {showLiveSettings && (
        <MeaningQuizLiveSettings
          config={config}
          onChange={persistConfig}
          onSourceChange={onSourceChange ? async (src) => {
            await onSourceChange(src);
            persistConfig({ ...config, meaningSource: src });
          } : undefined}
          onClose={() => setShowLiveSettings(false)}
        />
      )}
    </div>
  );
}
