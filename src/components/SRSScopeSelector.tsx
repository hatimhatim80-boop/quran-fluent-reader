import React, { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { Book, Layers, Hash, FileText, Search, CheckCircle2, ArrowLeftRight } from 'lucide-react';

export type SRSScopeType = 'current-page' | 'page-range' | 'surah' | 'juz' | 'hizb' | 'all-due' | 'flagged';

export interface SRSScope {
  type: SRSScopeType;
  from: number;
  to: number;
}

const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name, startPage: SURAH_INFO[number]?.[0] || 1,
  verses: SURAH_INFO[number]?.[1] || 0,
})).sort((a, b) => a.number - b.number);

const JUZ_DATA = [
  { number: 1, name: 'الم', page: 1 }, { number: 2, name: 'سيقول', page: 22 },
  { number: 3, name: 'تلك الرسل', page: 42 }, { number: 4, name: 'لن تنالوا', page: 62 },
  { number: 5, name: 'والمحصنات', page: 82 }, { number: 6, name: 'لا يحب الله', page: 102 },
  { number: 7, name: 'وإذا سمعوا', page: 121 }, { number: 8, name: 'ولو أننا', page: 142 },
  { number: 9, name: 'قال الملأ', page: 162 }, { number: 10, name: 'واعلموا', page: 182 },
  { number: 11, name: 'يعتذرون', page: 201 }, { number: 12, name: 'وما من دابة', page: 222 },
  { number: 13, name: 'وما أبرئ', page: 242 }, { number: 14, name: 'ربما', page: 262 },
  { number: 15, name: 'سبحان الذي', page: 282 }, { number: 16, name: 'قال ألم', page: 302 },
  { number: 17, name: 'اقترب للناس', page: 322 }, { number: 18, name: 'قد أفلح', page: 342 },
  { number: 19, name: 'وقال الذين', page: 362 }, { number: 20, name: 'أمن خلق', page: 382 },
  { number: 21, name: 'اتل ما أوحي', page: 402 }, { number: 22, name: 'ومن يقنت', page: 422 },
  { number: 23, name: 'وما لي', page: 442 }, { number: 24, name: 'فمن أظلم', page: 462 },
  { number: 25, name: 'إليه يرد', page: 482 }, { number: 26, name: 'حم', page: 502 },
  { number: 27, name: 'قال فما خطبكم', page: 522 }, { number: 28, name: 'قد سمع الله', page: 542 },
  { number: 29, name: 'تبارك الذي', page: 562 }, { number: 30, name: 'عم', page: 582 },
];

const HIZB_DATA = JUZ_DATA.flatMap((juz, idx) => {
  const nextJuzPage = idx < 29 ? JUZ_DATA[idx + 1].page : 605;
  const midPage = Math.floor((juz.page + nextJuzPage) / 2);
  return [
    { number: juz.number * 2 - 1, juz: juz.number, half: 1, page: juz.page },
    { number: juz.number * 2, juz: juz.number, half: 2, page: midPage },
  ];
});

interface SRSScopeSelectorProps {
  scope: SRSScope;
  onChange: (scope: SRSScope) => void;
  currentPage: number;
  showFlagged?: boolean;
}

export function scopeToPages(scope: SRSScope): number[] | null {
  const { type, from, to } = scope;
  if (type === 'all-due' || type === 'flagged') return null;
  if (type === 'current-page') return [from];
  if (type === 'page-range') {
    const f = Math.max(1, Math.min(from, to));
    const t = Math.min(604, Math.max(from, to));
    const pages: number[] = [];
    for (let p = f; p <= t; p++) pages.push(p);
    return pages;
  }
  if (type === 'surah') {
    const f = Math.min(from, to);
    const t = Math.max(from, to);
    const startInfo = SURAH_INFO[f];
    if (!startInfo) return null;
    const startPage = startInfo[0];
    const nextSurah = SURAHS.find(s => s.number === t + 1);
    const endPage = nextSurah ? nextSurah.startPage - 1 : 604;
    const pages: number[] = [];
    for (let p = startPage; p <= endPage; p++) pages.push(p);
    return pages;
  }
  if (type === 'juz') {
    const f = Math.max(1, Math.min(from, to));
    const t = Math.min(30, Math.max(from, to));
    const startPage = JUZ_DATA[f - 1]?.page || 1;
    const endPage = t < 30 ? (JUZ_DATA[t]?.page || 605) - 1 : 604;
    const pages: number[] = [];
    for (let p = startPage; p <= endPage; p++) pages.push(p);
    return pages;
  }
  if (type === 'hizb') {
    const f = Math.max(1, Math.min(from, to));
    const t = Math.min(60, Math.max(from, to));
    const fromHizb = HIZB_DATA[f - 1];
    if (!fromHizb) return null;
    const startPage = fromHizb.page;
    const endPage = t < 60 ? (HIZB_DATA[t]?.page || 605) - 1 : 604;
    const pages: number[] = [];
    for (let p = startPage; p <= Math.min(endPage, 604); p++) pages.push(p);
    return pages;
  }
  return null;
}

// Scope description for display
function scopeLabel(scope: SRSScope): string {
  if (scope.type === 'all-due') return 'كل المستحقة';
  if (scope.type === 'flagged') return 'المُعلَّمة فقط';
  if (scope.type === 'current-page') return `الصفحة الحالية (${scope.from})`;
  if (scope.type === 'page-range') return `ص${scope.from} – ص${scope.to}`;
  if (scope.type === 'surah') {
    const fromName = SURAHS.find(s => s.number === scope.from)?.name || scope.from;
    if (scope.from === scope.to) return `سورة ${fromName}`;
    const toName = SURAHS.find(s => s.number === scope.to)?.name || scope.to;
    return `${fromName} → ${toName}`;
  }
  if (scope.type === 'juz') {
    if (scope.from === scope.to) return `الجزء ${scope.from}`;
    return `الجزء ${scope.from} → ${scope.to}`;
  }
  if (scope.type === 'hizb') {
    if (scope.from === scope.to) return `الحزب ${scope.from}`;
    return `الحزب ${scope.from} → ${scope.to}`;
  }
  return '';
}

type RangeEnd = 'from' | 'to';

export function SRSScopeSelector({ scope, onChange, currentPage, showFlagged }: SRSScopeSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('quick');
  const [search, setSearch] = useState('');
  const [selectingEnd, setSelectingEnd] = useState<RangeEnd>('from');

  const pageCount = useMemo(() => {
    const pages = scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from });
    return pages ? pages.length : null;
  }, [scope, currentPage]);

  const filteredSurahs = useMemo(() => {
    if (!search.trim()) return SURAHS;
    const q = search.trim();
    return SURAHS.filter(s => s.name.includes(q) || s.number.toString() === q);
  }, [search]);

  const handleSelectItem = (type: SRSScopeType, num: number) => {
    if (selectingEnd === 'from') {
      onChange({ type, from: num, to: num });
      setSelectingEnd('to');
    } else {
      const from = Math.min(scope.from, num);
      const to = Math.max(scope.from, num);
      onChange({ type, from, to });
      setSelectingEnd('from');
    }
  };

  const isInRange = (type: SRSScopeType, num: number) => {
    if (scope.type !== type) return false;
    const f = Math.min(scope.from, scope.to);
    const t = Math.max(scope.from, scope.to);
    return num >= f && num <= t;
  };

  const isEndpoint = (type: SRSScopeType, num: number) => {
    if (scope.type !== type) return false;
    return num === scope.from || num === scope.to;
  };

  return (
    <div className="space-y-2 font-arabic" dir="rtl">
      {/* Compact display */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">{scopeLabel(scope)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {pageCount !== null && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{pageCount} صفحة</span>
          )}
          <span className="text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border border-border rounded-lg bg-card overflow-hidden animate-fade-in">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-5 h-9 rounded-none border-b border-border">
              <TabsTrigger value="quick" className="text-[10px] gap-0.5 px-1">
                <CheckCircle2 className="w-3 h-3" />
                سريع
              </TabsTrigger>
              <TabsTrigger value="surahs" className="text-[10px] gap-0.5 px-1">
                <Book className="w-3 h-3" />
                السور
              </TabsTrigger>
              <TabsTrigger value="juz" className="text-[10px] gap-0.5 px-1">
                <Layers className="w-3 h-3" />
                الأجزاء
              </TabsTrigger>
              <TabsTrigger value="hizb" className="text-[10px] gap-0.5 px-1">
                <Hash className="w-3 h-3" />
                الأحزاب
              </TabsTrigger>
              <TabsTrigger value="pages" className="text-[10px] gap-0.5 px-1">
                <FileText className="w-3 h-3" />
                الصفحات
              </TabsTrigger>
            </TabsList>

            {/* Quick options */}
            <TabsContent value="quick" className="p-3 space-y-1.5 m-0">
              {[
                { type: 'all-due' as SRSScopeType, label: 'كل المستحقة', desc: 'جميع البطاقات المستحقة' },
                { type: 'current-page' as SRSScopeType, label: `الصفحة الحالية (${currentPage})`, desc: 'بطاقات هذه الصفحة فقط' },
                ...(showFlagged ? [{ type: 'flagged' as SRSScopeType, label: 'المُعلَّمة فقط', desc: 'البطاقات المحددة بعلامة' }] : []),
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { onChange({ type: opt.type, from: currentPage, to: currentPage }); setExpanded(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    scope.type === opt.type ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </TabsContent>

            {/* Surahs Tab */}
            <TabsContent value="surahs" className="m-0">
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="بحث عن سورة..."
                      className="h-7 text-xs pr-8"
                    />
                  </div>
                  <Button
                    variant={selectingEnd === 'to' && scope.type === 'surah' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[10px] gap-1 shrink-0"
                    onClick={() => setSelectingEnd(selectingEnd === 'from' ? 'to' : 'from')}
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {selectingEnd === 'from' ? 'اختر البداية' : 'اختر النهاية'}
                  </Button>
                </div>
                {scope.type === 'surah' && (
                  <p className="text-[10px] text-primary text-center">
                    {SURAHS.find(s => s.number === scope.from)?.name || scope.from}
                    {scope.from !== scope.to && ` → ${SURAHS.find(s => s.number === scope.to)?.name || scope.to}`}
                  </p>
                )}
              </div>
              <ScrollArea className="h-60">
                <div className="p-1.5 space-y-0.5">
                  {filteredSurahs.map(s => (
                    <button
                      key={s.number}
                      onClick={() => handleSelectItem('surah', s.number)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isEndpoint('surah', s.number) ? 'bg-primary text-primary-foreground font-bold' :
                        isInRange('surah', s.number) ? 'bg-primary/10 text-primary' :
                        'hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{s.number}</span>
                        <span>{s.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">ص {s.startPage}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Juz Tab */}
            <TabsContent value="juz" className="m-0">
              <div className="p-2 border-b border-border flex items-center justify-between">
                <Button
                  variant={selectingEnd === 'to' && scope.type === 'juz' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => setSelectingEnd(selectingEnd === 'from' ? 'to' : 'from')}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  {selectingEnd === 'from' ? 'اختر البداية' : 'اختر النهاية'}
                </Button>
                {scope.type === 'juz' && (
                  <p className="text-[10px] text-primary">
                    الجزء {scope.from}{scope.from !== scope.to ? ` → ${scope.to}` : ''}
                  </p>
                )}
              </div>
              <ScrollArea className="h-60">
                <div className="p-1.5 space-y-0.5">
                  {JUZ_DATA.map(j => (
                    <button
                      key={j.number}
                      onClick={() => handleSelectItem('juz', j.number)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isEndpoint('juz', j.number) ? 'bg-primary text-primary-foreground font-bold' :
                        isInRange('juz', j.number) ? 'bg-primary/10 text-primary' :
                        'hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{j.number}</span>
                        <span>الجزء {j.number}</span>
                        <span className="text-muted-foreground text-[10px]">({j.name})</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">ص {j.page}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Hizb Tab */}
            <TabsContent value="hizb" className="m-0">
              <div className="p-2 border-b border-border flex items-center justify-between">
                <Button
                  variant={selectingEnd === 'to' && scope.type === 'hizb' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => setSelectingEnd(selectingEnd === 'from' ? 'to' : 'from')}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  {selectingEnd === 'from' ? 'اختر البداية' : 'اختر النهاية'}
                </Button>
                {scope.type === 'hizb' && (
                  <p className="text-[10px] text-primary">
                    الحزب {scope.from}{scope.from !== scope.to ? ` → ${scope.to}` : ''}
                  </p>
                )}
              </div>
              <ScrollArea className="h-60">
                <div className="p-1.5 space-y-0.5">
                  {HIZB_DATA.map(h => (
                    <button
                      key={h.number}
                      onClick={() => handleSelectItem('hizb', h.number)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isEndpoint('hizb', h.number) ? 'bg-primary text-primary-foreground font-bold' :
                        isInRange('hizb', h.number) ? 'bg-primary/10 text-primary' :
                        'hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{h.number}</span>
                        <span>الحزب {h.number}</span>
                        <span className="text-muted-foreground text-[10px]">(ج{h.juz} - {h.half === 1 ? 'أول' : 'ثاني'})</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">ص {h.page}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Pages Tab */}
            <TabsContent value="pages" className="m-0 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">من صفحة</span>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={scope.type === 'page-range' ? scope.from : currentPage}
                  onChange={e => onChange({ type: 'page-range', from: parseInt(e.target.value) || 1, to: scope.type === 'page-range' ? scope.to : (parseInt(e.target.value) || 1) })}
                  className="h-7 w-20 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground shrink-0">إلى صفحة</span>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={scope.type === 'page-range' ? scope.to : currentPage}
                  onChange={e => onChange({ type: 'page-range', from: scope.type === 'page-range' ? scope.from : currentPage, to: parseInt(e.target.value) || 604 })}
                  className="h-7 w-20 text-xs text-center"
                />
              </div>
              {/* Page slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={1}
                  max={604}
                  value={scope.type === 'page-range' ? scope.from : currentPage}
                  onChange={e => onChange({ type: 'page-range', from: parseInt(e.target.value), to: scope.type === 'page-range' ? Math.max(parseInt(e.target.value), scope.to) : parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary"
                />
                <input
                  type="range"
                  min={1}
                  max={604}
                  value={scope.type === 'page-range' ? scope.to : currentPage}
                  onChange={e => onChange({ type: 'page-range', from: scope.type === 'page-range' ? scope.from : currentPage, to: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-primary"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Confirm button */}
          <div className="p-2 border-t border-border">
            <Button
              onClick={() => setExpanded(false)}
              className="w-full h-8 text-xs font-arabic"
              size="sm"
            >
              تأكيد ({scopeLabel(scope)}{pageCount ? ` — ${pageCount} صفحة` : ''})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
