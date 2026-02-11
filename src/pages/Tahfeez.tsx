import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { useQuranData } from '@/hooks/useQuranData';
import { Link } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, ArrowRight, Save, Trash2, Settings2, GraduationCap, ListChecks, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { TahfeezQuizView } from '@/components/TahfeezQuizView';

export default function TahfeezPage() {
  const {
    storedItems, clearAllItems,
    quizSource, setQuizSource,
    autoBlankMode, setAutoBlankMode,
    blankCount, setBlankCount,
    ayahCount, setAyahCount,
    timerSeconds, setTimerSeconds,
    revealMode, setRevealMode,
    activeTab, setActiveTab,
    selectionMode, setSelectionMode,
  } = useTahfeezStore();

  const { currentPage, getCurrentPageData } = useQuranData();
  const pageData = getCurrentPageData();

  const [quizStarted, setQuizStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerDone, setTimerDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (!quizStarted || isPaused || timerDone) return;
    setTimeLeft(timerSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizStarted, isPaused, timerDone, timerSeconds]);

  // Compute blanked keys for gradual reveal
  const blankedKeys = useMemo((): string[] => {
    if (!pageData?.text) return [];
    const lines = pageData.text.split('\n');
    const keys: string[] = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (line.startsWith('سُورَةُ') || line.startsWith('سورة ') || line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ')) continue;
      const tokens = line.split(/(\s+)/);
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (/^\s+$/.test(t)) continue;
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        if (/^[٠-٩0-9۰-۹]+$/.test(clean)) continue;
        keys.push(`${li}_${ti}`);
      }
    }
    return keys;
  }, [pageData?.text]);

  // Gradual reveal after timer
  useEffect(() => {
    if (!timerDone || revealMode !== 'gradual') return;
    let revIdx = 0;
    const interval = setInterval(() => {
      if (revIdx >= blankedKeys.length) {
        clearInterval(interval);
        return;
      }
      setRevealedIndices(prev => new Set([...prev, blankedKeys[revIdx]]));
      revIdx++;
    }, 500);
    return () => clearInterval(interval);
  }, [timerDone, revealMode, blankedKeys]);

  const handleStart = () => {
    setQuizStarted(true);
    setIsPaused(false);
    setTimerDone(false);
    setRevealedIndices(new Set());
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleRevealAll = () => {
    setTimerDone(true);
    setRevealedIndices(new Set(blankedKeys));
  };

  const handleGoToMushaf = () => {
    setSelectionMode(true);
  };

  const pageItems = storedItems.filter(i => i.data.page === currentPage);

  const tabs = [
    { id: 'store' as const, icon: Save, label: 'تخزين' },
    { id: 'custom-quiz' as const, icon: ListChecks, label: 'اختبار المخزون' },
    { id: 'auto-quiz' as const, icon: Zap, label: 'اختبار تلقائي' },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold font-arabic text-foreground">بوابة التحفيظ</h1>
          </div>
          <Link to="/" className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Tab icons */}
      {!quizStarted && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex justify-center gap-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-arabic font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Tab 1: Store words */}
        {!quizStarted && activeTab === 'store' && (
          <div className="space-y-4 animate-fade-in">
            <div className="page-frame p-5 space-y-4">
              <h2 className="font-arabic font-bold text-foreground">تخزين الكلمات والجمل</h2>
              <p className="text-xs font-arabic text-muted-foreground leading-relaxed">
                اذهب إلى المصحف وفعّل وضع التحديد لاختيار الكلمات أو الجمل التي تريد حفظها.
                اضغط على كلمة واحدة لتحديدها، أو اضغط على أول كلمة ثم آخر كلمة لتحديد جملة.
              </p>
              <Link to="/mushaf">
                <Button onClick={handleGoToMushaf} className="w-full font-arabic">
                  <BookOpen className="w-4 h-4 ml-2" />
                  الذهاب للمصحف لتحديد الكلمات
                </Button>
              </Link>
            </div>

            {/* Stored items summary */}
            {storedItems.length > 0 && (
              <div className="page-frame p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-arabic font-bold text-sm text-foreground">
                    المخزون ({storedItems.length})
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearAllItems} className="text-destructive font-arabic text-xs">
                    <Trash2 className="w-3 h-3 ml-1" />
                    مسح الكل
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {storedItems.map((item, i) => (
                    <StoredItemBadge key={i} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Custom quiz (stored words) */}
        {!quizStarted && activeTab === 'custom-quiz' && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار المخزون</h2>

            {storedItems.length === 0 ? (
              <p className="text-xs font-arabic text-muted-foreground text-center py-4">
                لم تخزّن أي كلمات بعد. اذهب لتبويب "تخزين" أولاً.
              </p>
            ) : (
              <>
                <p className="text-xs font-arabic text-muted-foreground">
                  سيتم إخفاء {storedItems.filter(i => i.data.page === currentPage).length} عنصر في صفحة {currentPage}
                </p>

                {/* Timer */}
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مدة المؤقت: {timerSeconds} ثانية</label>
                  <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={3} max={30} step={1} />
                </div>

                {/* Reveal mode */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-arabic text-muted-foreground">كشف تدريجي</label>
                  <Switch checked={revealMode === 'gradual'} onCheckedChange={(c) => setRevealMode(c ? 'gradual' : 'all')} />
                </div>

                <Button onClick={() => { setQuizSource('custom'); handleStart(); }} className="w-full font-arabic" disabled={!pageData || pageItems.length === 0}>
                  <Play className="w-4 h-4 ml-2" />
                  ابدأ الاختبار (صفحة {currentPage})
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Auto quiz */}
        {!quizStarted && activeTab === 'auto-quiz' && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار تلقائي</h2>

            {/* Auto blanking modes */}
            <div className="space-y-3">
              <label className="text-sm font-arabic text-muted-foreground">نمط الإخفاء</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'beginning' as const, label: 'أول الآية' },
                  { value: 'middle' as const, label: 'وسط الآية' },
                  { value: 'end' as const, label: 'آخر الآية' },
                  { value: 'ayah-count' as const, label: 'عدد آيات' },
                  { value: 'full-page' as const, label: 'صفحة كاملة' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={autoBlankMode === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAutoBlankMode(opt.value)}
                    className="font-arabic text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {(autoBlankMode === 'beginning' || autoBlankMode === 'middle' || autoBlankMode === 'end') && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الكلمات: {blankCount}</label>
                  <Slider value={[blankCount]} onValueChange={([v]) => setBlankCount(v)} min={1} max={10} step={1} />
                </div>
              )}

              {autoBlankMode === 'ayah-count' && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الآيات: {ayahCount}</label>
                  <Slider value={[ayahCount]} onValueChange={([v]) => setAyahCount(v)} min={1} max={15} step={1} />
                </div>
              )}
            </div>

            {/* Timer */}
            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مدة المؤقت: {timerSeconds} ثانية</label>
              <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={3} max={30} step={1} />
            </div>

            {/* Reveal mode */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-arabic text-muted-foreground">كشف تدريجي</label>
              <Switch checked={revealMode === 'gradual'} onCheckedChange={(c) => setRevealMode(c ? 'gradual' : 'all')} />
            </div>

            <Button onClick={() => { setQuizSource('auto'); handleStart(); }} className="w-full font-arabic" disabled={!pageData}>
              <Play className="w-4 h-4 ml-2" />
              ابدأ الاختبار (صفحة {currentPage})
            </Button>
          </div>
        )}

        {/* Quiz view */}
        {quizStarted && pageData && (
          <div className="space-y-4 animate-fade-in">
            {/* Timer bar */}
            <div className="page-frame p-3 flex items-center justify-between">
              <span className="text-sm font-arabic text-muted-foreground">صفحة {currentPage}</span>
              <span className={`text-lg font-bold font-arabic ${timeLeft <= 3 && !timerDone ? 'text-destructive' : 'text-foreground'}`}>
                {timerDone ? '✓' : `${timeLeft}s`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: timerDone ? '100%' : `${((timerSeconds - timeLeft) / timerSeconds) * 100}%` }}
              />
            </div>

            <TahfeezQuizView
              page={pageData}
              quizSource={quizSource}
              storedItems={storedItems}
              autoBlankMode={autoBlankMode}
              blankCount={blankCount}
              ayahCount={ayahCount}
              revealedIndices={revealedIndices}
              timerDone={timerDone}
              revealMode={revealMode}
            />

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePauseResume} className="font-arabic">
                {isPaused ? <Play className="w-4 h-4 ml-1" /> : <Pause className="w-4 h-4 ml-1" />}
                {isPaused ? 'استئناف' : 'إيقاف'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRevealAll} className="font-arabic" disabled={timerDone && revealMode === 'all'}>
                <Eye className="w-4 h-4 ml-1" />
                كشف الآن
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuizStarted(false)} className="font-arabic">
                إعادة
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StoredItemBadge({ item }: { item: TahfeezItem }) {
  const removeItem = useTahfeezStore(s => s.removeItem);
  const getItemKey = useTahfeezStore(s => s.getItemKey);

  const text = item.type === 'word' ? item.data.originalWord : item.data.originalText;
  const page = item.data.page;
  const label = item.type === 'phrase' ? '📝' : '';

  return (
    <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-arabic group">
      {label}{text}
      <span className="text-xs text-muted-foreground mr-1">ص{page}</span>
      <button
        onClick={() => removeItem(getItemKey(item))}
        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity mr-1"
      >
        ×
      </button>
    </span>
  );
}
