import React from 'react';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSpeech } from '@/hooks/useSpeech';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Play, Eye, MousePointerClick, Mic, Minus, Plus } from 'lucide-react';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';

const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name,
  startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

interface TahfeezAutoQuizSettingsProps {
  currentPage: number;
  quizPagesRange: number[];
  onStart: () => void;
  disabled: boolean;
  /** When true, hide the start button (used in mid-session settings sheet) */
  compact?: boolean;
}

/** Organized auto-quiz settings with collapsible sections */
export function TahfeezAutoQuizSettings({ currentPage, quizPagesRange, onStart, disabled, compact }: TahfeezAutoQuizSettingsProps) {
  const {
    autoBlankMode, setAutoBlankMode,
    waqfCombinedModes, setWaqfCombinedModes,
    blankCount, setBlankCount,
    ayahCount, setAyahCount,
    timerSeconds, setTimerSeconds,
    firstWordTimerSeconds, setFirstWordTimerSeconds,
    quizScope, setQuizScope,
    quizScopeFrom, setQuizScopeFrom,
    quizScopeTo, setQuizScopeTo,
    voiceMode, setVoiceMode,
    revealedColor, setRevealedColor,
    revealedWithBg, setRevealedWithBg,
    activeWordColor, setActiveWordColor,
    singleWordMode, setSingleWordMode,
    quizInteraction, setQuizInteraction,
    mcqDisplayMode, setMcqDisplayMode,
    mcqPanelPosition, setMcqPanelPosition,
    dotScale, setDotScale,
    revealGranularity, setRevealGranularity,
    groupDurationProportional, setGroupDurationProportional,
    segmentMcqInline, setSegmentMcqInline,
    segmentMcqChoicesAtBlank, setSegmentMcqChoicesAtBlank,
    segmentMcqCorrectDelay, setSegmentMcqCorrectDelay,
    segmentMcqWrongDelay, setSegmentMcqWrongDelay,
    segmentMcqRandomOrder, setSegmentMcqRandomOrder,
    segmentMcqMultiPage, setSegmentMcqMultiPage,
    segmentMcqBlankDuration, setSegmentMcqBlankDuration,
    waqfDisplayMode, setWaqfDisplayMode,
    reviewMode, setReviewMode,
    hiddenAyatCount, setHiddenAyatCount,
    hiddenWordsCount, setHiddenWordsCount,
    distributionMode, setDistributionMode,
    hiddenWordsMode, setHiddenWordsMode,
    hiddenWordsPercentage, setHiddenWordsPercentage,
    percentageScope, setPercentageScope,
    wordSequenceMode, setWordSequenceMode,
  } = useTahfeezStore();
  // reviewMode, distributionMode etc. are kept in TahfeezSessionReviewSettings only
  void reviewMode; void setReviewMode;
  void hiddenAyatCount; void setHiddenAyatCount;
  void hiddenWordsCount; void setHiddenWordsCount;
  void distributionMode; void setDistributionMode;
  void hiddenWordsMode; void setHiddenWordsMode;
  void hiddenWordsPercentage; void setHiddenWordsPercentage;
  void percentageScope; void setPercentageScope;
  void wordSequenceMode; void setWordSequenceMode;

  const speech = useSpeech();
  const keepScreenAwake = useSettingsStore((s) => s.settings.autoplay.keepScreenAwake ?? false);

  const isSegmentMcq = autoBlankMode === 'next-ayah-mcq' || autoBlankMode === 'next-waqf-mcq';
  const showWordCount = (['beginning', 'middle', 'end', 'beginning-middle', 'middle-end', 'beginning-end', 'beginning-middle-end'] as string[]).includes(autoBlankMode);

  return (
    <div className="page-frame p-4 space-y-4 animate-fade-in" dir="rtl">
      <h2 className="font-arabic font-bold text-foreground text-center text-lg">اختبار تلقائي</h2>

      <Accordion type="multiple" defaultValue={['pattern', 'scope']} className="space-y-2">

        {/* ═══ Section 1: Blanking Pattern ═══ */}
        <AccordionItem value="pattern" className="border rounded-xl px-3 overflow-hidden">
          <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
            <span className="flex items-center gap-2">📋 نمط الإخفاء</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {/* Ayah-based patterns */}
            <div className="space-y-2">
              <p className="text-[11px] font-arabic text-muted-foreground font-medium">إخفاء جزء من الآية</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'beginning' as const, label: 'أول الآية', icon: '▶' },
                  { value: 'middle' as const, label: 'الوسط', icon: '◼' },
                  { value: 'end' as const, label: 'الآخر', icon: '◀' },
                  { value: 'beginning-middle' as const, label: 'أول + وسط' },
                  { value: 'middle-end' as const, label: 'وسط + آخر' },
                  { value: 'beginning-end' as const, label: 'أول + آخر' },
                  { value: 'beginning-middle-end' as const, label: 'الكل' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={autoBlankMode === opt.value && waqfCombinedModes.length === 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setAutoBlankMode(opt.value); setWaqfCombinedModes([]); }}
                    className="font-arabic text-[11px] h-7 px-2.5"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {showWordCount && (
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-arabic text-muted-foreground">عدد الكلمات المخفية: <span className="text-primary font-bold">{blankCount}</span></label>
                  <Slider value={[blankCount]} onValueChange={([v]) => setBlankCount(v)} min={1} max={10} step={1} />
                </div>
              )}
            </div>

            {/* Full segments */}
            <div className="space-y-2">
              <p className="text-[11px] font-arabic text-muted-foreground font-medium">إخفاء كامل</p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={autoBlankMode === 'full-page' && waqfCombinedModes.length === 0 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setAutoBlankMode('full-page'); setWaqfCombinedModes([]); }}
                  className="font-arabic text-[11px] h-7 px-2.5"
                >
                  صفحة كاملة
                </Button>
              </div>
            </div>

            {/* Waqf-based patterns */}
            <div className="space-y-2">
              <p className="text-[11px] font-arabic text-muted-foreground font-medium">إخفاء حسب علامات الوقف والآيات <span className="text-[10px]">(يمكن اختيار أكثر من واحد)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'between-waqf' as const, label: 'بين وقفين' },
                  { value: 'waqf-to-ayah' as const, label: 'وقف ← رأس الآية' },
                  { value: 'ayah-to-waqf' as const, label: 'رأس الآية ← وقف' },
                  { value: 'between-ayah' as const, label: 'ما بين آيتين' },
                ].map(opt => {
                  const isActive = waqfCombinedModes.includes(opt.value);
                  return (
                    <Button
                      key={opt.value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        let newModes: typeof waqfCombinedModes;
                        if (isActive) {
                          newModes = waqfCombinedModes.filter(m => m !== opt.value);
                        } else {
                          newModes = [...waqfCombinedModes, opt.value];
                        }
                        setWaqfCombinedModes(newModes);
                        if (newModes.length > 0) setAutoBlankMode(newModes[0] as any);
                      }}
                      className="font-arabic text-[11px] h-7 px-2.5"
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Waqf display mode */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-arabic text-muted-foreground font-medium">طريقة عرض علامة الوقف عند الإخفاء</p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={waqfDisplayMode === 'with-word' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWaqfDisplayMode('with-word')}
                  className="font-arabic text-[11px] h-7 px-2.5"
                >
                  إظهار الوقف مع الكلمة
                </Button>
                <Button
                  variant={waqfDisplayMode === 'sign-only' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWaqfDisplayMode('sign-only')}
                  className="font-arabic text-[11px] h-7 px-2.5"
                >
                  إظهار علامة الوقف فقط
                </Button>
              </div>
            </div>

            {/* Segment MCQ modes */}
            <div className="space-y-2">
              <p className="text-[11px] font-arabic text-muted-foreground font-medium">اختبار اختيار من متعدد</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'next-ayah-mcq' as const, label: 'اختر الآية التالية' },
                  { value: 'next-waqf-mcq' as const, label: 'اختر ما بعد الوقف' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={autoBlankMode === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setAutoBlankMode(opt.value); setWaqfCombinedModes([]); }}
                    className="font-arabic text-[11px] h-7 px-2.5"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ═══ Section 2: Quiz Scope ═══ */}
        <AccordionItem value="scope" className="border rounded-xl px-3 overflow-hidden">
          <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
            <span className="flex items-center gap-2">📖 نطاق الاختبار</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'current-page' as const, label: 'الصفحة الحالية' },
                { value: 'page-range' as const, label: 'نطاق صفحات' },
                { value: 'surah' as const, label: 'سورة' },
                { value: 'juz' as const, label: 'جزء' },
                { value: 'hizb' as const, label: 'حزب' },
              ].map(opt => (
                <Button
                  key={opt.value}
                  variant={quizScope === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setQuizScope(opt.value);
                    if (opt.value === 'current-page') {
                      setQuizScopeFrom(currentPage);
                      setQuizScopeTo(currentPage);
                    }
                  }}
                  className="font-arabic text-[11px] h-7 px-2.5"
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {quizScope === 'page-range' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">من:</label>
                <Input type="number" min={1} max={604} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-16" />
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">إلى:</label>
                <Input type="number" min={1} max={604} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(604, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-16" />
              </div>
            )}

            {quizScope === 'surah' && (
              <Select value={String(quizScopeFrom)} onValueChange={v => { const num = parseInt(v); setQuizScopeFrom(num); setQuizScopeTo(num); }}>
                <SelectTrigger className="h-8 text-xs font-arabic"><SelectValue placeholder="اختر سورة" /></SelectTrigger>
                <SelectContent>
                  {SURAHS.map(s => <SelectItem key={s.number} value={String(s.number)} className="text-xs font-arabic">{s.number}. {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {quizScope === 'juz' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">من:</label>
                <Input type="number" min={1} max={30} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-14" />
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">إلى:</label>
                <Input type="number" min={1} max={30} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-14" />
              </div>
            )}

            {quizScope === 'hizb' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">من:</label>
                <Input type="number" min={1} max={60} value={quizScopeFrom} onChange={e => setQuizScopeFrom(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-14" />
                <label className="text-[11px] font-arabic text-muted-foreground whitespace-nowrap">إلى:</label>
                <Input type="number" min={1} max={60} value={quizScopeTo} onChange={e => setQuizScopeTo(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} className="h-7 text-xs w-14" />
              </div>
            )}

            <p className="text-[10px] font-arabic text-muted-foreground text-center">
              {quizScope === 'current-page'
                ? `صفحة ${currentPage}`
                : `${quizPagesRange.length} صفحة`
              }
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* ═══ Section 3: Interaction Mode ═══ */}
        <AccordionItem value="interaction" className="border rounded-xl px-3 overflow-hidden">
          <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
            <span className="flex items-center gap-2">🎯 طريقة الإجابة</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            {/* Only show for non-segment MCQ modes */}
            {!isSegmentMcq && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant={quizInteraction === 'auto-reveal' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('auto-reveal')} className="font-arabic text-[11px] h-7 px-2.5">
                    <Eye className="w-3 h-3 ml-1" />تلقائي
                  </Button>
                  <Button variant={quizInteraction === 'auto-tap' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('auto-tap')} className="font-arabic text-[11px] h-7 px-2.5">
                    <Eye className="w-3 h-3 ml-1" />تلقائي+ضغط
                  </Button>
                  <Button variant={quizInteraction === 'tap-only' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('tap-only')} className="font-arabic text-[11px] h-7 px-2.5">
                    <MousePointerClick className="w-3 h-3 ml-1" />ضغط فقط
                  </Button>
                  <Button variant={quizInteraction === 'mcq' ? 'default' : 'outline'} size="sm" onClick={() => setQuizInteraction('mcq')} className="font-arabic text-[11px] h-7 px-2.5">
                    <MousePointerClick className="w-3 h-3 ml-1" />اختياري
                  </Button>
                </div>

                {quizInteraction === 'mcq' && (
                  <div className="space-y-2 pr-2 border-r-2 border-primary/20">
                    <SettingRow label="عرض الخيارات">
                      <div className="flex gap-1">
                        <Button variant={mcqDisplayMode === 'panel' ? 'default' : 'outline'} size="sm" onClick={() => setMcqDisplayMode('panel')} className="font-arabic text-[10px] h-6 px-2">لوحة</Button>
                        <Button variant={mcqDisplayMode === 'inline' ? 'default' : 'outline'} size="sm" onClick={() => setMcqDisplayMode('inline')} className="font-arabic text-[10px] h-6 px-2">في السطر</Button>
                      </div>
                    </SettingRow>
                    {mcqDisplayMode === 'panel' && (
                      <SettingRow label="موضع اللوحة">
                        <div className="flex gap-1">
                          <Button variant={mcqPanelPosition === 'top' ? 'default' : 'outline'} size="sm" onClick={() => setMcqPanelPosition('top')} className="font-arabic text-[10px] h-6 px-2">فوق</Button>
                          <Button variant={mcqPanelPosition === 'bottom' ? 'default' : 'outline'} size="sm" onClick={() => setMcqPanelPosition('bottom')} className="font-arabic text-[10px] h-6 px-2">أسفل</Button>
                        </div>
                      </SettingRow>
                    )}
                  </div>
                )}

                {/* Reveal granularity */}
                <SettingRow label="وحدة الكشف">
                  <div className="flex flex-wrap gap-1">
                    <Button variant={revealGranularity === 'word' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('word')} className="font-arabic text-[10px] h-6 px-2">كلمة</Button>
                    <Button variant={revealGranularity === 'ayah' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('ayah')} className="font-arabic text-[10px] h-6 px-2">آية</Button>
                    <Button variant={revealGranularity === 'waqf-segment' ? 'default' : 'outline'} size="sm" onClick={() => setRevealGranularity('waqf-segment')} className="font-arabic text-[10px] h-6 px-2">مقطع وقفي</Button>
                  </div>
                </SettingRow>

                <SettingToggle label="مدة تناسبية" desc="المدة = عدد الكلمات × سرعة الكلمة" checked={groupDurationProportional} onChange={setGroupDurationProportional} />

                <SettingToggle label="كلمة واحدة فقط" desc="تختفي بعد ظهورها" checked={singleWordMode} onChange={setSingleWordMode} />
                
                <SettingToggle
                  label="التسميع الصوتي"
                  desc={speech.isSupported ? 'يكشف الكلمة عند نطقها' : 'غير متاح'}
                  checked={voiceMode}
                  onChange={setVoiceMode}
                  disabled={!speech.isSupported}
                />
              </>
            )}

            {/* Segment MCQ-specific settings */}
            {isSegmentMcq && (
              <div className="space-y-2">
                <SettingToggle label="عرض الاختيارات على الصفحة" checked={segmentMcqInline} onChange={setSegmentMcqInline} />
                {segmentMcqInline && (
                  <SettingToggle label="عرض الخيارات في موقع الإخفاء" checked={segmentMcqChoicesAtBlank} onChange={setSegmentMcqChoicesAtBlank} />
                )}
                <SettingToggle label="ترتيب عشوائي" checked={segmentMcqRandomOrder} onChange={setSegmentMcqRandomOrder} />
                <SettingToggle label="متابعة عبر الصفحات" checked={segmentMcqMultiPage} onChange={setSegmentMcqMultiPage} />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ═══ Section 4: Timing ═══ */}
        <AccordionItem value="timing" className="border rounded-xl px-3 overflow-hidden">
          <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
            <span className="flex items-center gap-2">⏱️ التوقيت</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            {!isSegmentMcq && (
              <>
                <SliderSetting
                  label="مهلة الكلمة الأولى"
                  value={firstWordTimerSeconds}
                  onChange={(v) => setFirstWordTimerSeconds(+v.toFixed(2))}
                  min={0.1} max={30} step={0.1}
                  format={formatSeconds}
                  presets={[0.3, 0.5, 1, 2, 5, 10, 15]}
                />
                <SliderSetting
                  label="مدة ظهور كل كلمة"
                  value={timerSeconds}
                  onChange={(v) => setTimerSeconds(+v.toFixed(2))}
                  min={0.1} max={30} step={0.1}
                  format={formatSeconds}
                  presets={[0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1, 2, 3, 4, 6, 8]}
                />
                <SliderSetting
                  label="الانتقال التلقائي للصفحة التالية"
                  value={useSettingsStore.getState().settings.autoplay.autoAdvanceDelay ?? 1.5}
                  onChange={(v) => useSettingsStore.getState().setAutoplay({ autoAdvanceDelay: v })}
                  min={0.5} max={10} step={0.5}
                  format={(v) => `${v} ث`}
                />
              </>
            )}

            {isSegmentMcq && (
              <>
                <SliderSetting
                  label="مدة الإخفاء قبل الخيارات"
                  value={segmentMcqBlankDuration}
                  onChange={(v) => setSegmentMcqBlankDuration(+(v).toFixed(1))}
                  min={0} max={30} step={0.5}
                  format={(v) => v <= 0 ? 'بدون تأخير' : formatSeconds(v)}
                />
                <SliderSetting
                  label="بعد الإجابة الصحيحة"
                  value={segmentMcqCorrectDelay}
                  onChange={(v) => setSegmentMcqCorrectDelay(+(v).toFixed(1))}
                  min={0.1} max={30} step={0.1}
                  format={formatSeconds}
                />
                <SliderSetting
                  label="بعد الإجابة الخاطئة"
                  value={segmentMcqWrongDelay}
                  onChange={(v) => setSegmentMcqWrongDelay(+(v).toFixed(1))}
                  min={0.1} max={30} step={0.1}
                  format={formatSeconds}
                />
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ═══ Section 5: Appearance ═══ */}
        {!isSegmentMcq && (
          <AccordionItem value="appearance" className="border rounded-xl px-3 overflow-hidden">
            <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
              <span className="flex items-center gap-2">🎨 المظهر</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              {/* Active word color */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-arabic text-muted-foreground">لون الكلمة أثناء الظهور</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { value: 'gold' as const, label: 'ذهبي', color: 'hsl(45 95% 55%)' },
                    { value: 'green' as const, label: 'أخضر', color: 'hsl(140 60% 40%)' },
                    { value: 'blue' as const, label: 'أزرق', color: 'hsl(210 70% 50%)' },
                    { value: 'orange' as const, label: 'برتقالي', color: 'hsl(30 80% 50%)' },
                    { value: 'purple' as const, label: 'بنفسجي', color: 'hsl(270 60% 50%)' },
                    { value: 'red' as const, label: 'أحمر', color: 'hsl(0 70% 50%)' },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setActiveWordColor(opt.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-arabic transition-all border ${activeWordColor === opt.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Revealed word color */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-arabic text-muted-foreground">لون الكلمة بعد ظهورها</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { value: 'green' as const, label: 'أخضر', color: 'hsl(140 55% 35%)' },
                    { value: 'blue' as const, label: 'أزرق', color: 'hsl(210 70% 45%)' },
                    { value: 'orange' as const, label: 'برتقالي', color: 'hsl(30 80% 45%)' },
                    { value: 'purple' as const, label: 'بنفسجي', color: 'hsl(270 60% 50%)' },
                    { value: 'primary' as const, label: 'أساسي', color: 'hsl(var(--primary))' },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setRevealedColor(opt.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-arabic transition-all border ${revealedColor === opt.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <SettingToggle label="خلفية ملونة بعد الظهور" checked={revealedWithBg} onChange={setRevealedWithBg} />

              <SliderSetting
                label="حجم النقاط"
                value={dotScale}
                onChange={setDotScale}
                min={0.2} max={2} step={0.1}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ═══ Section 6: General ═══ */}
        <AccordionItem value="general" className="border rounded-xl px-3 overflow-hidden">
          <AccordionTrigger className="font-arabic text-sm font-bold hover:no-underline py-3">
            <span className="flex items-center gap-2">⚙️ عام</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <SettingToggle
              label="تثبيت الشاشة"
              desc="منع إطفاء الشاشة أثناء الاختبار"
              checked={keepScreenAwake}
              onChange={(v) => useSettingsStore.getState().setAutoplay({ keepScreenAwake: v })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Session Preview */}
      <div className="border rounded-xl p-3 bg-muted/30 space-y-1.5">
        <p className="text-[11px] font-arabic font-bold text-foreground">📋 ملخص الجلسة</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-arabic text-muted-foreground">
          <span>نوع المراجعة:</span>
          <span className="text-foreground font-medium">كلمات</span>
          <span>كلمات مخفية:</span>
          <span className="text-foreground font-medium">
            {hiddenWordsMode === 'percentage' ? `${hiddenWordsPercentage}%` : `${hiddenWordsCount} كلمة`}
          </span>
          {hiddenWordsMode === 'percentage' && (
            <>
              <span>نطاق النسبة:</span>
              <span className="text-foreground font-medium">{percentageScope === 'per-ayah' ? 'لكل آية' : 'للمقطع'}</span>
            </>
          )}
          <span>التوزيع:</span>
          <span className="text-foreground font-medium">
            {distributionMode === 'sequential' ? 'متتابع' : distributionMode === 'page-scattered' ? 'موزع بالصفحة' : distributionMode === 'range-scattered' ? 'موزع بالصفحات' : 'موزع بالنطاق'}
          </span>
          <span>النطاق:</span>
          <span className="text-foreground font-medium">
            {quizScope === 'current-page' ? `صفحة ${currentPage}` : quizScope === 'surah' ? 'سورة' : quizScope === 'juz' ? 'جزء' : quizScope === 'hizb' ? 'حزب' : `${quizPagesRange.length} صفحة`}
          </span>
        </div>
      </div>

      {/* Start Button — hidden in compact mode */}
      {!compact && (
        <Button onClick={onStart} className="w-full font-arabic text-base h-12" disabled={disabled}>
          <Play className="w-5 h-5 ml-2" />
          ابدأ الاختبار {quizScope === 'current-page' ? `(صفحة ${currentPage})` : `(${quizPagesRange.length} صفحة)`}
        </Button>
      )}
    </div>
  );
}

/* ─── Helper Components ─── */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[11px] font-arabic text-foreground">{label}</label>
      {children}
    </div>
  );
}

function SettingToggle({ label, desc, checked, onChange, disabled }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg border">
      <div className="flex flex-col">
        <label className="text-[11px] font-arabic text-foreground">{label}</label>
        {desc && <span className="text-[10px] text-muted-foreground font-arabic">{desc}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function SliderSetting({ label, value, onChange, min, max, step, format, presets }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
  presets?: number[];
}) {
  const [showInput, setShowInput] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const clamp = (v: number) => Math.max(min, Math.min(max, +v.toFixed(2)));
  const incStep = value < 1 ? 0.1 : value < 5 ? 0.5 : 1;

  const handleInputSubmit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0) onChange(clamp(parsed));
    setShowInput(false);
    setInputValue('');
  };

  return (
    <div className="space-y-1.5" dir="rtl">
      <label className="text-[11px] font-arabic text-muted-foreground block">{label}</label>

      {/* +/- with value display or numeric input */}
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => onChange(clamp(value - incStep))} disabled={value <= min}
          className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors">
          <Minus className="w-3 h-3" />
        </button>
        {showInput ? (
          <form onSubmit={e => { e.preventDefault(); handleInputSubmit(); }} className="flex items-center gap-1">
            <Input type="number" step="0.1" min={String(min)} max={String(max)} autoFocus
              value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={handleInputSubmit}
              className="w-16 h-7 text-center text-[11px] font-arabic" placeholder={String(value)} />
          </form>
        ) : (
          <button onClick={() => { setShowInput(true); setInputValue(String(value)); }}
            className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs font-arabic tabular-nums min-w-[3.5rem] text-center cursor-pointer hover:bg-primary/15 transition-colors"
            title="اضغط لإدخال قيمة مخصصة">
            {format(value)}
          </button>
        )}
        <button onClick={() => onChange(clamp(value + incStep))} disabled={value >= max}
          className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors">
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Preset chips */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {presets.filter(p => p >= min && p <= max).map(p => (
            <button key={p} onClick={() => onChange(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${
                Math.abs(value - p) < 0.05
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}>
              {format(p)}
            </button>
          ))}
        </div>
      )}

      {/* Sub-second slider when range includes sub-second values */}
      {min < 1 && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px] font-arabic text-muted-foreground">
            <span>سريع {Math.round(min * 1000)}ms</span>
            <span>1 ثانية</span>
          </div>
          <Slider value={[Math.min(value, 1)]} onValueChange={([v]) => onChange(clamp(v))} min={min} max={1} step={0.1} />
        </div>
      )}

      {/* Full range slider */}
      {max > 1 && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px] font-arabic text-muted-foreground">
            <span>1 ثانية</span>
            <span>{max} ثانية</span>
          </div>
          <Slider value={[Math.max(value, 1)]} onValueChange={([v]) => onChange(clamp(v))} min={1} max={max} step={0.5} />
        </div>
      )}
    </div>
  );
}

function formatSeconds(v: number): string {
  if (v < 1) return `${(v * 1000).toFixed(0)}ms`;
  return `${v} ث`;
}
