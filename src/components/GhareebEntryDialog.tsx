import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Map, ArrowLeft, Settings } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSettingsStore } from '@/stores/settingsStore';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const SURAHS = Object.entries(SURAH_NAMES)
  .map(([name, number]) => ({ number, name, startPage: SURAH_INFO[number]?.[0] || 1 }))
  .sort((a, b) => a.number - b.number);

const JUZ_DATA: { number: number; page: number }[] = [
  { number: 1, page: 1 }, { number: 2, page: 22 }, { number: 3, page: 42 },
  { number: 4, page: 62 }, { number: 5, page: 82 }, { number: 6, page: 102 },
  { number: 7, page: 121 }, { number: 8, page: 142 }, { number: 9, page: 162 },
  { number: 10, page: 182 }, { number: 11, page: 201 }, { number: 12, page: 222 },
  { number: 13, page: 242 }, { number: 14, page: 262 }, { number: 15, page: 282 },
  { number: 16, page: 302 }, { number: 17, page: 322 }, { number: 18, page: 342 },
  { number: 19, page: 362 }, { number: 20, page: 382 }, { number: 21, page: 402 },
  { number: 22, page: 422 }, { number: 23, page: 442 }, { number: 24, page: 462 },
  { number: 25, page: 482 }, { number: 26, page: 502 }, { number: 27, page: 522 },
  { number: 28, page: 542 }, { number: 29, page: 562 }, { number: 30, page: 582 },
];

const JUZ_LIST = JUZ_DATA.map(j => ({ number: j.number, name: `الجزء ${j.number}` }));
const HIZB_LIST = Array.from({ length: 60 }, (_, i) => ({ number: i + 1, name: `الحزب ${i + 1}` }));

/** حساب أول صفحة في النطاق المحدد */
function calcFirstPage(rangeType: string, from: number, to: number, pageFrom: number): number {
  if (rangeType === 'page-range') return Math.min(from, to);
  if (rangeType === 'surah') {
    const f = Math.min(from, to);
    return SURAH_INFO[f]?.[0] || 1;
  }
  if (rangeType === 'juz') {
    const f = Math.min(from, to);
    return JUZ_DATA[Math.max(0, f - 1)]?.page || 1;
  }
  if (rangeType === 'hizb') {
    const f = Math.min(from, to);
    const juzIdx = Math.floor((f - 1) / 2);
    const isSecond = (f - 1) % 2 === 1;
    const juz = JUZ_DATA[juzIdx];
    if (!juz) return 1;
    if (isSecond) {
      return Math.floor((juz.page + (JUZ_DATA[juzIdx + 1]?.page || 605)) / 2);
    }
    return juz.page;
  }
  return pageFrom;
}

const STORAGE_KEY_CHOICE = 'ghareeb_entry_choice';
const STORAGE_KEY_REMEMBER = 'ghareeb_entry_remember';

type EntryChoice = 'range' | 'direct';
type RangeTabType = 'surah' | 'pages' | 'juz' | 'hizb';

interface GhareebEntryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GhareebEntryDialog({ open, onClose }: GhareebEntryDialogProps) {
  const navigate = useNavigate();
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const [remember, setRemember] = useState(false);
  const [step, setStep] = useState<'choose' | 'range'>('choose');
  const [rangeType, setRangeType] = useState<RangeTabType>('surah');
  const [surahFrom, setSurahFrom] = useState(1);
  const [surahTo, setSurahTo] = useState(1);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(10);
  const [juzFrom, setJuzFrom] = useState(1);
  const [juzTo, setJuzTo] = useState(1);
  const [hizbFrom, setHizbFrom] = useState(1);
  const [hizbTo, setHizbTo] = useState(1);

  const handleDirectEntry = () => {
    if (remember) {
      localStorage.setItem(STORAGE_KEY_CHOICE, 'direct');
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    }
    onClose();
    navigate('/mushaf');
  };

  const handleRangeChoice = () => {
    setStep('range');
  };

  const handleRangeConfirm = () => {
    let rangeTypeVal: 'surah' | 'page-range' | 'juz' | 'hizb';
    let from: number, to: number;

    if (rangeType === 'surah') {
      rangeTypeVal = 'surah';
      from = surahFrom; to = surahTo;
    } else if (rangeType === 'pages') {
      rangeTypeVal = 'page-range';
      from = pageFrom; to = pageTo;
    } else if (rangeType === 'juz') {
      rangeTypeVal = 'juz';
      from = juzFrom; to = juzTo;
    } else {
      rangeTypeVal = 'hizb';
      from = hizbFrom; to = hizbTo;
    }

    // ⚠️ مهم: نكتب النطاق في localStorage مباشرة قبل navigate
    // لأن setAutoplay (zustand persist) غير متزامن ولن يكون جاهزاً عند تحميل QuranReader
    const rangePayload = {
      ghareebRangeType: rangeTypeVal,
      ghareebRangeFrom: from,
      ghareebRangeTo: to,
    };

    // 1. حدّث الـ store (للجلسة الحالية بعد العودة)
    setAutoplay(rangePayload);

    // 2. اكتب النطاق مباشرة في localStorage حتى يقرأه QuranReader فور التحميل
    localStorage.setItem('quran-app-ghareeb-pending-range', JSON.stringify(rangePayload));

    if (remember) {
      localStorage.setItem(STORAGE_KEY_CHOICE, 'range');
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    }

    // 3. احسب أول صفحة في النطاق وخزّنها لـ useQuranData يبدأ منها
    const firstPage = calcFirstPage(rangeTypeVal, from, to, pageFrom);
    localStorage.setItem('quran-app-ghareeb-start-page', String(firstPage));

    onClose();
    navigate('/mushaf');
  };


  const handleBack = () => setStep('choose');

  const RANGE_TABS: { id: RangeTabType; label: string }[] = [
    { id: 'surah', label: 'سورة' },
    { id: 'pages', label: 'صفحات' },
    { id: 'juz', label: 'جزء' },
    { id: 'hizb', label: 'حزب' },
  ];

  return (
      <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden rounded-2xl border-border"
        dir="rtl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 'choose' ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="bg-primary/10 px-6 py-5 text-center border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-arabic text-foreground">بوابة الغريب</h2>
              <p className="text-xs font-arabic text-muted-foreground mt-1">كيف تريد الدخول؟</p>
            </div>

            {/* Options */}
            <div className="p-5 space-y-3">
              <button
                onClick={handleRangeChoice}
                className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-right flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Map className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-arabic text-foreground text-sm">اختيار نطاق</div>
                  <div className="text-xs font-arabic text-muted-foreground mt-0.5">حدد السور أو الصفحات أو الجزء أو الحزب</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={handleDirectEntry}
                className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-right flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-arabic text-foreground text-sm">دخول مباشر للمصحف</div>
                  <div className="text-xs font-arabic text-muted-foreground mt-0.5">استأنف من آخر صفحة بدون تحديد نطاق</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Remember checkbox */}
              <label className="flex items-center gap-3 px-1 py-2 cursor-pointer select-none group">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    remember ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  }`}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-arabic text-muted-foreground group-hover:text-foreground transition-colors">
                  تذكر اختياري ولا تعرض هذه الشاشة مرة أخرى
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="bg-primary/10 px-6 py-5 border-b border-border">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-xs font-arabic text-muted-foreground hover:text-primary transition-colors mb-3"
              >
                <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                رجوع
              </button>
              <h2 className="text-lg font-bold font-arabic text-foreground">تحديد النطاق</h2>
              <p className="text-xs font-arabic text-muted-foreground mt-0.5">اختر نطاق الكلمات الغريبة</p>
            </div>

            {/* Range selector */}
            <div className="p-5 space-y-4">
              {/* Type tabs - 4 options */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {RANGE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setRangeType(tab.id)}
                    className={`flex-1 py-2 text-xs font-arabic transition-colors ${
                      rangeType === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Surah */}
              {rangeType === 'surah' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من سورة</Label>
                    <Select value={String(surahFrom)} onValueChange={(v) => setSurahFrom(Number(v))}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SURAHS.map((s) => (
                          <SelectItem key={s.number} value={String(s.number)} className="font-arabic">{s.number}. {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى سورة</Label>
                    <Select value={String(surahTo)} onValueChange={(v) => setSurahTo(Number(v))}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SURAHS.filter((s) => s.number >= surahFrom).map((s) => (
                          <SelectItem key={s.number} value={String(s.number)} className="font-arabic">{s.number}. {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Pages */}
              {rangeType === 'pages' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من صفحة</Label>
                    <input
                      type="number" min={1} max={604} value={pageFrom}
                      onChange={(e) => setPageFrom(Math.min(604, Math.max(1, Number(e.target.value))))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى صفحة</Label>
                    <input
                      type="number" min={pageFrom} max={604} value={pageTo}
                      onChange={(e) => setPageTo(Math.min(604, Math.max(pageFrom, Number(e.target.value))))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Juz */}
              {rangeType === 'juz' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من جزء</Label>
                    <Select value={String(juzFrom)} onValueChange={(v) => { const n = Number(v); setJuzFrom(n); if (juzTo < n) setJuzTo(n); }}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {JUZ_LIST.map((j) => (
                          <SelectItem key={j.number} value={String(j.number)} className="font-arabic">{j.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى جزء</Label>
                    <Select value={String(juzTo)} onValueChange={(v) => setJuzTo(Number(v))}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {JUZ_LIST.filter((j) => j.number >= juzFrom).map((j) => (
                          <SelectItem key={j.number} value={String(j.number)} className="font-arabic">{j.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Hizb */}
              {rangeType === 'hizb' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من حزب</Label>
                    <Select value={String(hizbFrom)} onValueChange={(v) => { const n = Number(v); setHizbFrom(n); if (hizbTo < n) setHizbTo(n); }}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {HIZB_LIST.map((h) => (
                          <SelectItem key={h.number} value={String(h.number)} className="font-arabic">{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى حزب</Label>
                    <Select value={String(hizbTo)} onValueChange={(v) => setHizbTo(Number(v))}>
                      <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {HIZB_LIST.filter((h) => h.number >= hizbFrom).map((h) => (
                          <SelectItem key={h.number} value={String(h.number)} className="font-arabic">{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Remember */}
              <label className="flex items-center gap-3 px-1 py-1 cursor-pointer select-none group">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    remember ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  }`}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-arabic text-muted-foreground group-hover:text-foreground transition-colors">
                  تذكر اختياري ولا تعرض هذه الشاشة مرة أخرى
                </span>
              </label>

              {/* Confirm */}
              <button
                onClick={handleRangeConfirm}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-arabic font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                تطبيق النطاق والدخول
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** زر صغير لإعادة ضبط تفضيل الدخول */
export function GhareebEntryResetButton({ onReset }: { onReset: () => void }) {
  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY_CHOICE);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
    onReset();
  };
  return (
    <button
      onClick={handleReset}
      className="flex items-center gap-1 text-[11px] font-arabic text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
      title="تغيير طريقة الدخول"
    >
      <Settings className="w-3 h-3" />
      تغيير طريقة الدخول
    </button>
  );
}

/** Hook: يحدد ما إذا كان يجب عرض شاشة الاختيار */
export function useGhareebEntry() {
  const [showDialog, setShowDialog] = useState(false);
  const navigate = useNavigate();

  const triggerEntry = () => {
    const remember = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    if (remember) {
      navigate('/mushaf');
      return;
    }
    setShowDialog(true);
  };

  const closeDialog = () => setShowDialog(false);
  const resetPreference = () => setShowDialog(true);

  return { showDialog, triggerEntry, closeDialog, resetPreference };
}
