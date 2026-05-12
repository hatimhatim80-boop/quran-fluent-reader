import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GhareebWord } from '@/types/quran';
import { canonicalize, canonicalFormsCompatible } from '@/utils/canonicalMatch';
import { ChevronLeft, ChevronRight, RotateCcw, X, Shuffle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { MeaningQuizConfig, DEFAULT_MEANING_QUIZ_CONFIG, STORAGE_KEY as MQ_SETTINGS_STORAGE_KEY } from './GhareebMeaningQuizSetup';
import { MeaningQuizLiveSettings } from './MeaningQuizLiveSettings';
import { MeaningSource } from '@/hooks/useAllGhareebSources';
import { useSessionsStore } from '@/stores/sessionsStore';

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
  const seenMeaningWord = new Set<string>();
  const list: QuizQuestion[] = [];
  for (const w of pool) {
    if (!w.meaning || !w.wordText) continue;
    const sig = `${canonicalize(w.wordText)}__${canonicalize(w.meaning)}`;
    if (seenMeaningWord.has(sig)) continue;
    seenMeaningWord.add(sig);

    // Multi-position acceptance: any word in `allWords` with same canonical word
    // AND same meaning is a valid answer.
    const targetCanonWord = canonicalize(w.wordText);
    const targetCanonMeaning = canonicalize(w.meaning);
    const acceptableKeys = new Set<string>();
    const acceptableCanon = new Set<string>([targetCanonWord]);
    for (const cand of allWords) {
      if (!cand.meaning || !cand.wordText) continue;
      if (canonicalize(cand.meaning) !== targetCanonMeaning) continue;
      if (
        canonicalize(cand.wordText) === targetCanonWord ||
        canonicalFormsCompatible(cand.wordText, w.wordText)
      ) {
        acceptableKeys.add(cand.uniqueKey);
        acceptableCanon.add(canonicalize(cand.wordText));
      }
    }
    acceptableKeys.add(w.uniqueKey);

    list.push({
      id: `${w.uniqueKey}_${list.length}`,
      target: w,
      acceptableKeys,
      acceptableCanon,
    });
  }
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
  questions: QuizQuestion[],
  stats: Map<string, WordStats>,
  mode: 'fair' | 'smart' | 'mushaf' | 'leastShown',
  avoidId?: string,
): number {
  if (questions.length === 0) return 0;
  if (questions.length === 1) return 0;

  const candIdx = questions.map((_, i) => i)
    .filter((i) => questions[i].id !== avoidId);
  const pool = candIdx.length ? candIdx : questions.map((_, i) => i);

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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const clearHighlightTimerRef = useRef<number | null>(null);

  const idx = history[histPos] ?? 0;
  const current = questions[idx];
  const isUnlimited = !config.questionLimit || config.questionLimit <= 0;
  const limit = config.questionLimit && config.questionLimit > 0 ? config.questionLimit : Infinity;

  // Re-build questions when pool/allWords change.
  useEffect(() => {
    const next = buildQuestions(pool, allWords);
    setQuestions(next);
    statsRef.current = new Map();
    setHistory(next.length ? [0] : []);
    setHistPos(0);
    setSolved(false);
    setWrongCount(0);
  }, [pool, allWords]);

  // On question change: navigate page, record "shown" stat, reset shown timer.
  useEffect(() => {
    if (!current) return;
    onNavigateToPage(current.target.pageNumber);
    setSolved(false);
    setWrongCount(0);
    const k = current.target.uniqueKey;
    const s = statsRef.current.get(k) || { ...EMPTY_STATS };
    s.shownCount += 1;
    s.lastShownAt = Date.now();
    statsRef.current.set(k, s);
    shownAtRef.current = performance.now();
  }, [current, onNavigateToPage]);

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

  const goNext = useCallback(() => {
    setHistPos((prev) => {
      // Forward through existing history first.
      if (prev + 1 < history.length) return prev + 1;
      if (questions.length === 0) return prev;
      // Respect question limit (unlimited keeps appending forever).
      if (!isUnlimited && history.length >= limit) return prev;
      const mode = (config.randomMode || 'smart') as 'fair' | 'smart' | 'mushaf' | 'leastShown';
      const avoidId = current?.id;
      const nextIdx = pickNextIndex(questions, statsRef.current, mode, avoidId);
      setHistory((h) => [...h, nextIdx]);
      return prev + 1;
    });
  }, [history.length, questions, isUnlimited, limit, config.randomMode, current]);

  const goPrev = useCallback(() => {
    setHistPos((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const reshuffle = useCallback(() => {
    const next = buildQuestions(pool, allWords);
    setQuestions(next);
    statsRef.current = new Map();
    setHistory(next.length ? [Math.floor(Math.random() * next.length)] : []);
    setHistPos(0);
    setScore({ correct: 0, wrong: 0 });
    setSolved(false);
    setWrongCount(0);
  }, [pool, allWords]);

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
      if (solved && config.advanceOnEmptyClick) {
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
      if (config.advanceOnEmptyClick) {
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

      toast.success('أحسنت', { duration: Math.min(1500, config.correctHighlightDurationMs) });

      // Re-queue this question N more times (spec: correctWordReviewRepeatCount).
      const repeat = Math.max(0, config.correctWordReviewRepeatCount || 0);

      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      if (clearHighlightTimerRef.current) window.clearTimeout(clearHighlightTimerRef.current);

      const hold = Math.max(300, config.correctHighlightDurationMs);
      if (config.autoAdvance) {
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

      toast.error('حاول مرة أخرى', { duration: 900 });

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
    current, solved, config, idx, histPos, goNext, wrongCount, findTargetEl, clearAllHighlights,
  ]);

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
          <button onClick={goNext} disabled={!isUnlimited && history.length >= limit && histPos >= history.length - 1} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
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

      {/* Footer: shows manual next button when not auto-advancing OR after solving last */}
      {solved && (
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
