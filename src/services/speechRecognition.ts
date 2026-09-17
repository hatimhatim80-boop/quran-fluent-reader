/** One lifecycle-managed speech recognition abstraction for Quran recitation. */
import { Capacitor } from '@capacitor/core';

export type MicState = 'idle' | 'requestingPermission' | 'listening' | 'processing' | 'completed' | 'permissionDenied' | 'unavailable' | 'error';
export type RecognizerLifecycle = 'idle' | 'starting' | 'listening' | 'restarting' | 'stopping' | 'processing';
export type PermissionResult = 'granted' | 'denied' | 'prompt';
export type NetworkRequirement = 'required' | 'optional' | 'unknown';

export interface RecognitionCallbacks {
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onStateChange?: (state: MicState) => void;
  onError?: (message: string, technical?: unknown) => void;
}

export interface LanguageCheck { lang: string; supported: boolean; substituted: boolean }

export interface QuranSpeechRecognitionProvider {
  readonly id: 'native' | 'web' | 'none';
  readonly name: string;
  readonly networkRequirement: NetworkRequirement;
  isAvailable(): Promise<boolean>;
  checkPermission(): Promise<PermissionResult>;
  requestPermission(): Promise<PermissionResult>;
  resolveLanguage(preferred: string): Promise<LanguageCheck>;
  startListening(lang: string, callbacks: RecognitionCallbacks): Promise<boolean>;
  stopListening(): Promise<void>;
  dispose(): Promise<void>;
}

let activeProvider: object | null = null;
const acquire = (provider: object) => activeProvider === null && (activeProvider = provider) === provider;
const release = (provider: object) => { if (activeProvider === provider) activeProvider = null; };
const split = (text: string) => text.trim().split(/\s+/).filter(Boolean);

export function mergeTranscript(base: string, addition: string): string {
  const previous = split(base);
  const next = split(addition);
  for (let overlap = Math.min(previous.length, next.length); overlap > 0; overlap--) {
    if (previous.slice(-overlap).join(' ') === next.slice(0, overlap).join(' ')) {
      return [...previous, ...next.slice(overlap)].join(' ');
    }
  }
  return [...previous, ...next].join(' ');
}

const unavailableMessage = 'التعرف الصوتي غير متاح حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.';
const startErrorMessage = 'تعذّر تشغيل الميكروفون — أعد المحاولة.';

/** Android SpeechRecognizer error codes, mapped to text the reciter can act on. */
const androidErrorText: Record<string, string> = {
  '1': 'انتهت مهلة الاتصال بخدمة التعرف — تحقق من الإنترنت.',
  '2': 'خدمة التعرف تحتاج اتصال إنترنت — شغّل الإنترنت ثم أعد المحاولة.',
  '3': 'تعذّر تسجيل الصوت من الميكروفون.',
  '4': 'خطأ من خدمة التعرف — أعد المحاولة.',
  '5': 'خطأ داخلي في خدمة التعرف — أعد المحاولة.',
  '6': 'لم يُسمع أي صوت — اقترب من الميكروفون وأعد المحاولة.',
  '7': 'لم يُتعرَّف على أي كلام — أعد التسميع بصوت أوضح.',
  '8': 'خدمة التعرف مشغولة بتطبيق آخر — أغلقه ثم أعد المحاولة.',
  '9': 'إذن الميكروفون غير ممنوح — امنح الإذن من إعدادات التطبيق.',
  '11': 'اللغة العربية غير مثبَّتة في خدمة التعرف — ثبّتها من إعدادات لوحة المفاتيح/الصوت في الهاتف.',
  '12': 'حزمة اللغة العربية غير متاحة على الجهاز — نزّلها من إعدادات التعرف الصوتي.',
  '13': 'انقطع الاتصال بخدمة التعرف — أعد المحاولة.',
  '14': 'طلبات كثيرة على خدمة التعرف — انتظر قليلًا ثم أعد المحاولة.',
  AUDIO: 'تعذّر تسجيل الصوت من الميكروفون.',
  CLIENT: 'تعذّر بدء خدمة الميكروفون على الجهاز — أغلق المحاولة وأعدها.',
  INSUFFICIENT_PERMISSIONS: 'إذن الميكروفون غير ممنوح — امنحه من إعدادات التطبيق.',
  NETWORK: 'خدمة التعرف تحتاج اتصال إنترنت — شغّل الإنترنت ثم أعد المحاولة.',
  NETWORK_TIMEOUT: 'انتهت مهلة الاتصال بخدمة التعرف — تحقق من الإنترنت.',
  NO_MATCH: 'لم يُتعرَّف على أي كلام — أعد التسميع بصوت أوضح.',
  RECOGNIZER_BUSY: 'خدمة التعرف مشغولة — أوقف التطبيقات التي تستخدم الميكروفون ثم أعد المحاولة.',
  SERVER: 'حدث خطأ في خدمة التعرف الصوتي — أعد المحاولة.',
  SERVER_DISCONNECTED: 'انقطع الاتصال بخدمة التعرف — أعد المحاولة.',
  SPEECH_TIMEOUT: 'لم يُسمع أي صوت — اقترب من الميكروفون وأعد المحاولة.',
};

function nativeErrorMessage(error: unknown): string {
  const raw = error as { code?: unknown; error?: unknown; message?: unknown } | undefined;
  const code = String(raw?.code ?? raw?.error ?? '').trim();
  if (androidErrorText[code]) return androidErrorText[code];
  const message = String(raw?.message || error || '').toLowerCase();
  const embedded = message.match(/\b(\d{1,2})\b/)?.[1];
  if (embedded && androidErrorText[embedded]) return androidErrorText[embedded];
  if (/permission/.test(message)) return androidErrorText['9'];
  if (/language/.test(message)) return androidErrorText['11'];
  return /network|unavailable|not available|no match|service/.test(message) ? unavailableMessage : startErrorMessage;
}

/** Android/iOS recognizer backed by @capgo/capacitor-speech-recognition (Capacitor 8). */
const NO_PARTIAL_TIMEOUT_MS = 8000;
const noPartialMessage = 'لم يصل أي صوت من الميكروفون خلال ٨ ثوانٍ — تحقق من إذن الميكروفون ثم أعد المحاولة.';
const missingNativePluginMessage = 'نسخة التطبيق المثبّتة قديمة ولا تحتوي محرّك الميكروفون الأصلي — ثبّت ملف APK الجديد.';

class NativeProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'native' as const;
  readonly name = 'التعرف الصوتي في النظام';
  readonly networkRequirement: NetworkRequirement = 'unknown';
  private callbacks: RecognitionCallbacks = {};
  private lifecycle: RecognizerLifecycle = 'idle';
  private listeners: { remove: () => void }[] = [];
  private transcript = '';
  private language = 'ar-SA';
  private stopRequested = false;
  private finalDelivered = false;
  private gotPartial = false;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;
  private partialTimer: ReturnType<typeof setTimeout> | null = null;

  private async plugin() { return (await import('@capgo/capacitor-speech-recognition')).SpeechRecognition; }

  /** On a native build this provider is the ONLY possible one: the Android WebView
   *  has no window.SpeechRecognition, so never fall back to the web provider.
   *  available() is logged but must not disqualify the provider. */
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    if (!Capacitor.isPluginAvailable('SpeechRecognition')) {
      console.error('[speech/native] native SpeechRecognition plugin is not registered in this APK');
      return false;
    }
    try {
      const result = await (await this.plugin()).available();
      console.log('[speech/native] available():', JSON.stringify(result));
      return result.available === true;
    } catch (error) {
      console.error('[speech/native] availability check failed', error);
      return false;
    }
  }
  private normalizePermission(status: Record<string, unknown> | undefined): PermissionResult {
    const values = Object.values(status || {}).map(value => String(value));
    if (values.length === 0) return 'prompt';
    if (values.every(value => value === 'granted')) return 'granted';
    if (values.some(value => value === 'denied')) return 'denied';
    return 'prompt';
  }
  async checkPermission(): Promise<PermissionResult> {
    try {
      const status = await (await this.plugin()).checkPermissions() as unknown as Record<string, unknown>;
      console.log('[speech/native] checkPermissions:', JSON.stringify(status));
      return this.normalizePermission(status);
    }
    catch (error) { console.error('[speech/native] permission check failed', error); return 'prompt'; }
  }
  async requestPermission(): Promise<PermissionResult> {
    try {
      const status = await (await this.plugin()).requestPermissions() as unknown as Record<string, unknown>;
      console.log('[speech/native] requestPermissions:', JSON.stringify(status));
      return this.normalizePermission(status);
    }
    catch (error) { console.error('[speech/native] permission request failed', error); return 'denied'; }
  }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    const requested = preferred.toLowerCase().startsWith('ar') ? preferred : 'ar-SA';
    try {
      const languages = (await (await this.plugin()).getSupportedLanguages()).languages || [];
      // Android 13+ no longer exposes the list; an empty list is not a failure.
      if (languages.length === 0) return { lang: requested, supported: true, substituted: requested !== preferred };
      const exact = languages.find(item => item.toLowerCase() === requested.toLowerCase());
      if (exact) return { lang: exact, supported: true, substituted: exact !== preferred };
      const arabic = languages.find(item => item.toLowerCase().startsWith('ar'));
      return arabic ? { lang: arabic, supported: true, substituted: true } : { lang: requested, supported: false, substituted: false };
    } catch (error) {
      console.error('[speech/native] language check failed', error);
      return { lang: requested, supported: true, substituted: requested !== preferred };
    }
  }

  private markListening() {
    if (this.finalDelivered || this.stopRequested) return;
    if (this.lifecycle === 'starting' || this.lifecycle === 'listening') {
      if (this.lifecycle === 'starting') this.callbacks.onStateChange?.('listening');
      this.lifecycle = 'listening';
    }
  }

  private applyPartial(text: string) {
    if (!text || this.finalDelivered) return;
    this.gotPartial = true;
    this.clearPartialTimer();
    this.markListening();
    this.transcript = mergeTranscript(this.transcript, text);
    this.callbacks.onPartialResult?.(this.transcript);
  }

  async startListening(language: string, callbacks: RecognitionCallbacks): Promise<boolean> {
    if (this.lifecycle !== 'idle' || !acquire(this)) return false;
    this.lifecycle = 'starting';
    this.callbacks = callbacks;
    this.language = language.toLowerCase().startsWith('ar') ? language : 'ar-SA';
    this.transcript = '';
    this.stopRequested = false;
    this.finalDelivered = false;
    this.gotPartial = false;
    try {
      const plugin = await this.plugin();
      const availability = await plugin.available();
      if (!availability.available) throw new Error(missingNativePluginMessage);
      // Never let a previous attempt's listeners survive into this session.
      await plugin.removeAllListeners();
      this.listeners = [
        await plugin.addListener('partialResults', data => {
          const best = (data.matches || []).reduce((top, value) => value.length > top.length ? value : top, '');
          this.applyPartial(data.accumulatedText || best);
        }),
        await plugin.addListener('listeningState', data => {
          const stopped = data.state === 'stopped' || data.status === 'stopped';
          if (!stopped) { this.markListening(); return; }
          if (this.stopRequested || this.lifecycle === 'stopping') void this.finish();
          else void this.finish();
        }),
        await plugin.addListener('error', event => {
          console.error('[speech/native] recognizer error', JSON.stringify(event), event);
          if (this.finalDelivered) return;
          // A recognizer error is never silent: the reciter must know why it stopped.
          if (this.lifecycle === 'starting') { void this.failStart(event); return; }
          if (!this.stopRequested && !this.gotPartial) this.callbacks.onError?.(nativeErrorMessage(event), event);
          void this.finish();
        }),
      ];

      // start() resolves immediately with partialResults; never gate the UI on it.
      void plugin.start({ language: this.language, maxResults: 5, partialResults: true, popup: false })
        .then(() => { if (!this.stopRequested) this.markListening(); })
        .catch(error => {
          if (this.finalDelivered) return;
          if (this.lifecycle === 'starting') void this.failStart(error);
          else { console.error('[speech/native] session ended with error', error); void this.finish(); }
        });
      this.markListening();
      this.clearPartialTimer();
      this.partialTimer = setTimeout(() => {
        if (this.finalDelivered || this.gotPartial) return;
        console.error('[speech/native] no partial results within timeout');
        this.callbacks.onError?.(noPartialMessage);
        void this.forceStopAndFinish();
      }, NO_PARTIAL_TIMEOUT_MS);
      return true;
    } catch (error) {
      await this.failStart(error);
      return false;
    }
  }

  private clearPartialTimer() {
    if (this.partialTimer) clearTimeout(this.partialTimer);
    this.partialTimer = null;
  }
  private clearGuard() {
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = null;
    this.clearPartialTimer();
  }
  private async clearListeners() {
    for (const listener of this.listeners) {
      try { await listener.remove(); } catch (error) { console.error('[speech/native] listener cleanup failed', error); }
    }
    this.listeners = [];
    try { await (await this.plugin()).removeAllListeners(); }
    catch (error) { console.error('[speech/native] removeAllListeners failed', error); }
  }
  /** Last line of defence: stop() can hang, so force it and keep the cached partial. */
  private async forceStopAndFinish() {
    this.stopRequested = true;
    try { await (await this.plugin()).forceStop({ timeout: 1200 }); }
    catch (error) { console.error('[speech/native] forceStop failed', error); }
    await this.finish();
  }
  private async cachedPartial(): Promise<string> {
    try {
      const last = await (await this.plugin()).getLastPartialResult();
      return last?.available ? String(last.text || '') : '';
    } catch (error) { console.error('[speech/native] getLastPartialResult failed', error); return ''; }
  }
  private async finish() {
    if (this.finalDelivered) return;
    this.finalDelivered = true;
    this.lifecycle = 'processing';
    this.clearGuard();
    const cached = await this.cachedPartial();
    if (cached) this.transcript = mergeTranscript(this.transcript, cached);
    const result = this.transcript.trim();
    await this.clearListeners();
    this.lifecycle = 'idle';
    release(this);
    this.callbacks.onStateChange?.('completed');
    this.callbacks.onFinalResult?.(result);
  }
  private async failStart(error: unknown) {
    console.error('[speech/native] start failed', error);
    this.finalDelivered = true;
    this.clearGuard();
    await this.clearListeners();
    this.lifecycle = 'idle';
    release(this);
    this.callbacks.onError?.(nativeErrorMessage(error), error);
    this.callbacks.onStateChange?.('error');
  }
  async stopListening() {
    if (this.lifecycle === 'idle' || this.finalDelivered) return;
    this.stopRequested = true;
    this.lifecycle = 'stopping';
    this.callbacks.onStateChange?.('processing');
    try { await (await this.plugin()).stop(); }
    catch (error) { console.error('[speech/native] stop failed', error); }
    this.clearGuard();
    this.guardTimer = setTimeout(() => { void this.forceStopAndFinish(); }, 1500);
  }
  async dispose() {
    this.stopRequested = true;
    this.clearGuard();
    if (this.lifecycle !== 'idle') {
      try { await (await this.plugin()).forceStop({ timeout: 800 }); }
      catch (error) { console.error('[speech/native] dispose stop failed', error); }
    }
    this.finalDelivered = true;
    await this.clearListeners();
    this.transcript = '';
    this.lifecycle = 'idle';
    release(this);
  }
}


interface WebRecognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}

function webConstructor(): (new () => WebRecognition) | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

class WebProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'web' as const;
  readonly name = 'التعرف الصوتي في المتصفح';
  readonly networkRequirement: NetworkRequirement = 'required';
  private recognizer: WebRecognition | null = null;
  private callbacks: RecognitionCallbacks = {};
  private transcript = '';
  private lifecycle: RecognizerLifecycle = 'idle';
  private stopRequested = false;
  private finalDelivered = false;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;

  async isAvailable() { return webConstructor() !== null; }
  async checkPermission(): Promise<PermissionResult> {
    try { return (await navigator.permissions?.query({ name: 'microphone' as PermissionName }))?.state as PermissionResult || 'prompt'; }
    catch { return 'prompt'; }
  }
  async requestPermission(): Promise<PermissionResult> {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); return 'granted'; }
    catch (error) { console.error('[speech/web] permission denied', error); return 'denied'; }
  }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    const supported = preferred.toLowerCase().startsWith('ar');
    return { lang: supported ? preferred : 'ar-SA', supported, substituted: false };
  }
  async startListening(language: string, callbacks: RecognitionCallbacks): Promise<boolean> {
    const Constructor = webConstructor();
    if (!Constructor || this.lifecycle !== 'idle' || !acquire(this)) return false;
    this.callbacks = callbacks;
    this.transcript = '';
    this.stopRequested = false;
    this.finalDelivered = false;
    this.lifecycle = 'starting';
    const recognizer = new Constructor();
    recognizer.lang = language;
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 3;
    recognizer.onresult = event => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const text = String(result[0]?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) this.transcript = mergeTranscript(this.transcript, text);
        else interim = mergeTranscript(interim, text);
      }
      this.callbacks.onPartialResult?.(mergeTranscript(this.transcript, interim));
    };
    recognizer.onerror = event => {
      if (event.error === 'not-allowed') callbacks.onStateChange?.('permissionDenied');
      else if (!['no-speech', 'aborted'].includes(event.error)) callbacks.onError?.(event.error === 'network' ? unavailableMessage : 'تعذّر التعرف على الصوت', event.error);
    };
    recognizer.onend = () => {
      if (!this.stopRequested && this.lifecycle === 'listening') {
        this.lifecycle = 'restarting';
        try { recognizer.start(); this.lifecycle = 'listening'; return; }
        catch (error) { console.error('[speech/web] restart failed', error); }
      }
      void this.finish();
    };
    this.recognizer = recognizer;
    try { recognizer.start(); this.lifecycle = 'listening'; callbacks.onStateChange?.('listening'); return true; }
    catch (error) {
      console.error('[speech/web] start failed', error);
      this.recognizer = null; this.lifecycle = 'idle'; release(this);
      callbacks.onError?.(startErrorMessage, error); callbacks.onStateChange?.('error'); return false;
    }
  }
  private async finish() {
    if (this.finalDelivered) return;
    this.finalDelivered = true;
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = null;
    const result = this.transcript.trim();
    this.recognizer = null;
    this.lifecycle = 'idle';
    release(this);
    this.callbacks.onStateChange?.('completed');
    this.callbacks.onFinalResult?.(result);
  }
  async stopListening() {
    if (this.lifecycle === 'idle' || this.finalDelivered) return;
    this.stopRequested = true;
    this.lifecycle = 'stopping';
    this.callbacks.onStateChange?.('processing');
    try { this.recognizer?.stop(); } catch (error) { console.error('[speech/web] stop failed', error); }
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => { void this.finish(); }, 2000);
  }
  async dispose() {
    this.stopRequested = true;
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = null;
    try { this.recognizer?.abort(); } catch (error) { console.error('[speech/web] dispose failed', error); }
    this.recognizer = null; this.transcript = ''; this.finalDelivered = true; this.lifecycle = 'idle'; release(this);
  }
}

class NoProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'none' as const; readonly name = 'غير متاح'; readonly networkRequirement: NetworkRequirement = 'unknown';
  async isAvailable() { return false; }
  async checkPermission(): Promise<PermissionResult> { return 'denied'; }
  async requestPermission(): Promise<PermissionResult> { return 'denied'; }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> { return { lang: preferred, supported: false, substituted: false }; }
  async startListening() { return false; }
  async stopListening() {}
  async dispose() {}
}

let cachedProvider: QuranSpeechRecognitionProvider | null = null;
export async function getSpeechProvider(): Promise<QuranSpeechRecognitionProvider> {
  if (cachedProvider) return cachedProvider;
  const native = new NativeProvider();
  if (await native.isAvailable()) return (cachedProvider = native);
  // A Capacitor Android/iOS build must never silently use the WebView recognizer.
  // Missing native registration means the installed APK itself must be replaced.
  if (Capacitor.isNativePlatform()) return (cachedProvider = new NoProvider());
  const web = new WebProvider();
  if (await web.isAvailable()) return (cachedProvider = web);
  return (cachedProvider = new NoProvider());
}
export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export interface SpeechDiagnostics {
  platform: string;
  native: boolean;
  provider: string;
  pluginAvailable: string;
  pluginVersion: string;
  permissionBefore: string;
  permissionAfter: string;
  languages: string;
  online: boolean;
}

/** On-device check: every step reported, nothing swallowed. */
export async function runSpeechDiagnostics(): Promise<SpeechDiagnostics> {
  const native = Capacitor.isNativePlatform();
  const provider = await getSpeechProvider();
  const report: SpeechDiagnostics = {
    platform: Capacitor.getPlatform(),
    native,
    provider: provider.id,
    pluginAvailable: 'غير مفحوص',
    pluginVersion: 'غير مفحوص',
    permissionBefore: 'غير مفحوص',
    permissionAfter: 'غير مطلوب',
    languages: 'غير مفحوص',
    online: isOnline(),
  };
  if (native) {
    if (!Capacitor.isPluginAvailable('SpeechRecognition')) {
      report.pluginAvailable = 'غير مسجّلة داخل APK — ثبّت النسخة الجديدة';
      report.pluginVersion = 'غير موجودة';
      report.permissionBefore = 'غير قابل للفحص';
      report.permissionAfter = 'غير قابل للفحص';
      report.languages = 'غير قابل للفحص';
      return report;
    }
    try {
      const plugin = (await import('@capgo/capacitor-speech-recognition')).SpeechRecognition;
      report.pluginAvailable = JSON.stringify(await plugin.available());
      report.pluginVersion = (await plugin.getPluginVersion()).version;
      try {
        const languages = (await plugin.getSupportedLanguages()).languages || [];
        report.languages = languages.length ? languages.filter(l => l.toLowerCase().startsWith('ar')).join(', ') || `${languages.length} لغة بدون عربية` : 'القائمة غير متاحة (طبيعي في أندرويد 13+)';
      } catch (error) { report.languages = `فشل: ${String(error)}`; }
    } catch (error) { report.pluginAvailable = `فشل: ${String(error)}`; }
  }
  report.permissionBefore = await provider.checkPermission();
  if (report.permissionBefore !== 'granted') report.permissionAfter = await provider.requestPermission();
  return report;
}
