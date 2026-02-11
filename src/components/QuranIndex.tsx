import React, { useState, useMemo } from 'react';
import { Book, Layers, Hash, Search, X, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';

interface QuranIndexProps {
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  onClose: () => void;
}

// Surah names list with numbers
const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number,
  name,
  startPage: SURAH_INFO[number]?.[0] || 1,
  verses: SURAH_INFO[number]?.[1] || 0,
})).sort((a, b) => a.number - b.number);

// Juz data - 30 parts
const JUZ_DATA = [
  { number: 1, name: 'الم', page: 1 },
  { number: 2, name: 'سيقول', page: 22 },
  { number: 3, name: 'تلك الرسل', page: 42 },
  { number: 4, name: 'لن تنالوا', page: 62 },
  { number: 5, name: 'والمحصنات', page: 82 },
  { number: 6, name: 'لا يحب الله', page: 102 },
  { number: 7, name: 'وإذا سمعوا', page: 121 },
  { number: 8, name: 'ولو أننا', page: 142 },
  { number: 9, name: 'قال الملأ', page: 162 },
  { number: 10, name: 'واعلموا', page: 182 },
  { number: 11, name: 'يعتذرون', page: 201 },
  { number: 12, name: 'وما من دابة', page: 222 },
  { number: 13, name: 'وما أبرئ', page: 242 },
  { number: 14, name: 'ربما', page: 262 },
  { number: 15, name: 'سبحان الذي', page: 282 },
  { number: 16, name: 'قال ألم', page: 302 },
  { number: 17, name: 'اقترب للناس', page: 322 },
  { number: 18, name: 'قد أفلح', page: 342 },
  { number: 19, name: 'وقال الذين', page: 362 },
  { number: 20, name: 'أمن خلق', page: 382 },
  { number: 21, name: 'اتل ما أوحي', page: 402 },
  { number: 22, name: 'ومن يقنت', page: 422 },
  { number: 23, name: 'وما لي', page: 442 },
  { number: 24, name: 'فمن أظلم', page: 462 },
  { number: 25, name: 'إليه يرد', page: 482 },
  { number: 26, name: 'حم', page: 502 },
  { number: 27, name: 'قال فما خطبكم', page: 522 },
  { number: 28, name: 'قد سمع الله', page: 542 },
  { number: 29, name: 'تبارك الذي', page: 562 },
  { number: 30, name: 'عم', page: 582 },
];

// Hizb data - 60 hizbs (each juz = 2 hizbs)
const HIZB_DATA = JUZ_DATA.flatMap((juz, idx) => {
  const nextJuzPage = idx < 29 ? JUZ_DATA[idx + 1].page : 605;
  const midPage = Math.floor((juz.page + nextJuzPage) / 2);
  return [
    { number: juz.number * 2 - 1, juz: juz.number, half: 1, page: juz.page },
    { number: juz.number * 2, juz: juz.number, half: 2, page: midPage },
  ];
});

function IndexItem({ active, onClick, number, label, subtitle, page }: {
  active: boolean; onClick: () => void; number: number; label: string; subtitle?: string; page: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-arabic transition-colors ${
        active ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground font-mono shrink-0">
          {number}
        </span>
        <span>{label}</span>
        {subtitle && <span className="text-muted-foreground text-[10px]">({subtitle})</span>}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-[10px]">ص {page}</span>
        <ChevronLeft className="w-3 h-3" />
      </div>
    </button>
  );
}

export function QuranIndex({ currentPage, onNavigateToPage, onClose }: QuranIndexProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('surahs');

  const filteredSurahs = useMemo(() => {
    if (!search.trim()) return SURAHS;
    const q = search.trim();
    return SURAHS.filter(s =>
      s.name.includes(q) || s.number.toString() === q
    );
  }, [search]);

  const handleNavigate = (page: number) => {
    onNavigateToPage(page);
    onClose();
  };

  const currentSurah = useMemo(() => {
    for (let i = SURAHS.length - 1; i >= 0; i--) {
      if (currentPage >= SURAHS[i].startPage) return SURAHS[i].number;
    }
    return 1;
  }, [currentPage]);

  const currentJuz = useMemo(() => {
    for (let i = JUZ_DATA.length - 1; i >= 0; i--) {
      if (currentPage >= JUZ_DATA[i].page) return JUZ_DATA[i].number;
    }
    return 1;
  }, [currentPage]);

  return (
    <div className="flex flex-col h-full bg-card" dir="rtl">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="font-arabic font-bold text-foreground text-sm">فهرس المصحف</h2>
        <button
          onClick={onClose}
          className="nav-button w-7 h-7 rounded-md flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 mb-1 grid grid-cols-3 h-9 shrink-0">
          <TabsTrigger value="surahs" className="text-xs font-arabic gap-1">
            <Book className="w-3 h-3" />
            السور
          </TabsTrigger>
          <TabsTrigger value="juz" className="text-xs font-arabic gap-1">
            <Layers className="w-3 h-3" />
            الأجزاء
          </TabsTrigger>
          <TabsTrigger value="hizb" className="text-xs font-arabic gap-1">
            <Hash className="w-3 h-3" />
            الأحزاب
          </TabsTrigger>
        </TabsList>

        {/* Surahs Tab */}
        <TabsContent value="surahs" className="flex-1 flex flex-col overflow-hidden mt-0 px-3">
          <div className="relative my-1.5 shrink-0">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن سورة..."
              className="h-8 text-xs font-arabic pr-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto pb-2 space-y-0.5">
            {filteredSurahs.map(surah => (
              <IndexItem
                key={surah.number}
                active={currentSurah === surah.number}
                onClick={() => handleNavigate(surah.startPage)}
                number={surah.number}
                label={surah.name}
                page={surah.startPage}
              />
            ))}
          </div>
        </TabsContent>

        {/* Juz Tab */}
        <TabsContent value="juz" className="flex-1 flex flex-col overflow-hidden mt-0 px-3">
          <div className="flex-1 overflow-y-auto pb-2 space-y-0.5">
            {JUZ_DATA.map(juz => (
              <IndexItem
                key={juz.number}
                active={currentJuz === juz.number}
                onClick={() => handleNavigate(juz.page)}
                number={juz.number}
                label={`الجزء ${juz.number}`}
                subtitle={juz.name}
                page={juz.page}
              />
            ))}
          </div>
        </TabsContent>

        {/* Hizb Tab */}
        <TabsContent value="hizb" className="flex-1 flex flex-col overflow-hidden mt-0 px-3">
          <div className="flex-1 overflow-y-auto pb-2 space-y-0.5">
            {HIZB_DATA.map(hizb => (
              <IndexItem
                key={hizb.number}
                active={currentPage >= hizb.page && (hizb.number === HIZB_DATA.length || currentPage < HIZB_DATA[hizb.number]?.page)}
                onClick={() => handleNavigate(hizb.page)}
                number={hizb.number}
                label={`الحزب ${hizb.number}`}
                subtitle={`الجزء ${hizb.juz} - ${hizb.half === 1 ? 'النصف الأول' : 'النصف الثاني'}`}
                page={hizb.page}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
