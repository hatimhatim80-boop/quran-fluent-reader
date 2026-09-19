/**
 * The single speech-recognition path in this project.
 *
 * Android only, through the in-app NoorSpeech plugin, which drives the system
 * `android.speech.SpeechRecognizer` directly: ar-SA, live partial results,
 * Quran contextual biasing strings and a continuous session that reopens on
 * silence — the same mechanism the working Study Noor build uses.
 *
 * There is no web fallback and no second provider: on any other platform the
 * recitation UI reports "unavailable" instead of silently using a weaker path.
 */
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

export interface RecognitionOptions {
  /** Quran words/phrases that bias the native recognizer towards the recited text. */
  contextualStrings?: string[];
}

export interface LanguageCheck { lang: string; supported: boolean; substituted: boolean }

export interface QuranSpeechRecognitionProvider {
  readonly id: 'native' | 'none';
  readonly name: string;
  readonly networkRequirement: NetworkRequirement;
  isAvailable(): Promise<boolean>;
  checkPermission(): Promise<PermissionResult>;
  requestPermission(): Promise<PermissionResult>;
  resolveLanguage(preferred: string): Promise<LanguageCheck>;
  startListening(lang: string, callbacks: RecognitionCallbacks, options?: RecognitionOptions): Promise<boolean>;
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
const noPartialMessage = 'لم يصل أي صوت من الميكروفون خلال ٨ ثوانٍ — تحقق من إذن الميكروفون ثم أعد المحاولة.';
const NO_PARTIAL_TIMEOUT_MS = 8000;
const STOP_GUARD_MS = 1500;

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
  '11': 'اللغة العربية غير مثبَّتة في خدمة التعرف — ثبّتها من إعدادات الصوت في الهاتف.',
  '12': 'حزمة اللغة العربية غير متاحة على الجهاز — نزّلها من إعدادات التعرف الصوتي.',
  '13': 'انقطع الاتصال بخدمة التعرف — أعد المحاولة.',
  '14': 'طلبات كثيرة على خدمة التعرف — انتظر قليلًا ثم أعد المحاولة.',
  AUDIO: 'تعذّر تسجيل الصوت من الميكروفون.',
  CLIENT: 'تعذّر بدء خدمة الميكروفون على الجهاز — أغلق المحاولة وأعدها.',
  INSUFFICIENT_PERMISSIONS: 'إذن الميكروفون غير ممنوح — امنحه من إعدادات التطبيق.',
  LANGUAGE_NOT_SUPPORTED: 'اللغة العربية غير مثبَّتة في خدمة التعرف — ثبّتها من إعدادات الهاتف.',
  LANGUAGE_UNAVAILABLE: 'حزمة اللغة العربية غير متاحة على الجهاز — نزّلها من إعدادات التعرف الصوتي.',
  NETWORK: 'خدمة التعرف تحتاج اتصال إنترنت — شغّل الإنترنت ثم أعد المحاولة.',
  NETWORK_TIMEOUT: 'انتهت مهلة الاتصال بخدمة التعرف — تحقق من الإنترنت.',
  NO_MATCH: 'لم يُتعرَّف على أي كلام — أعد التسميع بصوت أوضح.',
  RECOGNIZER_BUSY: 'خدمة التعرف مشغولة — أوقف التطبيقات التي تستخدم الميكروفون ثم أعد المحاولة.',
  SERVER: 'حدث خطأ في خدمة التعرف الصوتي — أعد المحاولة.',
  SERVER_DISCONNECTED: 'انقطع الاتصال بخدمة التعرف — أعد المحاولة.',
  SERVICE_NOT_AVAILABLE: 'خدمة التعرف الصوتي غير مثبَّتة على الجهاز.',
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

interface NoorSpeechPlugin {
  available(): Promise<{ available: boolean; onDeviceAvailable?: boolean; sdk?: number }>;
  checkMicPermission(): Promise<{ microphone: string }>;
  requestMicPermission(): Promise<{ microphone: string }>;
  start(options: { language: string; contextualStrings?: string[]; preferOffline?: boolean }): Promise<void>;
  stop(): Promise<void>;
  forceStop(): Promise<void>;
  getLastPartialResult(): Promise<{ text: string }>;
  addListener(event: string, handler: (data: Record<string, unknown>) => void): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

let noorPlugin: NoorSpeechPlugin | null = null;
async function getNoorPlugin(): Promise<NoorSpeechPlugin> {
  if (!noorPlugin) {
    const { registerPlugin } = await import('@capacitor/core');
    noorPlugin = registerPlugin<NoorSpeechPlugin>('NoorSpeech');
  }
  return noorPlugin;
}

class NoorNativeProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'native' as const;
  readonly name = 'التعرف الصوتي الأصلي في أندرويد';
  readonly networkRequirement: NetworkRequirement = 'optional';
  private callbacks: RecognitionCallbacks = {};
  private listeners: { remove: () => void }[] = [];
  private lifecycle: RecognizerLifecycle = 'idle';
  private committed = '';
  private interim = '';
  private stopRequested = false;
  private finalDelivered = false;
  private gotPartial = false;
  private partialTimer: ReturnType<typeof setTimeout> | null = null;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;

  async isAvailable() {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NoorSpeech')) return false;
    try {
      const result = await (await getNoorPlugin()).available();
      console.log('[speech/noor] available():', JSON.stringify(result));
      return result.available === true;
    } catch (error) { console.error('[speech/noor] availability failed', error); return false; }
  }
  private normalize(value: string): PermissionResult {
    return value === 'granted' ? 'granted' : value === 'denied' ? 'denied' : 'prompt';
  }
  async checkPermission(): Promise<PermissionResult> {
    try { return this.normalize((await (await getNoorPlugin()).checkMicPermission()).microphone); }
    catch (error) { console.error('[speech/noor] permission check failed', error); return 'prompt'; }
  }
  async requestPermission(): Promise<PermissionResult> {
    try { return this.normalize((await (await getNoorPlugin()).requestMicPermission()).microphone); }
    catch (error) { console.error('[speech/noor] permission request failed', error); return 'denied'; }
  }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    const lang = preferred.toLowerCase().startsWith('ar') ? preferred : 'ar-SA';
    return { lang, supported: true, substituted: lang !== preferred };
  }

  private emit() { this.callbacks.onPartialResult?.(mergeTranscript(this.committed, this.interim)); }
  private markListening() {
    if (this.finalDelivered || this.stopRequested) return;
    if (this.lifecycle !== 'listening') this.callbacks.onStateChange?.('listening');
    this.lifecycle = 'listening';
  }

  async startListening(language: string, callbacks: RecognitionCallbacks, options: RecognitionOptions = {}): Promise<boolean> {
    if (this.lifecycle !== 'idle' || !acquire(this)) return false;
    this.lifecycle = 'starting';
    this.callbacks = callbacks;
    this.committed = '';
    this.interim = '';
    this.stopRequested = false;
    this.finalDelivered = false;
    this.gotPartial = false;
    try {
      const plugin = await getNoorPlugin();
      // No listener from a previous attempt may survive into this session.
      await plugin.removeAllListeners();
      this.listeners = [
        await plugin.addListener('partialResults', data => {
          const text = String(data?.text || '');
          if (!text || this.finalDelivered) return;
          this.gotPartial = true;
          this.clearPartialTimer();
          this.markListening();
          this.interim = text;
          this.emit();
        }),
        await plugin.addListener('segmentResults', data => {
          const text = String(data?.text || '');
          if (!text || this.finalDelivered) return;
          this.gotPartial = true;
          this.clearPartialTimer();
          this.markListening();
          this.committed = mergeTranscript(this.committed, text);
          this.interim = '';
          this.emit();
        }),
        // Proves Android's recognizer actually owns the microphone.
        await plugin.addListener('audioLevel', () => this.markListening()),
        await plugin.addListener('listeningState', data => {
          // The plugin reopens itself on silence; 'stopped' only arrives when we asked.
          if (data?.state === 'stopped') { if (this.stopRequested) void this.finish(); return; }
          this.markListening();
        }),
        await plugin.addListener('error', event => {
          console.error('[speech/noor] recognizer error', JSON.stringify(event));
          if (this.finalDelivered) return;
          if (this.lifecycle === 'starting') { void this.failStart(event); return; }
          if (!this.stopRequested) this.callbacks.onError?.(nativeErrorMessage(event), event);
          void this.finish();
        }),
      ];
      await plugin.start({
        language: language.toLowerCase().startsWith('ar') ? language : 'ar-SA',
        contextualStrings: (options.contextualStrings || []).filter(Boolean).slice(0, 300),
      });
      this.markListening();
      this.clearPartialTimer();
      this.partialTimer = setTimeout(() => {
        if (this.finalDelivered || this.gotPartial) return;
        this.callbacks.onError?.(noPartialMessage);
        void this.forceStopAndFinish();
      }, NO_PARTIAL_TIMEOUT_MS);
      return true;
    } catch (error) {
      await this.failStart(error);
      return false;
    }
  }

  private clearPartialTimer() { if (this.partialTimer) clearTimeout(this.partialTimer); this.partialTimer = null; }
  private clearTimers() { this.clearPartialTimer(); if (this.guardTimer) clearTimeout(this.guardTimer); this.guardTimer = null; }
  private async clearListeners() {
    for (const listener of this.listeners) { try { listener.remove(); } catch { /* already gone */ } }
    this.listeners = [];
    try { await (await getNoorPlugin()).removeAllListeners(); } catch { /* already gone */ }
  }
  private async forceStopAndFinish() {
    this.stopRequested = true;
    try { await (await getNoorPlugin()).forceStop(); } catch (error) { console.error('[speech/noor] forceStop failed', error); }
    await this.finish();
  }
  /** The single termination path: runs at most once per attempt. */
  private async finish() {
    if (this.finalDelivered) return;
    this.finalDelivered = true;
    this.lifecycle = 'processing';
    this.clearTimers();
    try {
      const last = await (await getNoorPlugin()).getLastPartialResult();
      if (last?.text) this.committed = mergeTranscript(this.committed, String(last.text));
    } catch { /* keep what we already have */ }
    const result = mergeTranscript(this.committed, this.interim).trim();
    await this.clearListeners();
    this.lifecycle = 'idle';
    release(this);
    this.callbacks.onStateChange?.('completed');
    this.callbacks.onFinalResult?.(result);
  }
  private async failStart(error: unknown) {
    if (this.finalDelivered) return;
    console.error('[speech/noor] start failed', error);
    this.finalDelivered = true;
    this.clearTimers();
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
    this.clearPartialTimer();
    try { await (await getNoorPlugin()).stop(); } catch (error) { console.error('[speech/noor] stop failed', error); }
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => { void this.forceStopAndFinish(); }, STOP_GUARD_MS);
  }
  async dispose() {
    this.stopRequested = true;
    this.clearTimers();
    if (this.lifecycle !== 'idle') {
      try { await (await getNoorPlugin()).forceStop(); } catch (error) { console.error('[speech/noor] dispose failed', error); }
    }
    this.finalDelivered = true;
    await this.clearListeners();
    this.committed = '';
    this.interim = '';
    this.lifecycle = 'idle';
    release(this);
  }
}

/** Used off-Android: the UI stays honest instead of pretending to listen. */
class NoProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'none' as const;
  readonly name = 'غير متاح';
  readonly networkRequirement: NetworkRequirement = 'unknown';
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
  const noor = new NoorNativeProvider();
  if (await noor.isAvailable()) return (cachedProvider = noor);
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
    pluginAvailable: native ? 'غير مسجّلة داخل APK — ثبّت النسخة الجديدة' : 'المحرك الأصلي يعمل على الهاتف فقط',
    pluginVersion: 'NoorSpeech (محرك أندرويد الأصلي)',
    permissionBefore: 'غير مفحوص',
    permissionAfter: 'غير مطلوب',
    languages: native ? 'غير قابل للفحص' : 'ar-SA على الهاتف فقط',
    online: isOnline(),
  };
  if (native && Capacitor.isPluginAvailable('NoorSpeech')) {
    try {
      const plugin = await getNoorPlugin();
      report.pluginAvailable = `NoorSpeech: ${JSON.stringify(await plugin.available())}`;
      report.languages = 'ar-SA عبر خدمة التعرف في النظام';
    } catch (error) { report.pluginAvailable = `فشل NoorSpeech: ${String(error)}`; }
  }
  report.permissionBefore = await provider.checkPermission();
  if (report.permissionBefore !== 'granted') report.permissionAfter = await provider.requestPermission();
  return report;
}
