import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, Layers } from 'lucide-react';
import { getQuartersForJuz, computeQuarterMastery, computeJuzMastery, type QuranQuarter } from '@/utils/quranQuarters';
import { useSRSStore } from '@/stores/srsStore';

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

interface Props {
  /** When the user taps the Juz row itself. */
  onSelectJuz?: (juzNumber: number, page: number) => void;
  /** When the user taps a Quarter row. */
  onSelectQuarter?: (q: QuranQuarter) => void;
  /** Highlight the active juz (e.g. matching current scope). */
  activeJuz?: number;
  /** Highlight the active quarter (1..240). */
  activeQuarterGlobal?: number;
  /** Optional outer class (e.g. height). Default: max-h-72 overflow-auto */
  className?: string;
  /** Compact denser styling. */
  compact?: boolean;
}

export function JuzQuartersAccordion({
  onSelectJuz,
  onSelectQuarter,
  activeJuz,
  activeQuarterGlobal,
  className,
  compact,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(activeJuz ?? null);
  const pad = compact ? 'px-2 py-1.5' : 'px-3 py-2';
  const cards = useSRSStore((s) => s.cards);

  return (
    <div className={className ?? 'max-h-72 overflow-auto'} dir="rtl">
      <div className="space-y-1 p-1">
        {JUZ_DATA.map((juz) => {
          const isExp = expanded === juz.number;
          const isAct = activeJuz === juz.number;
          const quarters = isExp ? getQuartersForJuz(juz.number) : [];
          const juzMastery = computeJuzMastery(juz.number, cards, 'ghareeb');
          return (
            <div key={juz.number} className={`rounded-lg border ${isExp ? 'border-border' : 'border-transparent'} overflow-hidden`}>
              <div className={`flex items-stretch ${isAct ? 'bg-primary/15 text-primary font-bold' : `hover:bg-muted/60 ${juzMastery.bgClass}`}`}>
                <button
                  onClick={() => setExpanded(isExp ? null : juz.number)}
                  className={`flex-1 flex items-center gap-2 ${pad} text-xs font-arabic transition-colors`}
                  aria-expanded={isExp}
                >
                  <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0">
                    {juz.number}
                  </span>
                  <Layers className="w-3 h-3 text-muted-foreground" />
                  <span>الجزء {juz.number}</span>
                  <span className="text-muted-foreground text-[10px]">({juz.name})</span>
                  {juzMastery.level > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] ${juzMastery.textClass}`}
                      title={`${juzMastery.label} — ${juzMastery.reviewed}/${juzMastery.total}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${juzMastery.dotClass}`} />
                      {juzMastery.label}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 mr-auto transition-transform ${isExp ? 'rotate-180' : ''}`} />
                </button>
                {onSelectJuz && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectJuz(juz.number, juz.page); }}
                    className="px-2 text-[10px] text-muted-foreground hover:text-primary border-r border-border/50 font-arabic"
                  >
                    اختر الجزء
                  </button>
                )}
              </div>
              {isExp && (
                <div className="bg-muted/20 border-t border-border/50 py-1">
                  {quarters.map((q) => {
                    const isQActive = activeQuarterGlobal === q.quarter_global;
                    const m = computeQuarterMastery(q, cards, 'ghareeb');
                    return (
                      <button
                        key={q.quarter_global}
                        onClick={() => onSelectQuarter?.(q)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-arabic transition-colors ${
                          isQActive ? 'bg-primary/15 text-primary font-bold' : `hover:bg-muted/60 text-foreground/90 ${m.bgClass}`
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full ${m.level >= 2 ? m.dotClass + ' text-white' : 'bg-primary/10 text-primary'} flex items-center justify-center text-[9px] font-mono shrink-0`}>
                            {q.quarter_in_juz}
                          </span>
                          <div className="text-right min-w-0">
                            <div className="truncate">
                              الربع {q.quarter_in_juz} <span className="text-muted-foreground">({q.quarter_global})</span> — {q.surah_name} {q.ayah}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="rtl">«{q.start_words}»</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.level > 0 && (
                            <span className={`text-[9px] ${m.textClass}`} title={`${m.reviewed}/${m.total} — متوسط ${Math.round(m.avgIntervalDays)} يوم`}>
                              {m.label}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">ص {q.page}</span>
                          <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
