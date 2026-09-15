import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  RECITERS,
  AyahDownloadJob,
  DownloadProgress,
  countLocal,
  clearReciter,
  missingAyat,
} from '@/services/quranAudio';
import { getPageAyahRefs, AyahRef } from '@/utils/pageAyahRefs';

interface QuranAudioManagerProps {
  /** Pages covered by the current session — the default download scope. */
  pages: number[];
  reciterId: string;
  onReciterChange: (id: string) => void;
}

/** إدارة التلاوة الصوتية — تنزيل ملفات الآيات للعمل بدون إنترنت. */
export function QuranAudioManager({ pages, reciterId, onReciterChange }: QuranAudioManagerProps) {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [cached, setCached] = useState(0);
  const jobRef = useRef<AyahDownloadJob | null>(null);

  const refreshCount = useCallback(() => {
    countLocal(reciterId).then(setCached);
  }, [reciterId]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  useEffect(() => () => { jobRef.current?.cancel(); }, []);

  const collectRefs = useCallback(async (): Promise<AyahRef[]> => {
    const uniq = Array.from(new Set(pages)).sort((a, b) => a - b);
    const out: AyahRef[] = [];
    for (const pg of uniq) out.push(...(await getPageAyahRefs(pg)));
    return out;
  }, [pages]);

  const start = useCallback(async (onlyMissing: boolean) => {
    if (jobRef.current) return;
    let refs = await collectRefs();
    if (refs.length === 0) { toast.info('لا توجد آيات في نطاق الجلسة'); return; }
    if (onlyMissing) {
      refs = await missingAyat(reciterId, refs);
      if (refs.length === 0) { toast.success('جميع الملفات مكتملة'); return; }
    }
    const job = new AyahDownloadJob(reciterId, refs, p => setProgress(p));
    jobRef.current = job;
    await job.run();
    jobRef.current = null;
    refreshCount();
    toast.success('انتهى التحميل');
  }, [collectRefs, reciterId, refreshCount]);

  const pct = progress && progress.total > 0 ? (progress.done + progress.failed) / progress.total * 100 : 0;

  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5 font-arabic" dir="rtl">
      <p className="text-xs font-bold text-foreground">إدارة التلاوة الصوتية</p>

      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">القارئ (حفص عن عاصم)</p>
        <div className="flex flex-wrap gap-1.5">
          {RECITERS.map(r => (
            <Button
              key={r.id}
              size="sm"
              variant={reciterId === r.id ? 'default' : 'outline'}
              className="text-[11px] h-7 px-2.5 font-arabic"
              onClick={() => onReciterChange(r.id)}
            >
              {r.name}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        الملفات المحفوظة على الجهاز: <span className="text-primary font-bold">{cached}</span> آية
      </p>

      {progress && (
        <div className="space-y-1">
          <Progress value={pct} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">
            {progress.done} / {progress.total}
            {progress.failed > 0 ? ` · فشل ${progress.failed}` : ''}
            {progress.paused ? ' · متوقف مؤقتًا' : ''}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => start(false)} disabled={!!jobRef.current}>
          تحميل تلاوة الجلسة
        </Button>
        {jobRef.current && (
          progress?.paused ? (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => jobRef.current?.resume()}>
              متابعة
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => jobRef.current?.pause()}>
              إيقاف مؤقت
            </Button>
          )
        )}
        {jobRef.current && (
          <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic text-destructive" onClick={() => { jobRef.current?.cancel(); jobRef.current = null; setProgress(null); }}>
            إلغاء
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic" onClick={() => start(true)} disabled={!!jobRef.current}>
          إصلاح الناقص
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-[11px] h-7 px-2.5 font-arabic text-destructive"
          onClick={async () => {
            if (!confirm('حذف تلاوة هذا القارئ من الجهاز؟')) return;
            await clearReciter(reciterId);
            refreshCount();
            toast.success('تم الحذف');
          }}
        >
          حذف التلاوة
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        تُحفظ ملفات التلاوة داخل الجهاز عند الطلب فقط، ولا تُضمَّن في التطبيق.
      </p>
    </div>
  );
}
