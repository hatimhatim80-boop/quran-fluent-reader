import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GhareebWord } from '@/types/quran';
import { canonicalize, canonicalFormsCompatible } from '@/utils/canonicalMatch';
import { ChevronLeft, ChevronRight, RotateCcw, X, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Question type identifier (per spec): meaning_to_mushaf_word
 */
export const QUIZ_TYPE_MEANING_TO_MUSHAF_WORD = 'meaning_to_mushaf_word' as const;

interface GhareebMeaningQuizProps {
  /** Pool of Ghareeb words to draw questions from (current page or all). */
  pool: GhareebWord[];
  /** Source-of-truth list of all Ghareeb words (used to look up duplicates). */
  allWords: GhareebWord[];
  onClose: () => void;
  onNavigateToPage: (page: number) => void;
  /** Render a Mushaf page (no highlight passed by us — the target must be hidden). */
  renderPage: (page: number) => React.ReactNode;
}

interface QuizQuestion {
  id: string;
  target: GhareebWord;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(pool: GhareebWord[]): QuizQuestion[] {
  // De-duplicate by uniqueKey
  const seen = new Set<string>();
  const list: GhareebWord[] = [];
  for (const w of pool) {
    if (!w.meaning || !w.wordText) continue;
    if (seen.has(w.uniqueKey)) continue;
    seen.add(w.uniqueKey);
    list.push(w);
  }
  return shuffle(list).map((target, idx) => ({
    id: `${target.uniqueKey}_${idx}`,
    target,
  }));
}

export function GhareebMeaningQuiz({
  pool,
  allWords,
  onClose,
  onNavigateToPage,
  renderPage,
}: GhareebMeaningQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildQuestions(pool));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [solved, setSolved] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const current = questions[idx];

  // Re-build questions when the pool changes (e.g. user moved page).
  useEffect(() => {
    setQuestions(buildQuestions(pool));
    setIdx(0);
    setScore({ correct: 0, wrong: 0 });
    setSolved(false);
  }, [pool]);

  // Navigate to the target's page when question changes.
  useEffect(() => {
    if (current) onNavigateToPage(current.target.pageNumber);
    setSolved(false);
  }, [current, onNavigateToPage]);

  // Cleanup any pending advance timer on unmount.
  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const goNext = useCallback(() => {
    setIdx((prev) => (prev + 1 < questions.length ? prev + 1 : prev));
  }, [questions.length]);

  const goPrev = useCallback(() => {
    setIdx((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const reshuffle = useCallback(() => {
    setQuestions(buildQuestions(pool));
    setIdx(0);
    setScore({ correct: 0, wrong: 0 });
    setSolved(false);
  }, [pool]);

  const flashElement = useCallback((el: HTMLElement, kind: 'correct' | 'wrong') => {
    const className = kind === 'correct' ? 'mq-correct' : 'mq-wrong';
    el.classList.add(className);
    if (kind === 'wrong') {
      window.setTimeout(() => el.classList.remove(className), 900);
    }
  }, []);

  // Event delegation for clicks on Quranic words inside the rendered page.
  const handleSurfaceClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!current || solved) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const wordEl = target.closest<HTMLElement>('.quran-word');
    if (!wordEl) return;
    // Exclude verse numbers and waqf/markers.
    if (wordEl.classList.contains('verse-number')) return;

    // Stop popovers etc.
    e.preventDefault();
    e.stopPropagation();

    const clickedRaw = (wordEl.textContent || '').trim();
    if (!clickedRaw) return;

    const targetWord = current.target.wordText;
    const isMatch =
      canonicalize(clickedRaw) === canonicalize(targetWord) ||
      canonicalFormsCompatible(clickedRaw, targetWord);

    if (isMatch) {
      flashElement(wordEl, 'correct');
      setSolved(true);
      setScore((s) => ({ ...s, correct: s.correct + 1 }));
      toast.success('أحسنت', { duration: 1200 });
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => {
        if (idx + 1 < questions.length) {
          goNext();
        }
      }, 1400);
    } else {
      flashElement(wordEl, 'wrong');
      setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      toast.error('حاول مرة أخرى', { duration: 1000 });
    }
  }, [current, solved, flashElement, idx, questions.length, goNext]);

  if (questions.length === 0) {
    return (
      <div className="p-6 text-center font-arabic" dir="rtl">
        <p className="text-muted-foreground mb-4">لا توجد كلمات متاحة لهذا التدريب.</p>
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex h-full min-h-0 flex-col" dir="rtl">
      {/* Inline CSS for flash feedback — scoped via class names */}
      <style>{`
        .mq-correct { background: hsl(142 70% 45% / 0.35) !important; color: hsl(142 60% 20%) !important; border-radius: 6px; transition: background-color 200ms ease; box-shadow: 0 0 0 2px hsl(142 70% 45% / 0.6); }
        .mq-wrong   { background: hsl(0 75% 55% / 0.35) !important; color: hsl(0 60% 25%) !important; border-radius: 6px; transition: background-color 200ms ease; box-shadow: 0 0 0 2px hsl(0 75% 55% / 0.6); animation: mq-shake 0.35s ease-in-out; }
        @keyframes mq-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
      `}</style>

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
        <p className="font-arabic text-xs text-muted-foreground mt-1">
          {current.target.surahName} — صفحة {current.target.pageNumber}
        </p>
      </div>

      {/* Mushaf page surface (delegated clicks) */}
      <div
        ref={surfaceRef}
        className="flex-1 min-h-0 overflow-auto p-2"
        data-meaning-quiz-surface="true"
        onClickCapture={handleSurfaceClick}
      >
        {renderPage(current.target.pageNumber)}
      </div>

      {/* Footer hint */}
      {solved && (
        <div className="border-t border-border bg-card/60 px-4 py-2 text-center shrink-0">
          <Button size="sm" variant="default" onClick={goNext} disabled={idx >= questions.length - 1} className="font-arabic">
            السؤال التالي
          </Button>
        </div>
      )}
    </div>
  );
}
