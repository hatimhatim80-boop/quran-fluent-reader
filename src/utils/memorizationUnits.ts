/**
 * Builds the memorization units (وحدات الحفظ) of a repetition session.
 *
 * A unit is either a group of ayat or a fixed number of words; word units
 * may cross an ayah boundary, in which case they carry every ayah they touch
 * so the reciter audio can play all of them.
 */

import { QuranPage } from '@/types/quran';
import { AyahRef, getPageAyahRefs } from '@/utils/pageAyahRefs';
import { extractPageAyahGroups } from '@/components/TahfeezSRSPanel';

export type UnitMode = 'ayah' | 'words';

export interface MemorizationUnit {
  id: string;
  index: number;
  /** Original Quranic words, untouched. */
  words: string[];
  text: string;
  /** Ayat covered by this unit — used for reciter playback. */
  refs: AyahRef[];
  page: number;
  label: string;
}

interface AyahItem {
  page: number;
  ref: AyahRef;
  words: string[];
}

async function collectAyat(pages: QuranPage[], startPage: number, endPage: number): Promise<AyahItem[]> {
  const items: AyahItem[] = [];
  for (let page = startPage; page <= endPage; page++) {
    const pageData = pages.find(p => p.pageNumber === page);
    if (!pageData) continue;
    const groups = extractPageAyahGroups(pageData.text, page);
    let refs: AyahRef[] = [];
    try {
      refs = await getPageAyahRefs(page);
    } catch (e) {
      console.error('[memorizationUnits] page refs failed', page, e);
    }
    groups.forEach((group, idx) => {
      const ref = refs[idx] || refs[refs.length - 1] || { surah: 0, ayah: 0 };
      items.push({ page, ref, words: group.map(t => t.text) });
    });
  }
  return items;
}

function uniqueRefs(refs: AyahRef[]): AyahRef[] {
  const seen = new Set<string>();
  const out: AyahRef[] = [];
  for (const r of refs) {
    const k = `${r.surah}:${r.ayah}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

const arabicNum = (n: number) => new Intl.NumberFormat('ar-SA').format(n);

export async function buildMemorizationUnits(
  pages: QuranPage[],
  startPage: number,
  endPage: number,
  mode: UnitMode,
  size: number,
): Promise<MemorizationUnit[]> {
  const step = Math.max(1, Math.floor(size) || 1);
  const ayat = await collectAyat(pages, startPage, Math.max(startPage, endPage));
  const units: MemorizationUnit[] = [];

  if (mode === 'ayah') {
    for (let i = 0; i < ayat.length; i += step) {
      const chunk = ayat.slice(i, i + step);
      if (chunk.length === 0) continue;
      const words = chunk.flatMap(c => c.words);
      const refs = uniqueRefs(chunk.map(c => c.ref));
      const first = refs[0];
      const last = refs[refs.length - 1];
      const label = refs.length === 0
        ? `وحدة ${arabicNum(units.length + 1)}`
        : first.ayah === last.ayah && first.surah === last.surah
          ? `الآية ${arabicNum(first.ayah)}`
          : `الآيات ${arabicNum(first.ayah)}–${arabicNum(last.ayah)}`;
      units.push({
        id: `u_${units.length}`,
        index: units.length,
        words,
        text: words.join(' '),
        refs,
        page: chunk[0].page,
        label,
      });
    }
    return units;
  }

  // Word mode — a flat stream of words that remembers its ayah.
  const stream: { word: string; ref: AyahRef; page: number }[] = [];
  ayat.forEach(a => a.words.forEach(w => stream.push({ word: w, ref: a.ref, page: a.page })));

  for (let i = 0; i < stream.length; i += step) {
    const chunk = stream.slice(i, i + step);
    if (chunk.length === 0) continue;
    const words = chunk.map(c => c.word);
    units.push({
      id: `u_${units.length}`,
      index: units.length,
      words,
      text: words.join(' '),
      refs: uniqueRefs(chunk.map(c => c.ref)),
      page: chunk[0].page,
      label: `الكلمات ${arabicNum(i + 1)}–${arabicNum(i + chunk.length)}`,
    });
  }
  return units;
}

/** Text of every memorized unit up to and including `index` (cumulative mode). */
export function cumulativeText(units: MemorizationUnit[], index: number): string {
  return units.slice(0, index + 1).map(u => u.text).join(' ');
}

export function cumulativeRefs(units: MemorizationUnit[], index: number): AyahRef[] {
  return uniqueRefs(units.slice(0, index + 1).flatMap(u => u.refs));
}
