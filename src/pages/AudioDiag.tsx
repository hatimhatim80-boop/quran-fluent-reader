/**
 * Audio Diagnostics Page
 * Raw microphone capture + the single speech engine (NoorSpeech, Android native).
 */
import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Mic, MicOff, Volume2, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSpeechProvider, runSpeechDiagnostics, type QuranSpeechRecognitionProvider } from '@/services/speechRecognition';

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warn';
}

export default function AudioDiag() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isTestingGetUserMedia, setIsTestingGetUserMedia] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const providerRef = useRef<QuranSpeechRecognitionProvider | null>(null);

  const log = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, message, level }]);
  }, []);

  const clearLogs = () => setLogs([]);

  // ── Test 1: Platform + engine report ──
  const testPlatformInfo = useCallback(async () => {
    log('═══ معلومات المنصة ═══', 'info');
    log(`Capacitor.isNativePlatform(): ${Capacitor.isNativePlatform()}`, 'info');
    log(`Capacitor.getPlatform(): ${Capacitor.getPlatform()}`, 'info');
    const noor = Capacitor.isPluginAvailable('NoorSpeech');
    log(`NoorSpeech plugin available: ${noor}`, noor ? 'success' : 'warn');
    const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
    log(`navigator.mediaDevices.getUserMedia: ${hasGetUserMedia}`, hasGetUserMedia ? 'success' : 'warn');
    try {
      const report = await runSpeechDiagnostics();
      Object.entries(report).forEach(([key, value]) => log(`${key}: ${String(value)}`, 'info'));
    } catch (error) {
      log(`فشل فحص محرك التسميع: ${String(error)}`, 'error');
    }
  }, [log]);

  // ── Test 2: The single speech engine ──
  const testSpeechEngine = useCallback(async () => {
    if (isListening) {
      await providerRef.current?.stopListening();
      setIsListening(false);
      log('⏹ طُلب الإيقاف', 'info');
      return;
    }

    log('═══ اختبار محرك التسميع الأصلي ═══', 'info');
    const provider = providerRef.current || (await getSpeechProvider());
    providerRef.current = provider;
    log(`المحرك: ${provider.id} — ${provider.name}`, provider.id === 'native' ? 'success' : 'error');
    if (provider.id !== 'native') {
      log('المحرك الأصلي يعمل داخل تطبيق أندرويد فقط', 'warn');
      return;
    }

    let permission = await provider.checkPermission();
    log(`إذن الميكروفون: ${permission}`, permission === 'granted' ? 'success' : 'warn');
    if (permission !== 'granted') {
      permission = await provider.requestPermission();
      log(`بعد الطلب: ${permission}`, permission === 'granted' ? 'success' : 'error');
      if (permission !== 'granted') return;
    }

    const started = await provider.startListening('ar-SA', {
      onPartialResult: text => log(`📝 ${text}`, 'success'),
      onFinalResult: text => { log(`✅ النهائي: ${text || '(فارغ)'}`, 'success'); setIsListening(false); },
      onStateChange: state => log(`الحالة: ${state}`, 'info'),
      onError: (message, technical) => log(`❌ ${message} ${technical ? JSON.stringify(technical) : ''}`, 'error'),
    });
    setIsListening(started);
    log(started ? '▶ الاستماع بدأ — تحدث الآن' : '❌ رُفض بدء الاستماع', started ? 'success' : 'error');
  }, [isListening, log]);

  // ── Test 3: getUserMedia (raw mic) ──
  const testGetUserMedia = useCallback(async () => {
    if (isTestingGetUserMedia) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setIsTestingGetUserMedia(false);
      log('⏹ أُوقف اختبار الميكروفون الخام', 'info');
      return;
    }

    log('═══ اختبار getUserMedia (ميكروفون خام) ═══', 'info');

    if (!navigator.mediaDevices?.getUserMedia) {
      log('❌ getUserMedia غير متاح', 'error');
      return;
    }

    try {
      log('طلب الوصول للميكروفون...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      setIsTestingGetUserMedia(true);

      const track = stream.getAudioTracks()[0];
      log(`✓ حصلنا على مسار صوتي: ${track.label}`, 'success');
      log(`الحالة: ${track.readyState}, كتم: ${track.muted}`, 'info');

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      let checkCount = 0;

      const checkLevel = () => {
        if (!streamRef.current || checkCount >= 50) {
          log(`أعلى مستوى صوت مُسجّل: ${maxLevel}/255`, maxLevel > 10 ? 'success' : 'error');
          if (maxLevel <= 10) log('⚠ لم يتم الكشف عن صوت — الميكروفون قد يكون مكتوماً', 'error');
          audioCtx.close();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const level = Math.max(...dataArray);
        if (level > maxLevel) maxLevel = level;
        if (checkCount % 10 === 0) log(`مستوى الصوت الحالي: ${level}/255`, level > 10 ? 'success' : 'warn');
        checkCount++;
        setTimeout(checkLevel, 200);
      };

      log('🎤 تحدث الآن... (10 ثوان)', 'info');
      checkLevel();
    } catch (e) {
      log(`❌ getUserMedia خطأ: ${(e as Error)?.message || e}`, 'error');
      setIsTestingGetUserMedia(false);
    }
  }, [isTestingGetUserMedia, log]);

  const levelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-500 shrink-0" />;
      case 'warn': return <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />;
      default: return <span className="w-3 h-3 shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-arabic">تشخيص الصوت</h1>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowRight className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={testPlatformInfo} variant="outline" size="sm" className="text-xs">
            ℹ️ معلومات المنصة
          </Button>
          <Button onClick={testGetUserMedia} variant={isTestingGetUserMedia ? "destructive" : "outline"} size="sm" className="text-xs">
            {isTestingGetUserMedia ? <MicOff className="w-3 h-3 ml-1" /> : <Volume2 className="w-3 h-3 ml-1" />}
            getUserMedia
          </Button>
          <Button onClick={testSpeechEngine} variant={isListening ? "destructive" : "outline"} size="sm" className="text-xs">
            {isListening ? <MicOff className="w-3 h-3 ml-1" /> : <Mic className="w-3 h-3 ml-1" />}
            محرك التسميع
          </Button>
          <Button onClick={clearLogs} variant="ghost" size="sm" className="text-xs">
            <Trash2 className="w-3 h-3 ml-1" />
            مسح السجل
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant={Capacitor.isNativePlatform() ? "default" : "secondary"}>
            {Capacitor.isNativePlatform() ? '📱 أصلي' : '🌐 متصفح'}
          </Badge>
          <Badge variant="outline">{Capacitor.getPlatform()}</Badge>
        </div>

        <div className="bg-muted/50 rounded-lg border p-3 max-h-[60vh] overflow-y-auto font-mono text-[11px] space-y-0.5">
          {logs.length === 0 && (
            <p className="text-muted-foreground text-center py-8 font-arabic text-sm">
              اضغط أحد الأزرار لبدء التشخيص
            </p>
          )}
          {logs.map((entry, i) => (
            <div key={i} className="flex items-start gap-1.5">
              {levelIcon(entry.level)}
              <span className="text-muted-foreground shrink-0">{entry.time}</span>
              <span className={
                entry.level === 'error' ? 'text-red-600 dark:text-red-400' :
                entry.level === 'success' ? 'text-green-600 dark:text-green-400' :
                entry.level === 'warn' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-foreground'
              } style={{ wordBreak: 'break-all' }}>
                {entry.message}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-muted/30 rounded-lg border p-3 text-xs font-arabic space-y-2 text-muted-foreground">
          <p className="font-bold text-foreground">خطوات التشخيص:</p>
          <ol className="list-decimal mr-4 space-y-1">
            <li>اضغط "معلومات المنصة" أولاً</li>
            <li>اضغط "getUserMedia" وتحدث — إذا كان المستوى 0 فالميكروفون لا يلتقط</li>
            <li>اضغط "محرك التسميع" وتحدث — يجب أن يظهر النص أثناء الكلام</li>
            <li>صوّر الشاشة وأرسل النتائج</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
