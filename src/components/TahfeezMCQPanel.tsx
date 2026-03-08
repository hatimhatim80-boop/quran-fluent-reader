import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { normalizeArabic } from '@/utils/quranParser';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface MCQOption {
  text: string;
  key: string;
  isCorrect: boolean;
}

export interface MCQStats {
  correct: number;
  wrong: number;
  total: number;
  startTime: number;
  answers: { key: string; word: string; correct: boolean; chosen: string }[];
}

interface TahfeezMCQPanelProps {
  activeKey: string | null;
  wordTextsMap: Record<string, string>;
  allWordTexts: string[]; // All word texts on the page for generating distractors
  onAnswer: (key: string, correct: boolean) => void;
  stats: MCQStats;
  showResults: boolean;
  onRestart?: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDistractors(correctText: string, allTexts: string[], count: number): string[] {
  const correctNorm = normalizeArabic(correctText, 'aggressive');
  // Filter out the correct answer and very similar words
  const candidates = allTexts.filter(t => {
    const norm = normalizeArabic(t, 'aggressive');
    return norm !== correctNorm && t !== correctText && norm.length > 0;
  });
  // Remove duplicates
  const unique = [...new Set(candidates)];
  const shuffled = shuffleArray(unique);
  return shuffled.slice(0, count);
}

export function TahfeezMCQPanel({
  activeKey,
  wordTextsMap,
  allWordTexts,
  onAnswer,
  stats,
  showResults,
  onRestart,
}: TahfeezMCQPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Reset when active key changes
  useEffect(() => {
    setSelectedKey(null);
    setFeedback(null);
  }, [activeKey]);

  const correctText = activeKey ? wordTextsMap[activeKey] || '' : '';

  const options: MCQOption[] = useMemo(() => {
    if (!activeKey || !correctText) return [];
    const distractors = generateDistractors(correctText, allWordTexts, 2);
    // If not enough distractors, pad with generic placeholders
    while (distractors.length < 2) {
      distractors.push('ـــ');
    }
    const opts: MCQOption[] = [
      { text: correctText, key: 'correct', isCorrect: true },
      ...distractors.map((d, i) => ({ text: d, key: `distractor_${i}`, isCorrect: false })),
    ];
    return shuffleArray(opts);
  }, [activeKey, correctText, allWordTexts]);

  const handleChoice = useCallback((opt: MCQOption) => {
    if (feedback) return; // Already answered
    setSelectedKey(opt.key);
    setFeedback(opt.isCorrect ? 'correct' : 'wrong');
    // Short delay then advance
    setTimeout(() => {
      if (activeKey) {
        onAnswer(activeKey, opt.isCorrect);
      }
    }, opt.isCorrect ? 400 : 800);
  }, [activeKey, feedback, onAnswer]);

  // Results screen
  if (showResults) {
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    
    return (
      <div className="page-frame p-5 space-y-4 animate-fade-in" dir="rtl">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h3 className="font-arabic font-bold text-lg text-foreground">نتائج الجلسة</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
            <div className="text-xs font-arabic text-muted-foreground">صحيح</div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="text-2xl font-bold text-red-500">{stats.wrong}</div>
            <div className="text-xs font-arabic text-muted-foreground">خطأ</div>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <div className="text-2xl font-bold text-primary">{percentage}%</div>
            <div className="text-xs font-arabic text-muted-foreground">النسبة</div>
          </div>
        </div>

        <div className="text-center text-sm font-arabic text-muted-foreground">
          الزمن: {minutes > 0 ? `${minutes} دقيقة و ` : ''}{seconds} ثانية
        </div>

        {/* Detailed answers */}
        {stats.answers.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {stats.answers.map((a, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-arabic ${a.correct ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                <div className="flex items-center gap-2">
                  {a.correct ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  <span>{a.word}</span>
                </div>
                {!a.correct && <span className="text-xs text-muted-foreground">اخترت: {a.chosen}</span>}
              </div>
            ))}
          </div>
        )}

        {onRestart && (
          <Button onClick={onRestart} className="w-full font-arabic" variant="outline">
            <RotateCcw className="w-4 h-4 ml-2" />
            إعادة الاختبار
          </Button>
        )}
      </div>
    );
  }

  if (!activeKey || options.length === 0) return null;

  return (
    <div className="page-frame p-4 space-y-3 animate-fade-in" dir="rtl">
      <div className="text-center text-sm font-arabic text-muted-foreground">
        اختر الكلمة الصحيحة ({stats.correct + stats.wrong + 1} / {stats.total || '...'})
      </div>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          let variant: 'outline' | 'default' | 'destructive' = 'outline';
          let extraClass = '';
          
          if (feedback) {
            if (opt.isCorrect) {
              variant = 'default';
              extraClass = 'bg-green-600 hover:bg-green-600 text-white border-green-600';
            } else if (opt.key === selectedKey && !opt.isCorrect) {
              variant = 'destructive';
            }
          }
          
          return (
            <Button
              key={opt.key}
              variant={variant}
              className={`w-full font-arabic text-lg py-6 ${extraClass}`}
              onClick={() => handleChoice(opt)}
              disabled={!!feedback}
            >
              {opt.text}
            </Button>
          );
        })}
      </div>
      
      {/* Live stats bar */}
      <div className="flex items-center justify-center gap-4 text-xs font-arabic text-muted-foreground">
        <span className="text-green-600">✓ {stats.correct}</span>
        <span className="text-red-500">✗ {stats.wrong}</span>
      </div>
    </div>
  );
}
