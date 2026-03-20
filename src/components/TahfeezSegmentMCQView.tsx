import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatBismillah, shouldNoJustify, bindVerseNumbersSimple } from '@/utils/lineTokenUtils';

type SegmentMode = 'next-ayah-mcq' | 'next-waqf-mcq';

interface Segment {
  text: string;
  tokens: string[];
}

interface MCQQuestion {
  promptSegment: Segment;
  correctAnswer: Segment;
  options: { segment: Segment; isCorrect: boolean }[];
}

export interface SegmentMCQStats {
  correct: number;
  wrong: number;
  total: number;
  startTime: number;
  answers: { prompt: string; correct: boolean; chosen: string; expected: string }[];
}

interface TahfeezSegmentMCQViewProps {
  page: QuranPage;
  mode: SegmentMode;
  inline?: boolean;
  choicesAtBlank?: boolean;
  multiPage?: boolean;
  accumulatedStats?: SegmentMCQStats | null;
  onFinish?: () => void;
  onRestart?: () => void;
  onNextPage?: (stats: SegmentMCQStats) => void;
}

/** Render a blank span that preserves the original segment's width with a dotted line */
function SegmentBlankSpan({ text, children }: {
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <span style={{ display: 'inline', position: 'relative' }}>
      {/* Invisible original text to preserve width */}
      <span style={{ visibility: 'hidden' }} aria-hidden="true">{text}</span>
      {/* Dotted line through the middle */}
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{
          width: '100%',
          borderBottom: '2px dotted hsl(var(--foreground) / 0.5)',
        }} />
      </span>
      {/* Optional children (inline choices) rendered below */}
      {children}
    </span>
  );
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  const normalized = normalizeArabic(line);
  return normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله');
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseSegments(text: string, mode: SegmentMode, pageNumber: number): Segment[] {
  const lines = text.split('\n');
  const isFatihaPage = pageNumber === 1;
  const waqfRegex = /[ۖۗۘۙۚۛ]/;

  if (mode === 'next-ayah-mcq') {
    // Parse into ayah segments
    const segments: Segment[] = [];

    if (isFatihaPage) {
      for (const line of lines) {
        if (isSurahHeader(line)) continue;
        const tokens = line.split(/\s+/).filter(t => t.length > 0);
        if (tokens.length > 0) {
          segments.push({ text: tokens.join(' '), tokens });
        }
      }
    } else {
      let currentTokens: string[] = [];
      for (const line of lines) {
        if (isSurahHeader(line) || (!isFatihaPage && isBismillah(line))) continue;
        const tokens = line.split(/\s+/).filter(t => t.length > 0);
        for (const t of tokens) {
          const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
          const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(clean);
          if (isVerseNumber) {
            if (currentTokens.length > 0) {
              // Include the verse-end marker (e.g. ۝١٢٣) in the segment
              currentTokens.push(t);
              segments.push({ text: currentTokens.join(' '), tokens: [...currentTokens] });
              currentTokens = [];
            }
          } else {
            currentTokens.push(t);
          }
        }
      }
      if (currentTokens.length > 0) {
        segments.push({ text: currentTokens.join(' '), tokens: [...currentTokens] });
      }
    }
    return segments;

  } else {
    // next-waqf-mcq: parse into waqf segments
    const segments: Segment[] = [];
    let currentTokens: string[] = [];

    for (const line of lines) {
      if (isSurahHeader(line) || (!isFatihaPage && isBismillah(line))) continue;
      const tokens = line.split(/\s+/).filter(t => t.length > 0);
      for (const t of tokens) {
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(clean);
        if (isVerseNumber) {
          // Verse number is a delimiter too
          if (currentTokens.length > 0) {
            segments.push({ text: currentTokens.join(' '), tokens: [...currentTokens] });
            currentTokens = [];
          }
        } else if (waqfRegex.test(t)) {
          // Waqf sign: include it in current segment, then close segment
          currentTokens.push(t);
          segments.push({ text: currentTokens.join(' '), tokens: [...currentTokens] });
          currentTokens = [];
        } else {
          currentTokens.push(t);
        }
      }
    }
    if (currentTokens.length > 0) {
      segments.push({ text: currentTokens.join(' '), tokens: [...currentTokens] });
    }
    return segments;
  }
}

function generateQuestions(segments: Segment[], choiceCount: number = 3, randomOrder: boolean = false): MCQQuestion[] {
  const questions: MCQQuestion[] = [];
  if (segments.length < 2) return questions;

  for (let i = 0; i < segments.length - 1; i++) {
    const prompt = segments[i];
    const correct = segments[i + 1];

    // Generate distractors from other segments (not prompt, not correct, not adjacent)
    const candidates = segments.filter((s, idx) => idx !== i && idx !== i + 1);
    const distractors = shuffleArray(candidates).slice(0, choiceCount - 1);

    // If not enough distractors, pad
    while (distractors.length < choiceCount - 1) {
      distractors.push({ text: 'ـــ', tokens: ['ـــ'] });
    }

    const options = shuffleArray([
      { segment: correct, isCorrect: true },
      ...distractors.map(d => ({ segment: d, isCorrect: false })),
    ]);

    questions.push({ promptSegment: prompt, correctAnswer: correct, options });
  }
  return randomOrder ? shuffleArray(questions) : questions;
}

export function TahfeezSegmentMCQView({
  page,
  mode,
  inline = false,
  choicesAtBlank = false,
  multiPage = false,
  accumulatedStats = null,
  onFinish,
  onRestart,
  onNextPage,
}: TahfeezSegmentMCQViewProps) {
  const segments = useMemo(() => parseSegments(page.text, mode, page.pageNumber), [page.text, mode, page.pageNumber]);
  const { segmentMcqCorrectDelay, segmentMcqWrongDelay, segmentMcqRandomOrder, segmentMcqBlankDuration } = useTahfeezStore();
  const questions = useMemo(() => generateQuestions(segments, 3, segmentMcqRandomOrder), [segments, segmentMcqRandomOrder]);

  const [currentQ, setCurrentQ] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [choicesVisible, setChoicesVisible] = useState(segmentMcqBlankDuration <= 0);
  const baseStats: SegmentMCQStats = accumulatedStats || { correct: 0, wrong: 0, total: 0, startTime: Date.now(), answers: [] };
  const [stats, setStats] = useState<SegmentMCQStats>({
    ...baseStats,
    total: baseStats.total + questions.length,
  });
  const [showResults, setShowResults] = useState(false);

  // Blank duration: hide choices for N seconds when question changes
  useEffect(() => {
    if (segmentMcqBlankDuration <= 0) {
      setChoicesVisible(true);
      return;
    }
    setChoicesVisible(false);
    const t = setTimeout(() => setChoicesVisible(true), segmentMcqBlankDuration * 1000);
    return () => clearTimeout(t);
  }, [currentQ, segmentMcqBlankDuration]);

  const question = questions[currentQ];

  const handleChoice = useCallback((optIdx: number) => {
    if (feedback) return;
    const opt = question.options[optIdx];
    const isCorrect = opt.isCorrect;
    setSelectedIdx(optIdx);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    setStats(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      answers: [...prev.answers, {
        prompt: question.promptSegment.text.slice(0, 40),
        correct: isCorrect,
        chosen: opt.segment.text.slice(0, 40),
        expected: question.correctAnswer.text.slice(0, 40),
      }],
    }));

    // Compute updated stats for potential onNextPage call
    const updatedStats: SegmentMCQStats = {
      correct: stats.correct + (isCorrect ? 1 : 0),
      wrong: stats.wrong + (isCorrect ? 0 : 1),
      total: stats.total,
      startTime: stats.startTime,
      answers: [...stats.answers, {
        prompt: question.promptSegment.text.slice(0, 40),
        correct: isCorrect,
        chosen: opt.segment.text.slice(0, 40),
        expected: question.correctAnswer.text.slice(0, 40),
      }],
    };

    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(prev => prev + 1);
        setFeedback(null);
        setSelectedIdx(null);
      } else if (multiPage && onNextPage) {
        onNextPage(updatedStats);
      } else {
        setShowResults(true);
      }
    }, (isCorrect ? segmentMcqCorrectDelay : segmentMcqWrongDelay) * 1000);
  }, [feedback, question, currentQ, questions.length, segmentMcqCorrectDelay, segmentMcqWrongDelay, stats, multiPage, onNextPage, questions]);

  const modeLabel = mode === 'next-ayah-mcq' ? 'اختر الآية التالية' : 'اختر المقطع التالي';

  // Settings hooks — must be above early returns
  const { settings } = useSettingsStore();
  const pageBackgroundColor = (settings.colors as any).pageBackgroundColor || '';
  const pageFrameStyleVal = pageBackgroundColor ? { background: `hsl(${pageBackgroundColor})` } : undefined;

  const inlinePageContent = useMemo(() => {
    if (!inline || !questions[currentQ]) return null;
    const q = questions[currentQ];
    const promptIdx = segments.indexOf(q.promptSegment);
    const correctIdx = promptIdx + 1;
    const isFatihaPage = page.pageNumber === 1;
    const pageLines = page.text.split('\n');
    const elems: React.ReactNode[] = [];

    const allWords: { lineIdx: number; wordIdx: number }[] = [];
    for (let li = 0; li < pageLines.length; li++) {
      const line = pageLines[li];
      if (isSurahHeader(line)) continue;
      if (!isFatihaPage && isBismillah(line)) continue;
      const toks = line.split(/\s+/).filter(t => t.length > 0);
      for (let ti = 0; ti < toks.length; ti++) allWords.push({ lineIdx: li, wordIdx: ti });
    }

    const tokenSegMap = new Map<string, number>();
    let ptI = 0;
    for (let si = 0; si < segments.length; si++) {
      for (const _t of segments[si].tokens) {
        if (ptI < allWords.length) { const w = allWords[ptI]; tokenSegMap.set(`${w.lineIdx}_${w.wordIdx}`, si); ptI++; }
      }
    }

    for (let lineIdx = 0; lineIdx < pageLines.length; lineIdx++) {
      const line = pageLines[lineIdx];
      if (isSurahHeader(line)) { elems.push(<div key={`header-${lineIdx}`} className="surah-header"><span className="text-xl sm:text-2xl font-bold text-primary font-arabic">{line}</span></div>); continue; }
      if (isBismillah(line) && !isFatihaPage) { elems.push(<div key={`bismillah-${lineIdx}`} className="bismillah bismillah-compact font-arabic" style={{ display: 'block', textAlign: 'center', textAlignLast: 'center' }}>{formatBismillah(line)}</div>); continue; }

      const tokens = line.split(/(\s+)/);
      const lineEls: React.ReactNode[] = [];
      let wIdx = 0;
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (/^\s+$/.test(t)) { lineEls.push(<span key={`${lineIdx}-${ti}`}>{t}</span>); continue; }
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        if (/^[٠-٩0-9۰-۹]+$/.test(clean)) { lineEls.push(<span key={`${lineIdx}-${ti}`} className="verse-number">{t}</span>); continue; }
        const segI = tokenSegMap.get(`${lineIdx}_${wIdx}`); wIdx++;
        if (segI === promptIdx) lineEls.push(<span key={`${lineIdx}-${ti}`} className="bg-primary/20 rounded px-0.5">{t}</span>);
        else if (segI === correctIdx) {
          if (feedback === 'correct') lineEls.push(<span key={`${lineIdx}-${ti}`} className="bg-green-500/20 rounded px-0.5">{t}</span>);
          else if (feedback === 'wrong') lineEls.push(<span key={`${lineIdx}-${ti}`} className="bg-red-500/20 rounded px-0.5">{t}</span>);
          else lineEls.push(<SegmentBlankSpan key={`${lineIdx}-${ti}`} text={t} />);
        } else lineEls.push(<span key={`${lineIdx}-${ti}`}>{t}</span>);
      }
      const processed = bindVerseNumbersSimple(lineEls, lineIdx);
      elems.push(<span key={`line-${lineIdx}`}>{processed}{' '}</span>);
    }
    return <div className="quran-page">{elems}</div>;
  }, [inline, segments, questions, currentQ, feedback, page.text, page.pageNumber]);

  // Results screen
  if (showResults) {
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="page-frame p-5 space-y-4 animate-fade-in" dir="rtl">
        <div className="flex items-center justify-center gap-2"><Trophy className="w-6 h-6 text-primary" /><h3 className="font-arabic font-bold text-lg text-foreground">نتائج الاختبار</h3></div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20"><div className="text-2xl font-bold text-green-600">{stats.correct}</div><div className="text-xs font-arabic text-muted-foreground">صحيح</div></div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20"><div className="text-2xl font-bold text-red-500">{stats.wrong}</div><div className="text-xs font-arabic text-muted-foreground">خطأ</div></div>
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20"><div className="text-2xl font-bold text-primary">{percentage}%</div><div className="text-xs font-arabic text-muted-foreground">النسبة</div></div>
        </div>
        <div className="text-center text-sm font-arabic text-muted-foreground">الزمن: {minutes > 0 ? `${minutes} دقيقة و ` : ''}{seconds} ثانية</div>
        {stats.answers.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {stats.answers.map((a, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-arabic ${a.correct ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                <div className="flex items-center gap-2">{a.correct ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}<span className="truncate max-w-[200px]">{a.prompt}...</span></div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {onRestart && <Button onClick={() => { setCurrentQ(0); setFeedback(null); setSelectedIdx(null); setShowResults(false); setStats({ correct: 0, wrong: 0, total: questions.length, startTime: Date.now(), answers: [] }); onRestart(); }} className="flex-1 font-arabic" variant="outline"><RotateCcw className="w-4 h-4 ml-2" />إعادة الاختبار</Button>}
          {onFinish && <Button onClick={onFinish} className="flex-1 font-arabic" variant="outline"><ArrowLeft className="w-4 h-4 ml-2" />رجوع</Button>}
        </div>
      </div>
    );
  }

  if (!question || questions.length === 0) {
    return (
      <div className="page-frame p-5 text-center" dir="rtl">
        <p className="text-sm font-arabic text-muted-foreground">لا توجد أسئلة كافية في هذه الصفحة (يلزم مقطعين على الأقل)</p>
        {onFinish && <Button onClick={onFinish} className="mt-3 font-arabic" variant="outline" size="sm">رجوع</Button>}
      </div>
    );
  }

  // Render MCQ options (shared between both modes)
  const optionsUI = (
    <div className="flex flex-col gap-2">
      {question.options.map((opt, idx) => {
        let extraClass = '';
        let variant: 'outline' | 'default' | 'destructive' = 'outline';

        if (feedback) {
          if (opt.isCorrect) {
            variant = 'default';
            extraClass = 'bg-green-600 hover:bg-green-600 text-white border-green-600';
          } else if (idx === selectedIdx && !opt.isCorrect) {
            variant = 'destructive';
          }
        }

        return (
          <Button
            key={idx}
            variant={variant}
            className={`w-full font-arabic text-base py-5 leading-relaxed whitespace-normal h-auto min-h-[2.5rem] ${extraClass}`}
            onClick={() => handleChoice(idx)}
            disabled={!!feedback}
            style={{ fontFamily: "'KFGQPC HAFS Uthmanic Script', serif" }}
          >
            {opt.segment.text}
          </Button>
        );
      })}
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-3 animate-fade-in" dir="rtl">
        {/* Progress bar */}
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-arabic text-muted-foreground">
            {modeLabel} ({currentQ + 1} / {questions.length})
          </span>
          <div className="flex items-center gap-3 text-xs font-arabic">
            <span className="text-green-600">✓ {stats.correct}</span>
            <span className="text-red-500">✗ {stats.wrong}</span>
          </div>
        </div>
        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
        </div>

        {/* Quran page with highlighted prompt — uses same Mushaf layout as other tabs */}
        <div className="page-frame p-4 sm:p-6" style={pageFrameStyle} dir="rtl">
          <div className="flex justify-center mb-5">
            <span className="bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-arabic shadow-sm">
              صفحة {page.pageNumber}
            </span>
          </div>
          <div className="min-h-[350px] sm:min-h-[450px]">
            {inlinePageContent}
          </div>
        </div>

        {/* MCQ choices below the page (hidden when choicesAtBlank is on) */}
        {!choicesAtBlank && choicesVisible && (
          <div className="page-frame p-3">
            <p className="text-xs font-arabic text-muted-foreground text-center mb-2">
              {mode === 'next-ayah-mcq' ? 'اختر الآية التالية:' : 'اختر المقطع التالي:'}
            </p>
            {optionsUI}
          </div>
        )}
        {!choicesVisible && !feedback && (
          <div className="page-frame p-3 text-center">
            <p className="text-sm font-arabic text-muted-foreground animate-pulse">تذكّر ما يأتي بعدها...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Progress */}
      <div className="page-frame p-3 flex items-center justify-between">
        <span className="text-sm font-arabic text-muted-foreground">
          {modeLabel} ({currentQ + 1} / {questions.length})
        </span>
        <div className="flex items-center gap-3 text-xs font-arabic">
          <span className="text-green-600">✓ {stats.correct}</span>
          <span className="text-red-500">✗ {stats.wrong}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-linear"
          style={{ width: `${((currentQ) / questions.length) * 100}%` }}
        />
      </div>

      {/* Prompt: the current segment */}
      <div className="page-frame p-4 space-y-2">
        <p className="text-xs font-arabic text-muted-foreground text-center">
          {mode === 'next-ayah-mcq' ? 'ما الآية التي تأتي بعد:' : 'ما الذي يأتي بعد:'}
        </p>
        <p className="text-lg font-arabic text-foreground text-center leading-loose" style={{ fontFamily: "'KFGQPC HAFS Uthmanic Script', serif" }}>
          {question.promptSegment.text}
        </p>
      </div>

      {/* MCQ Options */}
      {choicesVisible ? (
        <div className="page-frame p-4 space-y-3">
          {optionsUI}
        </div>
      ) : (
        <div className="page-frame p-4 text-center">
          <p className="text-sm font-arabic text-muted-foreground animate-pulse">تذكّر ما يأتي بعدها...</p>
        </div>
      )}
    </div>
  );
}
