import React, { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';

export type SRSScopeType = 'current-page' | 'page-range' | 'surah' | 'juz' | 'hizb' | 'all-due' | 'flagged';

export interface SRSScope {
  type: SRSScopeType;
  from: number;
  to: number;
}

const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name, startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

const JUZ_DATA = [
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

interface SRSScopeSelectorProps {
  scope: SRSScope;
  onChange: (scope: SRSScope) => void;
  currentPage: number;
  /** Show 'flagged' option */
  showFlagged?: boolean;
}

export function scopeToPages(scope: SRSScope): number[] | null {
  const { type, from, to } = scope;
  if (type === 'all-due' || type === 'flagged') return null;
  if (type === 'current-page') return [from]; // from = currentPage
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
    const fromJuzIdx = Math.floor((f - 1) / 2);
    const toJuzIdx = Math.floor((t - 1) / 2);
    const isSecondHalf = (f - 1) % 2 === 1;
    const toIsSecondHalf = (t - 1) % 2 === 1;
    const fromJuz = JUZ_DATA[fromJuzIdx];
    if (!fromJuz) return null;
    const startPage = isSecondHalf
      ? Math.floor((fromJuz.page + (JUZ_DATA[fromJuzIdx + 1]?.page || 605)) / 2)
      : fromJuz.page;
    let endPage: number;
    if (toIsSecondHalf) {
      endPage = (toJuzIdx + 1 < 30 ? (JUZ_DATA[toJuzIdx + 1]?.page || 605) : 605) - 1;
    } else {
      const juzEnd = JUZ_DATA[toJuzIdx + 1]?.page || 605;
      endPage = Math.floor((JUZ_DATA[toJuzIdx].page + juzEnd) / 2) - 1;
    }
    const pages: number[] = [];
    for (let p = startPage; p <= Math.min(endPage, 604); p++) pages.push(p);
    return pages;
  }
  return null;
}

export function SRSScopeSelector({ scope, onChange, currentPage, showFlagged }: SRSScopeSelectorProps) {
  const pageCount = useMemo(() => {
    const pages = scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from });
    return pages ? pages.length : null;
  }, [scope, currentPage]);

  return (
    <div className="space-y-2 font-arabic" dir="rtl">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">نطاق المحتوى</span>
        <Select value={scope.type} onValueChange={(v) => onChange({ ...scope, type: v as SRSScopeType, from: v === 'current-page' ? currentPage : scope.from })}>
          <SelectTrigger className="h-8 text-xs font-arabic flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-due">كل المستحقة</SelectItem>
            <SelectItem value="current-page">الصفحة الحالية</SelectItem>
            <SelectItem value="page-range">نطاق صفحات</SelectItem>
            <SelectItem value="surah">سورة</SelectItem>
            <SelectItem value="juz">جزء</SelectItem>
            <SelectItem value="hizb">حزب</SelectItem>
            {showFlagged && <SelectItem value="flagged">المُعلَّمة فقط</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {scope.type === 'page-range' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">من</span>
          <Input type="number" min={1} max={604} value={scope.from} onChange={e => onChange({ ...scope, from: parseInt(e.target.value) || 1 })} className="h-7 w-16 text-xs text-center" />
          <span className="text-[10px] text-muted-foreground">إلى</span>
          <Input type="number" min={1} max={604} value={scope.to} onChange={e => onChange({ ...scope, to: parseInt(e.target.value) || 604 })} className="h-7 w-16 text-xs text-center" />
        </div>
      )}

      {scope.type === 'surah' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">من</span>
          <Select value={String(scope.from)} onValueChange={v => onChange({ ...scope, from: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {SURAHS.map(s => <SelectItem key={s.number} value={String(s.number)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">إلى</span>
          <Select value={String(scope.to)} onValueChange={v => onChange({ ...scope, to: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {SURAHS.map(s => <SelectItem key={s.number} value={String(s.number)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {scope.type === 'juz' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">من</span>
          <Select value={String(scope.from)} onValueChange={v => onChange({ ...scope, from: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 30 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">إلى</span>
          <Select value={String(scope.to)} onValueChange={v => onChange({ ...scope, to: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 30 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {scope.type === 'hizb' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">من</span>
          <Select value={String(scope.from)} onValueChange={v => onChange({ ...scope, from: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 60 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">إلى</span>
          <Select value={String(scope.to)} onValueChange={v => onChange({ ...scope, to: parseInt(v) })}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 60 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {pageCount !== null && (
        <p className="text-[10px] text-muted-foreground/70 text-center">{pageCount} صفحة</p>
      )}
    </div>
  );
}
