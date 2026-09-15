import { loadTanzilPageIndex } from '@/utils/tanzilPageIndex';
import { VERSE_COUNTS } from '@/utils/pageAssemblyModel';

export interface AyahRef {
  surah: number;
  ayah: number;
}

const cache = new Map<number, AyahRef[]>();

/**
 * Returns the ordered list of ayat that START on the given mushaf page.
 * The order matches `extractPageAyahGroups` (one group per ayah marker),
 * so `ayahIndex` from a tahfeez card maps directly onto this array.
 */
export async function getPageAyahRefs(pageNumber: number): Promise<AyahRef[]> {
  const cached = cache.get(pageNumber);
  if (cached) return cached;

  const pageIndex = await loadTanzilPageIndex();
  const start = pageIndex[pageNumber - 1];
  if (!start) return [];
  const next = pageNumber < pageIndex.length ? pageIndex[pageNumber] : null;

  const refs: AyahRef[] = [];
  let surah = start[0];
  let ayah = start[1];

  while (surah <= 114) {
    if (next) {
      const [ns, na] = next;
      if (surah > ns || (surah === ns && ayah >= na)) break;
    }
    refs.push({ surah, ayah });
    ayah++;
    const max = VERSE_COUNTS[surah] || 0;
    if (ayah > max) {
      surah++;
      ayah = 1;
    }
    if (!next && refs.length > 120) break;
  }

  cache.set(pageNumber, refs);
  return refs;
}

/**
 * The ayah immediately before the given one.
 * Crossing into the previous surah only happens when it is asked for
 * explicitly (`crossSurah`); otherwise the first ayah of a surah simply has
 * no "previous ayah".
 */
export function previousAyahRef(ref: AyahRef, crossSurah = false): AyahRef | null {
  if (ref.ayah > 1) return { surah: ref.surah, ayah: ref.ayah - 1 };
  if (!crossSurah) return null;
  if (ref.surah <= 1) return null;
  const prevSurah = ref.surah - 1;
  const count = VERSE_COUNTS[prevSurah] || 0;
  if (!count) return null;
  return { surah: prevSurah, ayah: count };
}
