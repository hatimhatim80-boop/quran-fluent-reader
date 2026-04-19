/**
 * Shared, strict line-type detectors for Quran text.
 *
 * IMPORTANT: `isBismillahLine` matches ONLY the standalone chapter-separator
 * "بسم الله الرحمن الرحيم" — not any line that merely contains the substring
 * "بسم الله". This prevents Surah Hud verse 41
 *   ﴿بِسْمِ ٱللَّهِ مَجْر۪ىٰهَا وَمُرْسَىٰهَا﴾
 * from being mis-classified as a chapter separator (which would otherwise
 * cause it to render as a centered header outside the wrap flow and to be
 * skipped from quiz tokenization / blanking).
 */
import { normalizeArabic } from './quranParser';

export function isSurahHeaderLine(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

/**
 * Strict bismillah check — true only when the trimmed line is the full
 * basmala used as a chapter separator, with no other Quranic words around it.
 * Verse-number markers and waqf marks are tolerated.
 */
export function isBismillahLine(line: string): boolean {
  if (!line) return false;
  const normalized = normalizeArabic(line)
    // strip verse numbers & arabic-indic digits
    .replace(/[٠-٩0-9۰-۹]/g, '')
    // strip Quranic punctuation/marks that may remain
    .replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Accept full and short forms but require EXACT match (no extra words after).
  return (
    normalized === 'بسم الله الرحمن الرحيم' ||
    normalized === 'بسم الله الرحمان الرحيم'
  );
}
