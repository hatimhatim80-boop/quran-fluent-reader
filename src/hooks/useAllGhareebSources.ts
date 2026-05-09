import { useEffect, useMemo, useState } from 'react';
import { GhareebWord } from '@/types/quran';
import { loadGhareebData } from '@/utils/ghareebLoader';

export type MeaningSource = 'muyassar' | 'duroobi' | 'both';

/** Internal source key used by ghareebLoader for "كتاب دروبي" book. */
const DUROOBI_INTERNAL_KEY = 'new' as const;

export const MEANING_SOURCE_LABELS: Record<MeaningSource, string> = {
  muyassar: 'الميسّر في غريب القرآن',
  duroobi: 'كتاب دروبي',
  both: 'كلا المصدرين',
};

/**
 * Loads ghareeb words from BOTH sources merged together (independent of the
 * user's global source preference) so the Meaning-Quiz setup can offer
 * per-quiz source selection.
 *
 * Returned `allWords` carries `availableSources` and `meaningsBySource` so
 * callers can filter and pick the meaning corresponding to the chosen source.
 */
export function useAllGhareebSources() {
  const [allWords, setAllWords] = useState<GhareebWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadGhareebData({ sourceMode: 'both', sharedMeaningMode: 'both' })
      .then((map) => {
        if (!mounted) return;
        const flat: GhareebWord[] = [];
        map.forEach((words) => words.forEach((w) => flat.push(w)));
        setAllWords(flat);
      })
      .catch((e) => {
        console.warn('[useAllGhareebSources] load failed', e);
        if (mounted) setAllWords([]);
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { allWords, isLoading };
}

/**
 * Filter a flat ghareeb word list by the chosen meaning source, and project
 * each word so that its `meaning` field corresponds to the chosen source.
 *
 * - 'muyassar' → only words available in Muyassar; meaning = Muyassar meaning.
 * - 'duroobi'  → only words available in Duroobi (internal key 'new');
 *                meaning = Duroobi meaning.
 * - 'both'     → all words; meaning falls back to combined string.
 */
export function filterWordsByMeaningSource(
  words: GhareebWord[],
  source: MeaningSource,
): GhareebWord[] {
  if (!words.length) return words;
  if (source === 'both') return words;
  const internalKey = source === 'muyassar' ? 'muyassar' : DUROOBI_INTERNAL_KEY;
  const out: GhareebWord[] = [];
  for (const w of words) {
    const m = w.meaningsBySource?.[internalKey];
    if (!m) continue;
    out.push({
      ...w,
      meaning: m,
      source: internalKey,
      availableSources: [internalKey],
    });
  }
  return out;
}

export function getSourceLabelForWord(w: GhareebWord): string | null {
  const av = w.availableSources || [];
  if (av.length === 0) return null;
  if (av.length === 1) {
    return av[0] === 'muyassar' ? MEANING_SOURCE_LABELS.muyassar : MEANING_SOURCE_LABELS.duroobi;
  }
  return MEANING_SOURCE_LABELS.both;
}

export { DUROOBI_INTERNAL_KEY };
