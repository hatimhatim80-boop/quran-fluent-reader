/**
 * Builds the memorization units (وحدات الحفظ) of a repetition session.
 *
 * A unit is either a group of ayat or a fixed number of words; word units
 * may cross an ayah boundary, in which case they carry every ayah they touch
 * so the reciter audio can play all of them.
 *
 * Quranic correctness outranks "keep playing": an ayah is NEVER guessed. If the
 * page text cannot be mapped one-to-one onto real surah/ayah references, the
 * build fails loudly instead of attaching a wrong audio file to a wrong text.
 */

import { QuranPage } from '@/types/quran';
import { AyahRef, getPageAyahRefs } from '@/utils/pageAyahRefs';
import { extractPageAyahGroups } from '@/components/TahfeezSRSPanel';

export type UnitMode = 'ayah' | 'words';

export interface MemorizationUnit {
  /** Content-derived identity — survives a change of unit size/mode. */
  stableId: string;
  index: number;
  /** Original Quranic words, untouched. */
  words: string[];
  text: string;
  /** Ayat covered by this unit — used for reciter playback. */
  refs: AyahRef[];
  page: number;
  label: string;
}

/** Thrown when page text and ayah references do not line up. */
export class AyahMappingError extends Error {
  constructor(public page: number, public groupCount: number, public refCount: number) {
    super(`ayah mapping mismatch on page ${page}: ${groupCount} groups vs ${refCount} refs`);
    this.name = 'AyahMappingError';
  }
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
    if (groups.length === 0) continue;

    let refs: AyahRef[] = [];
    try {
      refs = await getPageAyahRefs(page);
    } catch (e) {
      console.error('[memorizationUnits] page refs failed', { page }, e);
      throw new AyahMappingError(page, groups.length, 0);
    }

    if (groups.length !== refs.length) {
      console.error('[memorizationUnits] ayah mapping mismatch', {
        page,
        groupCount: groups.length,
        refCount: refs.length,
      });
      throw new AyahMappingError(page, groups.length, refs.length);
    }

    groups.forEach((group, idx) => {
      const ref = refs[idx];
      if (!ref || !ref.surah || !ref.ayah) {
        console.error('[memorizationUnits] ayah mapping mismatch', {
          page,
          groupCount: groups.length,
          refCount: refs.length,
          missingIndex: idx,
        });
        throw new AyahMappingError(page, groups.length, refs.length);
      }
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
      const label = first.ayah === last.ayah && first.surah === last.surah
        ? `الآية ${arabicNum(first.ayah)}`
        : `الآيات ${arabicNum(first.ayah)}–${arabicNum(last.ayah)}`;
      units.push({
        stableId: `a:${first.surah}:${first.ayah}-${last.surah}:${last.ayah}`,
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

  // Word mode — a flat stream of words that remembers its ayah and its
  // position inside that ayah, so a unit keeps an exact identity.
  const stream: { word: string; ref: AyahRef; page: number; posInAyah: number }[] = [];
  ayat.forEach(a => a.words.forEach((w, k) => stream.push({ word: w, ref: a.ref, page: a.page, posInAyah: k })));

  for (let i = 0; i < stream.length; i += step) {
    const chunk = stream.slice(i, i + step);
    if (chunk.length === 0) continue;
    const words = chunk.map(c => c.word);
    const head = chunk[0];
    const tail = chunk[chunk.length - 1];
    units.push({
      stableId: `w:${head.ref.surah}:${head.ref.ayah}:${head.posInAyah}-${tail.ref.surah}:${tail.ref.ayah}:${tail.posInAyah}`,
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

/**
 * Cumulative recitation text: only units the student actually approved, plus
 * the current one — never "everything before the cursor".
 */
export function cumulativeUnits(
  units: MemorizationUnit[],
  index: number,
  memorizedIds: Set<string>,
): MemorizationUnit[] {
  const out = units.filter((u, i) => i < index && memorizedIds.has(u.stableId));
  if (units[index]) out.push(units[index]);
  return out;
}

export function cumulativeText(units: MemorizationUnit[], index: number, memorizedIds: Set<string>): string {
  return cumulativeUnits(units, index, memorizedIds).map(u => u.text).join(' ');
}

export function cumulativeRefs(units: MemorizationUnit[], index: number, memorizedIds: Set<string>): AyahRef[] {
  return uniqueRefs(cumulativeUnits(units, index, memorizedIds).flatMap(u => u.refs));
}
