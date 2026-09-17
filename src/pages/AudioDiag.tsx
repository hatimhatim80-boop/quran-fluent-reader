/**
 * Audio Diagnostics Page
 * Tests microphone capture and speech recognition on native & web.
 */
import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Mic, MicOff, Volume2, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warn';
}

export default function AudioDiag() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTestingNative, setIsTestingNative] = useState(false);
  const [isTestingWeb, setIsTestingWeb] = useState(false);
  const [isTestingGetUserMedia, setIsTestingGetUserMedia] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const nativePluginRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);

  const log = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, message, level }]);
  }, []);

  const clearLogs = () => setLogs([]);

  // ── Test 1: Platform Info ──
  const testPlatformInfo = useCallback(() => {
    log('═══ معلومات المنصة ═══', 'info');
    log(`Capacitor.isNativePlatform(): ${Capacitor.isNativePlatform()}`, 'info');
    log(`Capacitor.getPlatform(): ${Capacitor.getPlatform()}`, 'info');
    log(`navigator.userAgent: ${navigator.userAgent.slice(0, 80)}...`, 'info');

    const isPluginAvail = Capacitor.isPluginAvailable('SpeechRecognition');
    log(`SpeechRecognition plugin available: ${isPluginAvail}`, isPluginAvail ? 'success' : 'warn');

    const w = window as any;
    const hasWebSpeech = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    log(`Web SpeechRecognition API: ${hasWebSpeech}`, hasWebSpeech ? 'success' : 'warn');

    const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
    log(`navigator.mediaDevices.getUserMedia: ${hasGetUserMedia}`, hasGetUserMedia ? 'success' : 'warn');
  }, [log]);

  // ── Test 2: Native Speech Recognition ──
  const testNativeSpeech = useCallback(async () => {
    if (isTestingNative) {
      // Stop
      try {
        if (nativePluginRef.current) await nativePluginRef.current.stop();
        if (listenerRef.current) await listenerRef.current.remove();
      } catch {}
      setIsTestingNative(false);
      log('⏹ أُوقف الاختبار الأصلي', 'info');
      return;
    }

    log('═══ اختبار التعرف الأصلي (Capacitor) ═══', 'info');

    if (!Capacitor.isNativePlatform()) {
      log('ليس منصة أصلية — تخطي', 'warn');
      return;
    }

    try {
      const mod = await import('@capgo/capacitor-speech-recognition');
      const plugin = mod.SpeechRecognition;
      nativePluginRef.current = plugin;
      log('✓ تم تحميل الإضافة', 'success');

      // Check available
      try {
        const avail = await plugin.available();
        log(`available(): ${JSON.stringify(avail)}`, avail?.available ? 'success' : 'error');
      } catch (e: any) {
        log(`available() خطأ: ${e?.message}`, 'error');
      }

      // Check permissions
      const check = await plugin.checkPermissions();
      log(`checkPermissions(): ${JSON.stringify(check)}`, 'info');

      if (check?.speechRecognition !== 'granted') {
        log('طلب إذن الميكروفون...', 'info');
        const req = await plugin.requestPermissions();
        log(`requestPermissions(): ${JSON.stringify(req)}`, req?.speechRecognition === 'granted' ? 'success' : 'error');
        if (req?.speechRecognition !== 'granted') {
          log('❌ إذن الميكروفون مرفوض — لا يمكن المتابعة', 'error');
          return;
        }
      }

      // Add partialResults listener
      listenerRef.current = await plugin.addListener('partialResults', (data: any) => {
        log(`📝 partialResults: ${JSON.stringify(data)}`, 'success');
      });

      // Start
      setIsTestingNative(true);
      log('▶ بدء التعرف بـ popup:true, lang:ar-SA ...', 'info');
      const result = await plugin.start({
        language: 'ar-SA',
        maxResults: 5,
        partialResults: true,
        popup: true,
      });
      log(`start() رجع: ${JSON.stringify(result)}`, result?.matches?.length ? 'success' : 'warn');
      setIsTestingNative(false);

    } catch (e: any) {
      log(`❌ خطأ: ${e?.message || e}`, 'error');
      setIsTestingNative(false);
    }
  }, [isTestingNative, log]);

  // ── Test 3: Native WITHOUT popup ──
  const testNativeNoPopup = useCallback(async () => {
    log('═══ اختبار أصلي بدون popup ═══', 'info');

    if (!Capacitor.isNativePlatform()) {
      log('ليس منصة أصلية — تخطي', 'warn');
      return;
    }

    try {
      const mod = await import('@capgo/capacitor-speech-recognition');
      const plugin = mod.SpeechRecognition;

      const listener = await plugin.addListener('partialResults', (data: any) => {
        log(`📝 partialResults (no-popup): ${JSON.stringify(data)}`, 'success');
      });

      log('▶ بدء بدون popup...', 'info');
      const result = await plugin.start({
        language: 'ar-SA',
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
      log(`start(popup:false) رجع: ${JSON.stringify(result)}`, result?.matches?.length ? 'success' : 'warn');

      // Auto stop after 8s
      setTimeout(async () => {
        try {
          await plugin.stop();
          await listener.remove();
          log('⏹ توقف تلقائي بعد 8 ثوان', 'info');
        } catch {}
      }, 8000);

    } catch (e: any) {
      log(`❌ خطأ: ${e?.message || e}`, 'error');
    }
  }, [log]);

  // ── Test 4: getUserMedia (raw mic) ──
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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      setIsTestingGetUserMedia(true);

      const track = stream.getAudioTracks()[0];
      log(`✓ حصلنا على مسار صوتي: ${track.label}`, 'success');
      log(`الحالة: ${track.readyState}, كتم: ${track.muted}`, 'info');
      log(`الإعدادات: ${JSON.stringify(track.getSettings())}`, 'info');

      // Create analyser to check audio levels
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
          if (maxLevel <= 10) {
            log('⚠ لم يتم الكشف عن صوت — الميكروفون قد يكون مكتوماً أو WebView لا يسمح', 'error');
          }
          audioCtx.close();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const level = Math.max(...dataArray);
        if (level > maxLevel) maxLevel = level;
        if (checkCount % 10 === 0) {
          log(`مستوى الصوت الحالي: ${level}/255`, level > 10 ? 'success' : 'warn');
        }
        checkCount++;
        setTimeout(checkLevel, 200);
      };

      log('🎤 تحدث الآن... (10 ثوان)', 'info');
      checkLevel();

    } catch (e: any) {
      log(`❌ getUserMedia خطأ: ${e?.message || e}`, 'error');
      log('قد يعني أن WebView لا يمرر إذن الميكروفون — حل: onPermissionRequest في MainActivity.java', 'warn');
      setIsTestingGetUserMedia(false);
    }
  }, [isTestingGetUserMedia, log]);

  // ── Test 5: Web Speech API ──
  const testWebSpeech = useCallback(() => {
    if (isTestingWeb) {
      setIsTestingWeb(false);
      log('⏹ أُوقف Web Speech', 'info');
      return;
    }

    log('═══ اختبار Web Speech API ═══', 'info');
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      log('❌ Web Speech API غير متاح في هذا المتصفح/WebView', 'error');
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = 'ar-SA';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        log('▶ Web Speech بدأ', 'success');
        setIsTestingWeb(true);
      };

      rec.onresult = (e: any) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        log(`📝 Web Speech: "${text}"`, 'success');
      };

      rec.onerror = (e: any) => {
        log(`❌ Web Speech خطأ: ${e.error}`, 'error');
        setIsTestingWeb(false);
      };

      rec.onend = () => {
        log('⏹ Web Speech انتهى', 'info');
        setIsTestingWeb(false);
      };

      rec.start();
    } catch (e: any) {
      log(`❌ خطأ: ${e?.message}`, 'error');
    }
  }, [isTestingWeb, log]);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-arabic">تشخيص الصوت</h1>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowRight className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          </Link>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={testPlatformInfo} variant="outline" size="sm" className="text-xs">
            ℹ️ معلومات المنصة
          </Button>
          <Button onClick={testGetUserMedia} variant={isTestingGetUserMedia ? "destructive" : "outline"} size="sm" className="text-xs">
            {isTestingGetUserMedia ? <MicOff className="w-3 h-3 ml-1" /> : <Volume2 className="w-3 h-3 ml-1" />}
            getUserMedia
          </Button>
          <Button onClick={testNativeSpeech} variant={isTestingNative ? "destructive" : "outline"} size="sm" className="text-xs">
            {isTestingNative ? <MicOff className="w-3 h-3 ml-1" /> : <Mic className="w-3 h-3 ml-1" />}
            أصلي + popup
          </Button>
          <Button onClick={testNativeNoPopup} variant="outline" size="sm" className="text-xs">
            <Mic className="w-3 h-3 ml-1" />
            أصلي بدون popup
          </Button>
          <Button onClick={testWebSpeech} variant={isTestingWeb ? "destructive" : "outline"} size="sm" className="text-xs">
            {isTestingWeb ? <MicOff className="w-3 h-3 ml-1" /> : <Mic className="w-3 h-3 ml-1" />}
            Web Speech API
          </Button>
          <Button onClick={clearLogs} variant="ghost" size="sm" className="text-xs">
            <Trash2 className="w-3 h-3 ml-1" />
            مسح السجل
          </Button>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1">
          <Badge variant={Capacitor.isNativePlatform() ? "default" : "secondary"}>
            {Capacitor.isNativePlatform() ? '📱 أصلي' : '🌐 متصفح'}
          </Badge>
          <Badge variant="outline">{Capacitor.getPlatform()}</Badge>
        </div>

        {/* Log output */}
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

        {/* Instructions */}
        <div className="bg-muted/30 rounded-lg border p-3 text-xs font-arabic space-y-2 text-muted-foreground">
          <p className="font-bold text-foreground">خطوات التشخيص:</p>
          <ol className="list-decimal mr-4 space-y-1">
            <li>اضغط "معلومات المنصة" أولاً</li>
            <li>اضغط "getUserMedia" وتحدث — إذا كان المستوى 0 فالـ WebView لا يسمح</li>
            <li>اضغط "أصلي + popup" — يجب أن تظهر نافذة جوجل للتعرف</li>
            <li>اضغط "أصلي بدون popup" — يستمع بالخلفية 8 ثوان</li>
            <li>صوّر الشاشة وأرسل النتائج</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
