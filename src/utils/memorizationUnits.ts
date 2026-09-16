/** Build exact, stable memorization units without guessing Quran references. */
import { extractPageAyahGroups } from '@/components/TahfeezSRSPanel';
import { QuranPage } from '@/types/quran';
import { AyahRef, getPageAyahRefs } from '@/utils/pageAyahRefs';

export type UnitMode = 'ayah' | 'words';

interface AyahAtoms {
  ayahId: string;
  wordIds: string[];
}

export interface MemorizationUnit {
  stableId: string;
  atomIds: string[];
  ayahAtoms: AyahAtoms[];
  mode: UnitMode;
  index: number;
  words: string[];
  text: string;
  refs: AyahRef[];
  page: number;
  label: string;
}

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
  ayahId: string;
  wordIds: string[];
}

const arabicNum = (value: number) => new Intl.NumberFormat('ar-SA').format(value);
const ayahId = (ref: AyahRef) => `a:${ref.surah}:${ref.ayah}`;
const wordId = (ref: AyahRef, position: number) => `w:${ref.surah}:${ref.ayah}:${position}`;

async function collectAyat(pages: QuranPage[], startPage: number, endPage: number): Promise<AyahItem[]> {
  const items: AyahItem[] = [];
  for (let page = startPage; page <= endPage; page++) {
    const pageData = pages.find(item => item.pageNumber === page);
    if (!pageData) continue;
    const groups = extractPageAyahGroups(pageData.text, page);
    if (groups.length === 0) continue;

    let refs: AyahRef[];
    try {
      refs = await getPageAyahRefs(page);
    } catch (error) {
      console.error('[memorizationUnits] exact ayah mapping failed', { page, groupCount: groups.length, refCount: 0, error });
      throw new AyahMappingError(page, groups.length, 0);
    }

    const invalidIndex = refs.findIndex(ref => !ref?.surah || !ref?.ayah);
    if (groups.length !== refs.length || invalidIndex >= 0) {
      console.error('[memorizationUnits] exact ayah mapping failed', {
        page,
        groupCount: groups.length,
        refCount: refs.length,
        invalidIndex,
      });
      throw new AyahMappingError(page, groups.length, refs.length);
    }

    groups.forEach((group, index) => {
      const ref = refs[index];
      const words = group.map(token => token.text);
      items.push({
        page,
        ref,
        words,
        ayahId: ayahId(ref),
        wordIds: words.map((_, position) => wordId(ref, position)),
      });
    });
  }
  return items;
}

function uniqueRefs(refs: AyahRef[]): AyahRef[] {
  const seen = new Set<string>();
  return refs.filter(ref => {
    const key = `${ref.surah}:${ref.ayah}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueAyahAtoms(items: AyahItem[]): AyahAtoms[] {
  const byAyah = new Map<string, AyahAtoms>();
  items.forEach(item => byAyah.set(item.ayahId, { ayahId: item.ayahId, wordIds: item.wordIds }));
  return [...byAyah.values()];
}

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
    for (let offset = 0; offset < ayat.length; offset += step) {
      const chunk = ayat.slice(offset, offset + step);
      if (chunk.length === 0) continue;
      const refs = uniqueRefs(chunk.map(item => item.ref));
      const first = refs[0];
      const last = refs[refs.length - 1];
      units.push({
        stableId: `a:${first.surah}:${first.ayah}-${last.surah}:${last.ayah}`,
        atomIds: chunk.map(item => item.ayahId),
        ayahAtoms: uniqueAyahAtoms(chunk),
        mode,
        index: units.length,
        words: chunk.flatMap(item => item.words),
        text: chunk.flatMap(item => item.words).join(' '),
        refs,
        page: chunk[0].page,
        label: first.surah === last.surah && first.ayah === last.ayah
          ? `الآية ${arabicNum(first.ayah)}`
          : `الآيات ${arabicNum(first.ayah)}–${arabicNum(last.ayah)}`,
      });
    }
    return units;
  }

  const stream = ayat.flatMap(item => item.words.map((word, position) => ({
    word,
    ref: item.ref,
    page: item.page,
    atomId: item.wordIds[position],
    ayah: item,
    position,
  })));

  for (let offset = 0; offset < stream.length; offset += step) {
    const chunk = stream.slice(offset, offset + step);
    if (chunk.length === 0) continue;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    units.push({
      stableId: `w:${first.ref.surah}:${first.ref.ayah}:${first.position}-${last.ref.surah}:${last.ref.ayah}:${last.position}`,
      atomIds: chunk.map(item => item.atomId),
      ayahAtoms: uniqueAyahAtoms(chunk.map(item => item.ayah)),
      mode,
      index: units.length,
      words: chunk.map(item => item.word),
      text: chunk.map(item => item.word).join(' '),
      refs: uniqueRefs(chunk.map(item => item.ref)),
      page: first.page,
      label: `الكلمات ${arabicNum(offset + 1)}–${arabicNum(offset + chunk.length)}`,
    });
  }
  return units;
}

function isAyahMemorized(atoms: AyahAtoms, memorizedIds: Set<string>): boolean {
  return memorizedIds.has(atoms.ayahId)
    || (atoms.wordIds.length > 0 && atoms.wordIds.every(id => memorizedIds.has(id)));
}

export function isUnitMemorized(unit: MemorizationUnit, memorizedIds: Set<string>): boolean {
  if (unit.atomIds.length === 0) return false;
  if (unit.mode === 'ayah') return unit.ayahAtoms.every(atoms => isAyahMemorized(atoms, memorizedIds));
  const ayahByWord = new Map(unit.ayahAtoms.flatMap(atoms => atoms.wordIds.map(id => [id, atoms.ayahId] as const)));
  return unit.atomIds.every(id => memorizedIds.has(id) || memorizedIds.has(ayahByWord.get(id) || ''));
}

export function cumulativeUnits(
  units: MemorizationUnit[],
  index: number,
  memorizedIds: Set<string>,
): MemorizationUnit[] {
  const out = units.filter((unit, unitIndex) => unitIndex < index && isUnitMemorized(unit, memorizedIds));
  if (units[index]) out.push(units[index]);
  return out;
}

export function cumulativeText(units: MemorizationUnit[], index: number, memorizedIds: Set<string>): string {
  return cumulativeUnits(units, index, memorizedIds).map(unit => unit.text).join(' ');
}

export function cumulativeRefs(units: MemorizationUnit[], index: number, memorizedIds: Set<string>): AyahRef[] {
  return uniqueRefs(cumulativeUnits(units, index, memorizedIds).flatMap(unit => unit.refs));
}
