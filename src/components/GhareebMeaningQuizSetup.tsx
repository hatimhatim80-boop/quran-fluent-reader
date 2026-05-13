import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Eye, X, ArrowRight, BookOpen, Brain } from 'lucide-react';
import { ReviewSessionSetup } from './ReviewSessionSetup';
import { SRSCard, useSRSStore } from '@/stores/srsStore';
import { canonicalize, canonicalFormsCompatible } from '@/utils/canonicalMatch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GhareebWord } from '@/types/quran';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { useSessionsStore } from '@/stores/sessionsStore';
import { toast } from 'sonner';
import {
  useAllGhareebSources,
  filterWordsByMeaningSource,
  MEANING_SOURCE_LABELS,
  type MeaningSource,
} from '@/hooks/useAllGhareebSources';

export type GhareebHighlightStyle = 'textColor' | 'background' | 'border' | 'none';

export interface MeaningQuizConfig {
  /** Source(s) of ghareeb meanings used to build questions. */
  meaningSource: MeaningSource;
  /** Show the source-book name under the meaning prompt. */
  showMeaningSourceName: boolean;
  autoAdvance: boolean;
  correctHighlightDurationMs: number; // 500-10000
  correctHighlightColor: string;       // HSL token like "142 70% 45%"
  hintEnabled: boolean;
  hintAfterWrong: number;              // 1..5
  questionLimit: number | null;        // null = all
  /** Whether to visually mark all Ghareeb words on the page during the quiz. */
  ghareebWordsHighlightEnabled: boolean;
  /** How to highlight Ghareeb words (text color / background / border / none). */
  ghareebWordsHighlightStyle: GhareebHighlightStyle;
  /** Color used to highlight all Ghareeb words BEFORE answering. Must differ from correct color. */
  ghareebWordsHighlightColor: string;
  /** How many extra times a correctly answered word is re-queued for additional review. */
  correctWordReviewRepeatCount: number;
  /** Show "صفحة N" indicator in the quiz UI. */
  showPageNumber: boolean;
  /** Show the prompt sentence above the meaning. */
  showPromptText: boolean;
  /** After a correct answer, allow clicking anywhere (empty area) to advance. */
  advanceOnEmptyClick: boolean;
  /** Show the surah name in the prompt header. */
  showSurahName: boolean;
  /** Question selection strategy. */
  randomMode: 'fair' | 'smart' | 'mushaf' | 'leastShown';
  /** (Smart-Review meaning mode only) After a correct answer, also reschedule the
   *  word as an SRS card using the existing SM-2 intervals (immediate, 1m, 1h, …). */
  rescheduleCorrectAsSRS?: boolean;
}

const DEFAULT_CONFIG: MeaningQuizConfig = {
  meaningSource: 'muyassar',
  showMeaningSourceName: false,
  autoAdvance: true,
  correctHighlightDurationMs: 2000,
  correctHighlightColor: '142 70% 45%',
  hintEnabled: true,
  hintAfterWrong: 2,
  questionLimit: 20,
  ghareebWordsHighlightEnabled: false,
  ghareebWordsHighlightStyle: 'background',
  ghareebWordsHighlightColor: '42 90% 50%',
  correctWordReviewRepeatCount: 0,
  showPageNumber: true,
  showPromptText: true,
  advanceOnEmptyClick: true,
  showSurahName: true,
  randomMode: 'smart',
  rescheduleCorrectAsSRS: false,
};

export const STORAGE_KEY = 'ghareeb_meaning_quiz_settings';

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'أخضر', value: '142 70% 45%' },
  { label: 'ذهبي', value: '42 90% 50%' },
  { label: 'أزرق', value: '210 80% 50%' },
  { label: 'بنفسجي', value: '270 70% 55%' },
  { label: 'وردي', value: '330 75% 55%' },
];

const DURATION_PRESETS = [1000, 2000, 3000, 5000];
const QUESTION_PRESETS = [5, 10, 20, 50, 0]; // 0 = unlimited (all)

function loadConfig(): MeaningQuizConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg: MeaningQuizConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}

interface GhareebMeaningQuizSetupProps {
  /** Legacy: pool of words from the user's globally configured source.
   *  Kept for backward-compat but no longer used to build the pool — the
   *  Meaning-Quiz now loads both sources independently so the user can pick
   *  one per quiz. */
  allWords: GhareebWord[];
  currentPage: number;
  onClose: () => void;
  /** Start the quiz with the resolved pool & config. */
  onStart: (params: {
    pool: GhareebWord[];
    /** Source-of-truth list used for multi-position acceptance — already
     *  filtered to the chosen meaning source. */
    quizAllWords: GhareebWord[];
    config: MeaningQuizConfig;
    sessionId?: string;
    scopeLabel: string;
    pages: number[] | null;
    isPreview?: boolean;
  }) => void;
}

export function GhareebMeaningQuizSetup({
  allWords: _legacyAllWords,
  currentPage,
  onClose,
  onStart,
}: GhareebMeaningQuizSetupProps) {
  const sessionsStore = useSessionsStore();
  const [config, setConfig] = useState<MeaningQuizConfig>(() => loadConfig());
  const [scope, setScope] = useState<SRSScope>({ type: 'current-page', from: currentPage, to: currentPage });
  const [sessionName, setSessionName] = useState('');
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const { addCard, hasCard } = useSRSStore();

  // Load BOTH source books independently of the user's global preference so the
  // Meaning-Quiz source selector works on its own.
  const { allWords: bothSourcesWords, isLoading: sourcesLoading } = useAllGhareebSources();

  useEffect(() => { saveConfig(config); }, [config]);

  // Words filtered by the chosen meaning source.
  const sourceFilteredAll = useMemo(
    () => filterWordsByMeaningSource(bothSourcesWords, config.meaningSource),
    [bothSourcesWords, config.meaningSource],
  );

  const pages = useMemo(
    () => scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from }),
    [scope, currentPage],
  );

  const fullPool = useMemo(() => {
    if (!pages || pages.length === 0) return sourceFilteredAll;
    const set = new Set(pages);
    return sourceFilteredAll.filter(w => set.has(w.pageNumber));
  }, [pages, sourceFilteredAll]);

  const scopeLabel = useMemo(() => {
    if (scope.type === 'current-page') return `صفحة ${currentPage}`;
    if (scope.type === 'page-range') return `ص${scope.from}-${scope.to}`;
    if (scope.type === 'surah') return `سور ${scope.from}-${scope.to}`;
    if (scope.type === 'juz') return `جزء ${scope.from}-${scope.to}`;
    if (scope.type === 'hizb') return `حزب ${scope.from}-${scope.to}`;
    return 'الكل';
  }, [scope, currentPage]);

  const limitedPool = useMemo(() => {
    if (!config.questionLimit || config.questionLimit <= 0) return fullPool;
    return fullPool.slice(0, config.questionLimit);
  }, [fullPool, config.questionLimit]);

  const setCfg = <K extends keyof MeaningQuizConfig>(key: K, value: MeaningQuizConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const handleStart = (saveAsSession: boolean) => {
    if (!fullPool.length) {
      toast.info('لا توجد كلمات غريب من هذا المصدر في النطاق المختار');
      return;
    }
    let sessionId: string | undefined;
    if (saveAsSession) {
      const firstPage = limitedPool[0]?.pageNumber || currentPage;
      const lastPage = limitedPool.reduce((max, w) => Math.max(max, w.pageNumber), firstPage);
      sessionId = sessionsStore.createSession(
        sessionName.trim() || `التدريب على المعنى (${scopeLabel})`,
        'ghareeb-meaning-quiz',
        firstPage,
        lastPage,
      );
      sessionsStore.updateSession(sessionId, {
        quizSettings: {
          scopeLabel,
          pages: pages || [],
          wordCount: limitedPool.length,
          config,
        },
      });
      sessionsStore.setActiveSession(sessionId);
      toast.success('تم إنشاء الجلسة وحفظها');
    }
    onStart({ pool: limitedPool, quizAllWords: sourceFilteredAll, config, sessionId, scopeLabel, pages: pages, isPreview: false });
  };

  const handlePreview = () => {
    if (!fullPool.length) {
      toast.info('لا توجد كلمات غريب من هذا المصدر في النطاق المختار');
      return;
    }
    // Preview: single random question with same config
    const idx = Math.floor(Math.random() * fullPool.length);
    const previewPool = [fullPool[idx]];
    onStart({ pool: previewPool, quizAllWords: sourceFilteredAll, config, scopeLabel: scopeLabel + ' • معاينة', pages, isPreview: true });
  };

  // ── Smart Review handlers ────────────────────────────────────────────────
  const handleAutoGenerateForSmart = (pgs: number[]) => {
    const pageSet = new Set(pgs);
    const words = sourceFilteredAll.filter(w => pageSet.has(w.pageNumber));
    let added = 0;
    words.forEach((w) => {
      const id = `ghareeb_${w.uniqueKey}`;
      if (!hasCard(id)) {
        addCard({
          id,
          type: 'ghareeb',
          page: w.pageNumber,
          contentKey: w.uniqueKey,
          label: `${w.wordText} — ${w.meaning}`,
          meta: {
            wordText: w.wordText,
            meaning: w.meaning,
            surahName: w.surahName,
            surahNumber: w.surahNumber,
            verseNumber: w.verseNumber,
          },
        });
        added += 1;
      }
    });
    return added;
  };

  const handleStartSmart = (selectedCards: SRSCard[], sid: string, name: string) => {
    if (sourcesLoading) {
      toast.info('…جاري تحميل مصادر الغريب');
      return;
    }
    const byKey = new Map(sourceFilteredAll.map(w => [w.uniqueKey, w]));
    const pool: GhareebWord[] = [];
    const seen = new Set<string>();
    for (const c of selectedCards) {
      const direct = byKey.get(c.contentKey);
      if (direct && !seen.has(direct.uniqueKey)) {
        pool.push(direct); seen.add(direct.uniqueKey); continue;
      }
      const sn = Number(c.meta?.surahNumber || 0);
      const vn = Number(c.meta?.verseNumber || 0);
      const wt = canonicalize(String(c.meta?.wordText || ''));
      const cand = sourceFilteredAll.find(w =>
        w.pageNumber === c.page &&
        (!sn || w.surahNumber === sn) &&
        (!vn || w.verseNumber === vn) &&
        (canonicalize(w.wordText) === wt || canonicalFormsCompatible(w.wordText, String(c.meta?.wordText || '')))
      );
      if (cand && !seen.has(cand.uniqueKey)) {
        pool.push(cand); seen.add(cand.uniqueKey);
      }
    }
    if (!pool.length) {
      toast.info('تعذر بناء كلمات التدريب من البطاقات المختارة (جرّب مصدر معاني آخر)');
      return;
    }
    const firstPage = pool[0].pageNumber;
    const lastPage = pool.reduce((m, w) => Math.max(m, w.pageNumber), firstPage);
    const generalId = sessionsStore.createSession(
      name || `المعنى — مراجعة ذكية`,
      'ghareeb-meaning-quiz',
      firstPage,
      lastPage,
    );
    sessionsStore.updateSession(generalId, {
      quizSettings: {
        scopeLabel: 'مراجعة ذكية',
        pages: Array.from(new Set(pool.map(w => w.pageNumber))),
        wordCount: pool.length,
        config,
        smartReview: true,
        reviewSessionId: sid,
      },
    });
    sessionsStore.setActiveSession(generalId);
    onStart({
      pool,
      quizAllWords: sourceFilteredAll,
      config,
      sessionId: generalId,
      scopeLabel: 'مراجعة ذكية',
      pages: Array.from(new Set(pool.map(w => w.pageNumber))),
      isPreview: false,
    });
  };

  if (smartMode) {
    return (
      <div className="flex h-full min-h-0 flex-col font-arabic" dir="rtl">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">تدريب المعنى — مراجعة ذكية</h2>
              <p className="text-[10px] text-muted-foreground">اختر البطاقات (مستحقة/جديدة/معلّمة…) لبناء التدريب</p>
            </div>
          </div>
          <button onClick={() => setSmartMode(false)} className="nav-button h-8 px-2 rounded-md text-xs flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <ReviewSessionSetup
            portal="ghareeb"
            currentPage={currentPage}
            onStartSession={handleStartSmart}
            cardTypeFilter="ghareeb"
            onAutoGenerateCards={handleAutoGenerateForSmart}
            allowInlineResume={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-arabic" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">التدريب على المعنى</h2>
            <p className="text-[10px] text-muted-foreground">يعرض المعنى ثم تختار الكلمة من المصحف</p>
          </div>
        </div>
        <button onClick={onClose} className="nav-button w-8 h-8 rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {/* Meaning source */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <Label className="text-xs font-bold">مصدر معاني الغريب</Label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['muyassar', 'duroobi', 'both'] as const).map((s) => {
              const active = config.meaningSource === s;
              return (
                <button
                  key={s}
                  onClick={() => setCfg('meaningSource', s)}
                  className={`h-10 rounded-md text-[11px] leading-tight px-1 transition-colors ${
                    active ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted hover:bg-accent text-foreground'
                  }`}
                >
                  {MEANING_SOURCE_LABELS[s]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <Label className="text-[11px] text-muted-foreground">إظهار اسم المصدر مع المعنى</Label>
            <Switch
              checked={config.showMeaningSourceName}
              onCheckedChange={(v) => setCfg('showMeaningSourceName', v)}
            />
          </div>
          {sourcesLoading && (
            <p className="text-[10px] text-muted-foreground">…جاري تحميل المصادر</p>
          )}
        </section>

        {/* Scope */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">النطاق (سورة / صفحة / حزب / جزء)</Label>
          <SRSScopeSelector
            scope={scope}
            onChange={setScope}
            currentPage={currentPage}
            showAllDue={false}
          />
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <span className="text-muted-foreground">الكلمات في النطاق</span>
            <span className="font-bold text-primary">{fullPool.length}</span>
          </div>
          {!sourcesLoading && fullPool.length === 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-[11px] text-destructive space-y-1">
              <p className="font-bold">لا توجد كلمات غريب من هذا المصدر في النطاق المختار.</p>
              <ul className="list-disc pr-4 space-y-0.5 text-foreground/80">
                <li>جرّب اختيار مصدر آخر.</li>
                <li>أو وسّع النطاق (سورة / حزب / جزء).</li>
                <li>أو اختر "كلا المصدرين".</li>
              </ul>
            </div>
          )}
        </section>

        {/* Question count */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">عدد الأسئلة</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {QUESTION_PRESETS.map((n) => {
              const active = (n === 0 && !config.questionLimit) || config.questionLimit === n;
              return (
                <button
                  key={n}
                  onClick={() => setCfg('questionLimit', n === 0 ? null : n)}
                  className={`h-9 rounded-md text-xs transition-colors ${
                    active ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted hover:bg-accent text-foreground'
                  }`}
                >
                  {n === 0 ? 'غير محدود' : n}
                </button>
              );
            })}
          </div>
          {(!config.questionLimit || config.questionLimit <= 0) && (
            <p className="text-[10px] text-muted-foreground">
              في وضع "غير محدود" تستمر الجلسة بإعادة خلط الأسئلة بلا توقف؛ استخدم زر الإغلاق لإنهائها يدويًا.
            </p>
          )}
          <Input
            type="number"
            min={1}
            max={500}
            value={config.questionLimit ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              setCfg('questionLimit', v === '' ? null : Math.max(1, Math.min(500, Number(v))));
            }}
            placeholder="مخصص..."
            className="h-9 text-sm"
            dir="ltr"
          />
        </section>

        {/* Auto advance */}
        <section className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs font-bold">الانتقال التلقائي للسؤال التالي</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">ينتقل بعد انتهاء مدة بقاء التلوين</p>
          </div>
          <Switch
            checked={config.autoAdvance}
            onCheckedChange={(v) => setCfg('autoAdvance', v)}
          />
        </section>

        {/* Highlight duration */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">مدة بقاء تلوين الكلمة الصحيحة</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {DURATION_PRESETS.map((ms) => (
              <button
                key={ms}
                onClick={() => { setCfg('correctHighlightDurationMs', ms); setCustomDurationOpen(false); }}
                className={`h-9 rounded-md text-xs transition-colors ${
                  config.correctHighlightDurationMs === ms && !customDurationOpen
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                {ms / 1000} ث
              </button>
            ))}
          </div>
          <button
            onClick={() => setCustomDurationOpen((v) => !v)}
            className="text-[11px] text-primary hover:underline"
          >
            {customDurationOpen ? 'إخفاء الإدخال اليدوي' : 'إدخال يدوي بالمللي ثانية'}
          </button>
          {customDurationOpen && (
            <Input
              type="number"
              min={300}
              max={20000}
              step={100}
              value={config.correctHighlightDurationMs}
              onChange={(e) => setCfg('correctHighlightDurationMs', Math.max(300, Math.min(20000, Number(e.target.value) || 2000)))}
              className="h-9 text-sm"
              dir="ltr"
            />
          )}
        </section>

        {/* Highlight color */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">لون تمييز الكلمة الصحيحة</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {COLOR_PRESETS.map((c) => {
              const active = c.value === config.correctHighlightColor;
              return (
                <button
                  key={c.value}
                  onClick={() => setCfg('correctHighlightColor', c.value)}
                  className={`h-10 rounded-md text-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                    active ? 'border-foreground' : 'border-transparent hover:border-border'
                  }`}
                  style={{ backgroundColor: `hsl(${c.value} / 0.25)`, color: `hsl(${c.value})` }}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${c.value})` }} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">يجب أن يختلف هذا اللون عن لون تمييز كلمات الغريب لتفادي الالتباس.</p>
        </section>

        {/* Ghareeb words highlight on page */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-xs font-bold">تمييز كلمات الغريب في الصفحة</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">يميّز جميع كلمات الغريب في النطاق دون كشف الجواب</p>
            </div>
            <Switch
              checked={config.ghareebWordsHighlightEnabled}
              onCheckedChange={(v) => setCfg('ghareebWordsHighlightEnabled', v)}
            />
          </div>
          {config.ghareebWordsHighlightEnabled && (
            <>
              <div>
                <Label className="text-[11px] text-muted-foreground">طريقة تمييز كلمات الغريب</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {([
                    { v: 'textColor',  l: 'لون النص' },
                    { v: 'background', l: 'خلفية' },
                    { v: 'border',     l: 'إطار' },
                    { v: 'none',       l: 'بدون' },
                  ] as const).map((opt) => {
                    const active = config.ghareebWordsHighlightStyle === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setCfg('ghareebWordsHighlightStyle', opt.v)}
                        className={`h-9 rounded-md text-xs transition-colors ${
                          active ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted hover:bg-accent text-foreground'
                        }`}
                      >
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">لون تمييز كلمات الغريب</Label>
                <div className="grid grid-cols-5 gap-1.5 mt-1">
                  {COLOR_PRESETS.map((c) => {
                    const active = c.value === config.ghareebWordsHighlightColor;
                    const sameAsCorrect = c.value === config.correctHighlightColor;
                    return (
                      <button
                        key={c.value}
                        onClick={() => setCfg('ghareebWordsHighlightColor', c.value)}
                        className={`h-10 rounded-md text-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                          active ? 'border-foreground' : 'border-transparent hover:border-border'
                        } ${sameAsCorrect ? 'opacity-50' : ''}`}
                        style={{ backgroundColor: `hsl(${c.value} / 0.25)`, color: `hsl(${c.value})` }}
                        title={sameAsCorrect ? 'نفس لون الكلمة الصحيحة — يفضّل اختيار لون مختلف' : ''}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${c.value})` }} />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
                {config.ghareebWordsHighlightColor === config.correctHighlightColor && (
                  <p className="text-[10px] text-destructive mt-1">تنبيه: لون كلمات الغريب مطابق للون الكلمة الصحيحة.</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Correct word repeat count */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs font-bold">عدد مرات إعادة الكلمة الصحيحة</Label>
          <p className="text-[10px] text-muted-foreground">
            بعد الإجابة الصحيحة تُعاد الكلمة لاحقًا داخل التدريب بهذا العدد. (0 = بدون إعادة)
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 1, 2, 3, 5].map((n) => {
              const active = config.correctWordReviewRepeatCount === n;
              return (
                <button
                  key={n}
                  onClick={() => setCfg('correctWordReviewRepeatCount', n)}
                  className={`h-9 rounded-md text-xs transition-colors ${
                    active ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted hover:bg-accent text-foreground'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <Input
            type="number"
            min={0}
            max={20}
            value={config.correctWordReviewRepeatCount}
            onChange={(e) => setCfg('correctWordReviewRepeatCount', Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
            className="h-9 text-sm"
            dir="ltr"
          />
        </section>

        {/* Reschedule correct word using SRS intervals (smart-review meaning mode only) */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-xs font-bold">إعادة الكلمة الصحيحة بمدد المراجعة الذكية</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                يعمل فقط داخل "تدريب المعنى بالمراجعة الذكية". عند الإجابة الصحيحة تُجدول الكلمة لإعادتها وفق نفس مدد وخصائص المراجعة الذكية (فورًا، دقيقة، ساعة…).
              </p>
            </div>
            <Switch
              checked={!!config.rescheduleCorrectAsSRS}
              onCheckedChange={(v) => setCfg('rescheduleCorrectAsSRS', v)}
            />
          </div>
        </section>
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-xs font-bold">تفعيل التلميح عند الخطأ</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">إبراز خفيف على الموضع الصحيح بعد عدد محاولات</p>
            </div>
            <Switch
              checked={config.hintEnabled}
              onCheckedChange={(v) => setCfg('hintEnabled', v)}
            />
          </div>
          {config.hintEnabled && (
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground shrink-0">بعد عدد محاولات خاطئة:</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.hintAfterWrong}
                onChange={(e) => setCfg('hintAfterWrong', Math.max(1, Math.min(10, Number(e.target.value) || 2)))}
                className="h-8 w-16 text-sm"
                dir="ltr"
              />
            </div>
          )}
        </section>

        {/* Display options */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs font-bold">خيارات العرض في التدريب</Label>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <div>
              <Label className="text-[11px]">إظهار رقم الصفحة</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">يعرض "صفحة N" في واجهة التدريب</p>
            </div>
            <Switch
              checked={config.showPageNumber}
              onCheckedChange={(v) => setCfg('showPageNumber', v)}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <div>
              <Label className="text-[11px]">إظهار عبارة التوجيه</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">"ابحث عن الكلمة القرآنية التي يدل عليها هذا المعنى"</p>
            </div>
            <Switch
              checked={config.showPromptText}
              onCheckedChange={(v) => setCfg('showPromptText', v)}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <div>
              <Label className="text-[11px]">إظهار اسم السورة</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">يعرض اسم السورة بجانب رقم الصفحة</p>
            </div>
            <Switch
              checked={config.showSurahName !== false}
              onCheckedChange={(v) => setCfg('showSurahName', v)}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <div>
              <Label className="text-[11px]">الانتقال بالضغط على أي مكان بعد الإجابة</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">يعمل فقط بعد ظهور الجواب الصحيح</p>
            </div>
            <Switch
              checked={config.advanceOnEmptyClick}
              onCheckedChange={(v) => setCfg('advanceOnEmptyClick', v)}
            />
          </div>
        </section>

        {/* Random selection mode */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs font-bold">طريقة العشوائية</Label>
          <p className="text-[10px] text-muted-foreground">
            تحدد كيفية اختيار السؤال التالي خلال التدريب.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { v: 'fair',        l: 'عشوائي عادل' },
              { v: 'smart',       l: 'ذكي (خطأ/سرعة)' },
              { v: 'mushaf',      l: 'ترتيب المصحف' },
              { v: 'leastShown',  l: 'الأقل ظهورًا' },
            ] as const).map((opt) => {
              const active = (config.randomMode || 'smart') === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => setCfg('randomMode', opt.v)}
                  className={`h-10 rounded-md text-xs transition-colors ${
                    active ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted hover:bg-accent text-foreground'
                  }`}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </section>

        {/* Session name */}
        <section className="bg-card border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">اسم الجلسة (اختياري)</Label>
          <Input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="مثال: مراجعة المعنى - الجزء 30"
            className="h-9 text-sm"
          />
        </section>
      </div>

      {/* Footer actions */}
      <div className="border-t border-border bg-card/60 p-3 shrink-0 space-y-2">
        <Button
          variant="secondary"
          className="w-full font-arabic gap-2"
          onClick={() => setSmartMode(true)}
        >
          <Brain className="w-4 h-4" />
          تدريب على المعنى بطريقة المراجعة الذكية
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="font-arabic gap-1" onClick={handlePreview}>
            <Eye className="w-4 h-4" />
            معاينة
          </Button>
          <Button variant="outline" className="font-arabic gap-1" onClick={() => handleStart(false)}>
            <Target className="w-4 h-4" />
            ابدأ التدريب
          </Button>
          <Button className="font-arabic gap-1" onClick={() => handleStart(true)}>
            <Plus className="w-4 h-4" />
            حفظ كجلسة وبدء
          </Button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_CONFIG as DEFAULT_MEANING_QUIZ_CONFIG };
