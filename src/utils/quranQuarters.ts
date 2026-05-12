/**
 * Quran "Arba'" (quarters of hizb) — 240 entries.
 * Source: pre-generated from tanzil-metadata.xml + quran-tanzil.txt at build time.
 * See public/data/quarters.json
 */
import quartersData from '@/data/quarters.json';

export interface QuranQuarter {
  quarter_global: number;     // 1..240
  juz: number;                // 1..30
  quarter_in_juz: number;     // 1..8
  hizb: number;               // 1..60
  quarter_in_hizb: number;    // 1..4
  surah: number;
  surah_name: string;
  ayah: number;
  page: number;
  start_words: string;        // first word(s) of the verse where the quarter begins
}

export const QURAN_QUARTERS: QuranQuarter[] = quartersData as QuranQuarter[];

export function getQuartersForJuz(juz: number): QuranQuarter[] {
  return QURAN_QUARTERS.filter((q) => q.juz === juz);
}

/**
 * Page range covered by a single quarter (start..end inclusive).
 * End = (next quarter's page - 1), or 604 for the last quarter.
 * Guarantees end >= start.
 */
export function getQuarterPageRange(q: QuranQuarter): { start: number; end: number } {
  const next = QURAN_QUARTERS.find((x) => x.quarter_global === q.quarter_global + 1);
  const start = q.page;
  const end = next ? Math.max(start, next.page - 1) : 604;
  return { start, end };
}

// ── Mastery coloring ────────────────────────────────────────────────────────
export interface MasteryLevel {
  level: 0 | 1 | 2 | 3 | 4 | 5; // 0 = no cards, 1 = none reviewed, 2..5 = increasing mastery
  label: string;
  // Tailwind classes for dot + bg tint (works in light/dark via /N opacity)
  dotClass: string;
  bgClass: string;
  textClass: string;
  reviewed: number;
  total: number;
  avgIntervalDays: number;
}

interface MasteryCardLike {
  type: string;
  page: number;
  interval: number;
  lastReview: number;
  archived?: boolean;
}

/**
 * Compute mastery level for a quarter from SRS ghareeb cards whose page
 * falls within the quarter's page range. Higher avg SM-2 interval ⇒ better mastery.
 */
export function computeQuarterMastery(
  q: QuranQuarter,
  cards: MasteryCardLike[],
  type: string = 'ghareeb',
): MasteryLevel {
  const { start, end } = getQuarterPageRange(q);
  const inRange = cards.filter(
    (c) => c.type === type && !c.archived && c.page >= start && c.page <= end,
  );
  const total = inRange.length;
  const reviewed = inRange.filter((c) => c.lastReview > 0);
  const avg = reviewed.length === 0 ? 0 : reviewed.reduce((s, c) => s + c.interval, 0) / reviewed.length;

  if (total === 0) {
    return { level: 0, label: 'لا توجد بطاقات', dotClass: 'bg-muted-foreground/30', bgClass: '', textClass: 'text-muted-foreground', reviewed: 0, total: 0, avgIntervalDays: 0 };
  }
  if (reviewed.length === 0) {
    return { level: 1, label: 'لم يبدأ', dotClass: 'bg-slate-400', bgClass: 'bg-slate-400/5', textClass: 'text-slate-500', reviewed: 0, total, avgIntervalDays: 0 };
  }
  if (avg < 7) {
    return { level: 2, label: 'ضعيف', dotClass: 'bg-red-500', bgClass: 'bg-red-500/10', textClass: 'text-red-600', reviewed: reviewed.length, total, avgIntervalDays: avg };
  }
  if (avg < 30) {
    return { level: 3, label: 'متوسط', dotClass: 'bg-amber-500', bgClass: 'bg-amber-500/10', textClass: 'text-amber-600', reviewed: reviewed.length, total, avgIntervalDays: avg };
  }
  if (avg < 90) {
    return { level: 4, label: 'جيد', dotClass: 'bg-lime-500', bgClass: 'bg-lime-500/10', textClass: 'text-lime-600', reviewed: reviewed.length, total, avgIntervalDays: avg };
  }
  return { level: 5, label: 'متقن', dotClass: 'bg-emerald-500', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-600', reviewed: reviewed.length, total, avgIntervalDays: avg };
}

/** Aggregate mastery for a whole juz (averages across its 8 quarters). */
export function computeJuzMastery(juz: number, cards: MasteryCardLike[], type: string = 'ghareeb'): MasteryLevel {
  const quarters = getQuartersForJuz(juz);
  const perQuarter = quarters.map((q) => computeQuarterMastery(q, cards, type));
  const total = perQuarter.reduce((s, m) => s + m.total, 0);
  const reviewed = perQuarter.reduce((s, m) => s + m.reviewed, 0);
  const weightedAvg = reviewed === 0 ? 0
    : perQuarter.reduce((s, m) => s + m.avgIntervalDays * m.reviewed, 0) / reviewed;
  // reuse buckets via a synthetic call
  const fake: QuranQuarter = { ...quarters[0], page: 1 };
  void fake;
  if (total === 0) return { level: 0, label: 'لا توجد بطاقات', dotClass: 'bg-muted-foreground/30', bgClass: '', textClass: 'text-muted-foreground', reviewed: 0, total: 0, avgIntervalDays: 0 };
  if (reviewed === 0) return { level: 1, label: 'لم يبدأ', dotClass: 'bg-slate-400', bgClass: 'bg-slate-400/5', textClass: 'text-slate-500', reviewed: 0, total, avgIntervalDays: 0 };
  if (weightedAvg < 7) return { level: 2, label: 'ضعيف', dotClass: 'bg-red-500', bgClass: 'bg-red-500/10', textClass: 'text-red-600', reviewed, total, avgIntervalDays: weightedAvg };
  if (weightedAvg < 30) return { level: 3, label: 'متوسط', dotClass: 'bg-amber-500', bgClass: 'bg-amber-500/10', textClass: 'text-amber-600', reviewed, total, avgIntervalDays: weightedAvg };
  if (weightedAvg < 90) return { level: 4, label: 'جيد', dotClass: 'bg-lime-500', bgClass: 'bg-lime-500/10', textClass: 'text-lime-600', reviewed, total, avgIntervalDays: weightedAvg };
  return { level: 5, label: 'متقن', dotClass: 'bg-emerald-500', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-600', reviewed, total, avgIntervalDays: weightedAvg };
}

