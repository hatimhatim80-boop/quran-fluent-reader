/**
 * صفحة المصحف داخل جلسة الحفظ بالتكرار.
 *
 * لا تُعيد بناء نص المصحف ولا تصميمه: تعرض مكوّن الصفحة الموجود أصلًا
 * (PageView) كما هو، ثم تضع فوق كلماته حالات الحفظ (محفوظة / الوحدة الحالية /
 * قادمة / الآية التي تُتلى الآن) عبر أصناف CSS دون تحريك أي كلمة أو سطر.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageView } from '@/components/PageView';
import { extractPageAyahGroups } from '@/components/TahfeezSRSPanel';
import { QuranPage } from '@/types/quran';
import { AyahRef, getPageAyahRefs } from '@/utils/pageAyahRefs';

export type UpcomingVisibility = 'hidden' | 'next' | 'all';

/** نفس تنظيف الرموز المستعمل في استخراج مجموعات الآيات. */
const CLEAN_RE = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

interface Props {
  page: QuranPage;
  /** ذرات الوحدة الحالية (a:surah:ayah أو w:surah:ayah:pos) */
  currentAtomIds: string[];
  /** ذرات الوحدة التالية — تُستخدم مع خيار "الوحدة التالية فقط" */
  nextAtomIds: string[];
  memorizedIds: Set<string>;
  upcomingVisibility: UpcomingVisibility;
  /** إخفاء نص الوحدة الحالية أثناء التسميع */
  hideCurrent: boolean;
  /** الآية التي تُتلى الآن */
  playingRef: AyahRef | null;
  /** كلمات التسميع التي طابقت النص القرآني الأصلي */
  recitedWordIds?: Set<string>;
  /** الكلمة القرآنية المنتظرة حاليًا أثناء التسميع */
  recitationCurrentWordId?: string | null;
}

const atomKeys = (ids: string[]) => new Set(ids);

export function MemorizationMushafPage({
  page,
  currentAtomIds,
  nextAtomIds,
  memorizedIds,
  upcomingVisibility,
  hideCurrent,
  playingRef,
  recitedWordIds,
  recitationCurrentWordId,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [refs, setRefs] = useState<AyahRef[] | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefs(null);
    setMapError(false);
    getPageAyahRefs(page.pageNumber)
      .then(list => { if (!cancelled) setRefs(list); })
      .catch(error => {
        console.error('[memorization] page ayah refs failed', page.pageNumber, error);
        if (!cancelled) setMapError(true);
      });
    return () => { cancelled = true; };
  }, [page.pageNumber]);

  const groups = useMemo(
    () => extractPageAyahGroups(page.text, page.pageNumber),
    [page.text, page.pageNumber],
  );

  const currentSet = useMemo(() => atomKeys(currentAtomIds), [currentAtomIds]);
  const nextSet = useMemo(() => atomKeys(nextAtomIds), [nextAtomIds]);

  const decorate = useCallback(() => {
    const root = wrapperRef.current;
    if (!root || !refs) return;
    if (groups.length !== refs.length) {
      console.error('[memorization] mushaf overlay skipped — ayah mapping mismatch', {
        page: page.pageNumber, groups: groups.length, refs: refs.length,
      });
      return;
    }

    const all = Array.from(root.querySelectorAll<HTMLElement>('.quran-word'));
    const words = all.filter(el => {
      if (el.closest('.surah-header')) return false;
      // في الفاتحة تُعدّ البسملة آية، وفي غيرها ليست جزءًا من الآيات.
      if (page.pageNumber !== 1 && el.closest('.bismillah')) return false;
      const clean = (el.textContent || '').replace(CLEAN_RE, '').trim();
      if (!clean) return false;
      return !/^[٠-٩0-9۰-۹]+$/.test(clean);
    });

    const expected = groups.reduce((sum, group) => sum + group.length, 0);
    if (words.length !== expected) {
      console.error('[memorization] mushaf overlay skipped — word count mismatch', {
        page: page.pageNumber, dom: words.length, expected,
      });
      return;
    }

    let cursor = 0;
    groups.forEach((group, groupIndex) => {
      const ref = refs[groupIndex];
      const ayahAtom = `a:${ref.surah}:${ref.ayah}`;
      const isPlaying = !!playingRef && playingRef.surah === ref.surah && playingRef.ayah === ref.ayah;

      group.forEach((_token, position) => {
        const el = words[cursor++];
        const wordAtom = `w:${ref.surah}:${ref.ayah}:${position}`;
        const memorized = memorizedIds.has(ayahAtom) || memorizedIds.has(wordAtom);
        const current = currentSet.has(ayahAtom) || currentSet.has(wordAtom);
        const upNext = !current && (nextSet.has(ayahAtom) || nextSet.has(wordAtom));

        el.classList.add('memo-word');
        el.classList.toggle('memo-memorized', memorized && !current);
        el.classList.toggle('memo-current', current);
        el.classList.toggle('memo-playing', isPlaying);
        el.classList.toggle('memo-hidden-text', current && hideCurrent);
        el.classList.toggle('memo-recited', current && !!recitedWordIds?.has(wordAtom));
        el.classList.toggle('memo-recitation-current', current && recitationCurrentWordId === wordAtom);

        const upcoming = !memorized && !current;
        const dim = upcoming && (upcomingVisibility === 'all' || (upcomingVisibility === 'next' && upNext));
        const blur = upcoming && !dim;
        el.classList.toggle('memo-dim', dim);
        el.classList.toggle('memo-veiled', blur);

        el.dataset.memoAyah = `${ref.surah}:${ref.ayah}`;
      });
    });
  }, [refs, groups, page.pageNumber, memorizedIds, currentSet, nextSet, hideCurrent, upcomingVisibility, playingRef, recitedWordIds, recitationCurrentWordId]);

  /* إعادة التلوين بعد كل رسم للصفحة (تغيير الخط/الإعدادات يعيد بناء الكلمات) */
  useEffect(() => {
    decorate();
    const root = wrapperRef.current;
    if (!root) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(decorate);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [decorate]);

  /* إبقاء الوحدة الحالية ظاهرة على الشاشة */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = wrapperRef.current?.querySelector<HTMLElement>('.memo-current');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentAtomIds, page.pageNumber]);

  /* نفس نمط Study Noor: تتبع الكلمة الحالية والتمرير إليها عند الحاجة. */
  useEffect(() => {
    if (!recitationCurrentWordId) return;
    const frame = requestAnimationFrame(() => {
      const el = wrapperRef.current?.querySelector<HTMLElement>('.memo-recitation-current');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [recitationCurrentWordId]);

  return (
    <div ref={wrapperRef} className="memo-mushaf" data-page={page.pageNumber}>
      {mapError && (
        <p className="font-arabic text-xs text-destructive px-2 pb-1">
          تعذّر تحديد أرقام آيات هذه الصفحة بدقة، فعُرضت الصفحة بدون تمييز.
        </p>
      )}
      <PageView
        page={page}
        ghareebWords={[]}
        highlightedWordIndex={-1}
        meaningEnabled={false}
        disablePopover
        onWordClick={() => {}}
      />
    </div>
  );
}
