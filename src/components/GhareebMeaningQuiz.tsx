import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GhareebWord } from '@/types/quran';
import { canonicalize, canonicalFormsCompatible } from '@/utils/canonicalMatch';
import { ChevronLeft, ChevronRight, RotateCcw, X, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { MeaningQuizConfig, DEFAULT_MEANING_QUIZ_CONFIG } from './GhareebMeaningQuizSetup';
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
}

interface QuizQuestion {
  id: string;
  target: GhareebWord;
  /** All uniqueKeys in `allWords` that share the same canonical word + meaning as the target. */
  acceptableKeys: Set<string>;
  /** Canonical forms of acceptable answers (fast match by text). */
  acceptableCanon: Set<string>;
}

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
  return shuffle(list);
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
}: GhareebMeaningQuizProps) {
  const config = providedConfig ?? DEFAULT_MEANING_QUIZ_CONFIG;
  const updateSession = useSessionsStore((s) => s.updateSession);

  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildQuestions(pool, allWords));
  const [idx, setIdx] = useState(initialIndex ?? 0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [solved, setSolved] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const clearHighlightTimerRef = useRef<number | null>(null);

  const current = questions[idx];

  // Re-build questions when pool/allWords change.
  useEffect(() => {
    const next = buildQuestions(pool, allWords);
    setQuestions(next);
    setIdx((prev) => Math.min(prev, Math.max(0, next.length - 1)));
    setSolved(false);
    setWrongCount(0);
  }, [pool, allWords]);

  // Navigate to the target's page when question changes.
  useEffect(() => {
    if (current) onNavigateToPage(current.target.pageNumber);
    setSolved(false);
    setWrongCount(0);
  }, [current, onNavigateToPage]);

  // Persist progress to session (if any).
  useEffect(() => {
    if (!sessionId) return;
    const total = Math.max(1, questions.length);
    const pct = Math.min(100, Math.round(((idx + (solved ? 1 : 0)) / total) * 100));
    const session = useSessionsStore.getState().getSession(sessionId);
    const existing = (session?.quizSettings || {}) as Record<string, unknown>;
    updateSession(sessionId, {
      currentPage: current?.target.pageNumber || 1,
      lastOpenedAt: Date.now(),
      progress: pct,
      quizSettings: {
        ...existing,
        currentIndex: idx,
        total: questions.length,
        correct: score.correct,
        wrong: score.wrong,
      },
    });
  }, [idx, score, solved, sessionId, current, questions.length, updateSession]);

  // Cleanup pending timers on unmount.
  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (clearHighlightTimerRef.current) window.clearTimeout(clearHighlightTimerRef.current);
  }, []);

  const goNext = useCallback(() => {
    setIdx((prev) => (prev + 1 < questions.length ? prev + 1 : prev));
  }, [questions.length]);

  const goPrev = useCallback(() => {
    setIdx((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const reshuffle = useCallback(() => {
    setQuestions(buildQuestions(pool, allWords));
    setIdx(0);
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
  }, [idx, clearAllHighlights]);

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
      toast.success('أحسنت', { duration: Math.min(1500, config.correctHighlightDurationMs) });

      // Re-queue this question N more times (spec: correctWordReviewRepeatCount).
      const repeat = Math.max(0, config.correctWordReviewRepeatCount || 0);
      if (repeat > 0) {
        setQuestions((qs) => {
          const next = [...qs];
          const startInsert = idx + 1;
          const stamp = Date.now();
          for (let i = 0; i < repeat; i++) {
            const remaining = next.length - startInsert;
            const offset = Math.floor(Math.random() * Math.max(1, remaining + 1));
            next.splice(startInsert + offset, 0, { ...current, id: `${current.id}_rpt_${stamp}_${i}` });
          }
          return next;
        });
      }

      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      if (clearHighlightTimerRef.current) window.clearTimeout(clearHighlightTimerRef.current);

      const hold = Math.max(300, config.correctHighlightDurationMs);
      if (config.autoAdvance) {
        // Advance ONLY after the highlight hold duration completes.
        advanceTimerRef.current = window.setTimeout(() => {
          if (idx + 1 < questions.length + repeat) {
            goNext();
          }
        }, hold);
      } else {
        // Manual: keep highlight visible until user clicks "next" (which clears via useEffect).
      }
    } else {
      // Wrong answer.
      wordEl.classList.add('mq-wrong');
      window.setTimeout(() => wordEl.classList.remove('mq-wrong'), 900);
      setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      const newWrongCount = wrongCount + 1;
      setWrongCount(newWrongCount);
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
    current, solved, config, idx, questions.length, goNext, wrongCount, findTargetEl,
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
    <div className="flex h-full min-h-0 flex-col" dir="rtl">
      <style>{dynamicCss}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-arabic text-sm font-bold text-primary">المعنى ← الكلمة في المصحف</span>
          <span className="text-xs text-muted-foreground font-arabic">
            {idx + 1} / {questions.length} · ✓{score.correct} · ✗{score.wrong}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={reshuffle} title="إعادة الخلط" className="nav-button w-7 h-7 rounded-full">
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={goPrev} disabled={idx <= 0} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={goNext} disabled={idx >= questions.length - 1} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="nav-button w-7 h-7 rounded-full mr-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meaning prompt */}
      <div className="px-4 py-3 border-b border-border bg-card/40 shrink-0 text-center">
        <p className="font-arabic text-xs text-muted-foreground mb-1">
          ابحث عن الكلمة القرآنية التي يدل عليها هذا المعنى
        </p>
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
        <p className="font-arabic text-xs text-muted-foreground mt-1">
          {current.target.surahName} — صفحة {current.target.pageNumber}
        </p>
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
              disabled={idx >= questions.length - 1}
              className="font-arabic"
            >
              السؤال التالي
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground font-arabic">
              ينتقل تلقائياً بعد {(config.correctHighlightDurationMs / 1000).toFixed(1)} ث...
            </p>
          )}
          {idx >= questions.length - 1 && (
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
    </div>
  );
}
