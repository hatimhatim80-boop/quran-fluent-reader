/** On-device microphone/recitation diagnostics — proves what the phone actually does. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  getSpeechProvider, runSpeechDiagnostics, type QuranSpeechRecognitionProvider,
  type SpeechDiagnostics, type MicState,
} from '@/services/speechRecognition';

export default function SpeechDiag() {
  const [report, setReport] = useState<SpeechDiagnostics | null>(null);
  const [state, setState] = useState<MicState>('idle');
  const [partial, setPartial] = useState('');
  const [final, setFinal] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const providerRef = useRef<QuranSpeechRecognitionProvider | null>(null);

  const append = (line: string) => setLog(prev => [`${new Date().toLocaleTimeString('ar')} — ${line}`, ...prev].slice(0, 60));

  useEffect(() => {
    void (async () => {
      providerRef.current = await getSpeechProvider();
      append(`المزوّد: ${providerRef.current.id}`);
    })();
    return () => { void providerRef.current?.dispose(); };
  }, []);

  const check = async () => {
    append('بدء الفحص…');
    try { setReport(await runSpeechDiagnostics()); append('انتهى الفحص'); }
    catch (error) { append(`فشل الفحص: ${String(error)}`); }
  };

  const start = async () => {
    const provider = providerRef.current || (await getSpeechProvider());
    providerRef.current = provider;
    setPartial(''); setFinal('');
    append('طلب بدء الاستماع…');
    const ok = await provider.startListening('ar-SA', {
      onPartialResult: text => { setPartial(text); },
      onFinalResult: text => { setFinal(text); append(`النتيجة النهائية (${text.length} حرفًا)`); },
      onStateChange: next => { setState(next); append(`الحالة: ${next}`); },
      onError: (message, technical) => append(`خطأ: ${message} ${technical ? JSON.stringify(technical) : ''}`),
    });
    append(ok ? 'تم إرسال أمر البدء' : 'رفض أمر البدء');
  };

  const stop = async () => { append('طلب الإيقاف…'); await providerRef.current?.stopListening(); };

  const rows: [string, string][] = report ? [
    ['المنصة', report.platform],
    ['تطبيق أصلي', report.native ? 'نعم' : 'لا (متصفح)'],
    ['المزوّد', report.provider],
    ['توفر الإضافة', report.pluginAvailable],
    ['الإذن قبل الطلب', report.permissionBefore],
    ['الإذن بعد الطلب', report.permissionAfter],
    ['اللغات العربية', report.languages],
    ['الاتصال', report.online ? 'متصل' : 'غير متصل'],
  ] : [];

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground p-4 space-y-4">
      <h1 className="text-xl font-bold">فحص الميكروفون والتسميع</h1>

      <div className="flex flex-wrap gap-2">
        <Button onClick={check}>فحص شامل</Button>
        <Button onClick={start} disabled={state === 'listening'}>بدء الاستماع</Button>
        <Button variant="secondary" onClick={stop} disabled={state !== 'listening'}>إيقاف</Button>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="text-sm text-muted-foreground mb-1">الحالة: {state}</div>
        <div className="text-lg min-h-[3rem] leading-relaxed">{partial || '—'}</div>
        {final && <div className="mt-2 text-sm">النهائي: {final}</div>}
      </div>

      {rows.length > 0 && (
        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="p-2 font-medium bg-muted/40 w-40">{label}</td>
                <td className="p-2 break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rounded-lg border border-border p-3 space-y-1 text-xs font-mono">
        {log.length === 0 ? <div className="text-muted-foreground">لا سجل بعد</div> : log.map((line, index) => <div key={index}>{line}</div>)}
      </div>
    </div>
  );
}
