import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  KFGQPC_RECITERS,
  CDN_RECITERS,
  AyahDownloadJob,
  DownloadProgress,
  DownloadPackageState,
  countLocal,
  clearReciter,
  missingAyat,
  readPackageState,
  getReciter,
  narrationName,
  providerName,
} from '@/services/quranAudio';
import {
  PackageDownloadJob,
  PackageProgress,
  PackageState,
  buildPackage,
  getPackageUrl,
  setPackageUrl,
  readPackageDownloadState,
} from '@/services/audioPackages';
import { isNativeStorage } from '@/services/audioStorage';
import { getPageAyahRefs, AyahRef } from '@/utils/pageAyahRefs';

interface QuranAudioManagerProps {
  /** Pages covered by the current session — the scope shown as "downloaded". */
  pages: number[];
  reciterId: string;
  onReciterChange: (id: string) => void;
}

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} م.ب`;

/** إدارة التلاوة الصوتية — تنزيل التلاوة إلى الجهاز للعمل بدون إنترنت. */
export function QuranAudioManager({ pages, reciterId, onReciterChange }: QuranAudioManagerProps) {
  const reciter = getReciter(reciterId);
  const isPackage = reciter.kind === 'package';

  const [cached, setCached] = useState(0);
  const [ayahProgress, setAyahProgress] = useState<DownloadProgress | null>(null);
  const [ayahSaved, setAyahSaved] = useState<DownloadPackageState | null>(null);
  const [pkgProgress, setPkgProgress] = useState<PackageProgress | null>(null);
  const [pkgState, setPkgState] = useState<PackageState | null>(null);
  const [pkgUrl, setPkgUrlInput] = useState('');
  const [busy, setBusy] = useState(false);

  const ayahJobRef = useRef<AyahDownloadJob | null>(null);
  const pkgJobRef = useRef<PackageDownloadJob | null>(null);

  const collectRefs = useCallback(async (): Promise<AyahRef[]> => {
    const uniq = Array.from(new Set(pages)).sort((a, b) => a - b);
    const out: AyahRef[] = [];
    for (const pg of uniq) out.push(...(await getPageAyahRefs(pg)));
    return out;
  }, [pages]);

  /** Always checks the real files on the device, never a stale counter. */
  const refresh = useCallback(async () => {
    const refs = await collectRefs();
    setCached(await countLocal(reciterId, refs));
    setAyahSaved(await readPackageState(reciterId));
    const saved = await readPackageDownloadState(`${reciter.provider}-${reciter.id}-${reciter.narration}`);
    setPkgState(saved);
    const url = await getPackageUrl(reciterId);
    setPkgUrlInput(url || saved?.url || '');
  }, [collectRefs, reciterId, reciter]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { ayahJobRef.current?.cancel(); pkgJobRef.current?.cancel(); }, []);

  // ── Official package download ─────────────────────────────────────────────
  const startPackage = useCallback(async () => {
    const url = pkgUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('الصق رابط التنزيل الرسمي من صفحة المجمع أولًا');
      return;
    }
    setBusy(true);
    try {
      await setPackageUrl(reciterId, url);
      const pkg = buildPackage(reciter, providerName(reciter), url);
      const previous = await readPackageDownloadState(pkg.id);
      const job = new PackageDownloadJob(pkg, p => setPkgProgress(p), previous);
      pkgJobRef.current = job;
      const final = await job.run();
      pkgJobRef.current = null;
      setPkgState(final);
      await refresh();
      if (final.status === 'ready') toast.success('اكتملت التلاوة وتم التحقق من ملفاتها');
      else if (final.status === 'paused') toast.info('تم إيقاف التنزيل — يمكنك متابعته لاحقًا');
      else if (final.status === 'incomplete') toast.warning(`نقص ${final.missing.length} ملف آية`);
      else if (final.status === 'error') toast.error(`تعذّر التنزيل: ${final.error || ''}`);
    } finally {
      setBusy(false);
    }
  }, [pkgUrl, reciter, reciterId, refresh]);

  // ── Per-ayah download (CDN reciters) ──────────────────────────────────────
  const startAyahs = useCallback(async (onlyMissing: boolean) => {
    if (ayahJobRef.current) return;
    setBusy(true);
    try {
      let refs = await collectRefs();
      if (refs.length === 0) { toast.info('لا توجد آيات في نطاق الجلسة'); return; }
      if (onlyMissing) {
        refs = await missingAyat(reciterId, refs);
        if (refs.length === 0) { toast.success('جميع الملفات مكتملة'); return; }
      }
      const previous = await readPackageState(reciterId);
      const job = new AyahDownloadJob(reciterId, refs, p => setAyahProgress(p), previous);
      ayahJobRef.current = job;
      await job.run();
      ayahJobRef.current = null;
      await refresh();
      toast.success('انتهى التحميل');
    } finally {
      setBusy(false);
    }
  }, [collectRefs, reciterId, refresh]);

  const ayahPct = ayahProgress && ayahProgress.total > 0
    ? (ayahProgress.done + ayahProgress.failed) / ayahProgress.total * 100 : 0;
  const pkgPct = pkgProgress && pkgProgress.totalBytes > 0
    ? (pkgProgress.downloadedBytes / pkgProgress.totalBytes) * 100 : 0;
  const remaining = ayahSaved ? Math.max(ayahSaved.refs.length - ayahSaved.done.length, 0) : 0;

  const reciterButton = (r: typeof reciter) => (
    <Button
      key={r.id}
      size="sm"
      variant={reciterId === r.id ? 'default' : 'outline'}
      className="text-[11px] h-7 px-2.5 font-arabic"
      onClick={() => onReciterChange(r.id)}
    >
      {r.name} — {narrationName(r)}
    </Button>
  );

  return (
    <div className="space-y-2.5 rounded-lg border border-border p-2.5 font-arabic" dir="rtl">
      <p className="text-xs font-bold text-foreground">إدارة التلاوة الصوتية</p>

      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">تلاوات مجمع الملك فهد لطباعة المصحف الشريف</p>
        <div className="flex flex-wrap gap-1.5">{KFGQPC_RECITERS.map(reciterButton)}</div>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">تلاوات آية بآية من مصادر أخرى</p>
        <div className="flex flex-wrap gap-1.5">{CDN_RECITERS.map(reciterButton)}</div>
      </div>

      <div className="rounded-md bg-muted/40 p-2 space-y-0.5">
        <p className="text-[11px] text-foreground">القارئ: {reciter.name}</p>
        <p className="text-[11px] text-foreground">الرواية: {narrationName(reciter)}</p>
        <p className="text-[11px] text-foreground">المصدر: {providerName(reciter)}</p>
        {reciter.sizeLabel && <p className="text-[11px] text-foreground">حجم الحزمة: {reciter.sizeLabel}</p>}
        <p className="text-[11px] text-muted-foreground">
          المحفوظ فعليًا على الجهاز لنطاق الجلسة: <span className="text-primary font-bold">{cached}</span> آية
          {isNativeStorage() ? ' (تخزين داخلي دائم)' : ''}
        </p>
        {isPackage && pkgState && (
          <p className="text-[11px] text-muted-foreground">
            حالة الحزمة: {pkgState.status === 'ready' ? 'مكتملة ومُتحقَّق منها'
              : pkgState.status === 'incomplete' ? `ناقصة (${pkgState.missing.length} آية)`
              : pkgState.status === 'paused' ? `متوقفة عند ${mb(pkgState.downloadedBytes)}`
              : pkgState.status}
            {pkgState.supportsRange === false ? ' · الخادم لا يدعم الاستكمال بالبايت' : ''}
          </p>
        )}
      </div>

      {isPackage ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            نزّل حزمة «المصحف كاملاً آيات» الرسمية من صفحة المجمع، ثم الصق رابط التنزيل هنا.
          </p>
          <div className="flex gap-1.5">
            <Input
              value={pkgUrl}
              onChange={e => setPkgUrlInput(e.target.value)}
              placeholder="رابط حزمة الآيات الرسمية"
              className="h-7 text-[11px] font-arabic"
              dir="ltr"
            />
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-7 px-2.5 font-arabic shrink-0"
              onClick={() => window.open(reciter.pageUrl, '_blank', 'noopener')}
            >
              صفحة المجمع
            </Button>
          </div>
          {pkgProgress && (
            <div className="space-y-1">
              <Progress value={pkgPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                {pkgProgress.phase === 'extract' ? `فك الحزمة… ${pkgProgress.extracted} آية`
                  : `${mb(pkgProgress.downloadedBytes)}${pkgProgress.totalBytes ? ` / ${mb(pkgProgress.totalBytes)}` : ''}`}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={startPackage} disabled={busy}>
              {pkgState && pkgState.downloadedBytes > 0 && pkgState.status !== 'ready' ? 'متابعة التنزيل' : 'تحميل التلاوة'}
            </Button>
            {busy && (
              <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => pkgJobRef.current?.pause()}>
                إيقاف مؤقت
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-7 px-2.5 font-arabic text-destructive"
              onClick={async () => {
                if (!confirm('حذف تلاوة هذا القارئ من الجهاز؟')) return;
                await clearReciter(reciterId, await collectRefs());
                await refresh();
                toast.success('تم الحذف');
              }}
            >
              حذف التلاوة
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {remaining > 0 && !ayahProgress && (
            <p className="text-[11px] text-amber-600">
              يوجد تنزيل غير مكتمل: متبقٍ {remaining} آية — اضغط «إصلاح الناقص» للمتابعة.
            </p>
          )}
          {ayahProgress && (
            <div className="space-y-1">
              <Progress value={ayahPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                {ayahProgress.done} / {ayahProgress.total}
                {ayahProgress.failed > 0 ? ` · فشل ${ayahProgress.failed}` : ''}
                {ayahProgress.paused ? ' · متوقف مؤقتًا' : ''}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => startAyahs(false)} disabled={busy}>
              تحميل تلاوة الجلسة
            </Button>
            {ayahJobRef.current && (
              ayahProgress?.paused ? (
                <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => ayahJobRef.current?.resume()}>
                  متابعة
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => ayahJobRef.current?.pause()}>
                  إيقاف مؤقت
                </Button>
              )
            )}
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => startAyahs(true)} disabled={busy}>
              إصلاح الناقص
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-7 px-2.5 font-arabic text-destructive"
              onClick={async () => {
                if (!confirm('حذف تلاوة هذا القارئ من الجهاز؟')) return;
                await clearReciter(reciterId, await collectRefs());
                await refresh();
                toast.success('تم الحذف');
              }}
            >
              حذف التلاوة
            </Button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70">
        تُحفظ ملفات التلاوة داخل تخزين التطبيق عند الطلب فقط، ولا تُضمَّن في التطبيق، وتبقى بعد إغلاقه وتحديثه.
      </p>
    </div>
  );
}
