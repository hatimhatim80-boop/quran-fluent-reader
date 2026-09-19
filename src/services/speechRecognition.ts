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

export interface RecognitionOptions {
  /** Quran words/phrases that help the native recognizer bias towards the recited text. */
  contextualStrings?: string[];
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
/** Continuous mode: after a silence gap the recognizer is relaunched in place. */
const RESTART_DELAY_MS = 350;
const STOP_GUARD_MS = 1500;
const silenceCodes = new Set(['6', '7', 'NO_MATCH', 'SPEECH_TIMEOUT']);
function isSilenceError(error: unknown): boolean {
  const raw = error as { code?: unknown; error?: unknown } | undefined;
  return silenceCodes.has(String(raw?.code ?? raw?.error ?? '').trim());
}
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
  private contextualStrings: string[] = [];
  private stopRequested = false;
  private finalDelivered = false;
  private gotPartial = false;
  private startInFlight = false;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;
  private partialTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  private async plugin() { return (await import('@capgo/capacitor-speech-recognition')).SpeechRecognition; }

  /** On a native build this provider is the ONLY possible one: the Android WebView
   *  has no window.SpeechRecognition, so never fall back to the web provider. */
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    if (!Capacitor.isPluginAvailable('SpeechRecognition')) {
      console.error('[speech/native]', missingNativePluginMessage);
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
    this.clearRestartTimer();
    if (this.lifecycle !== 'listening') this.callbacks.onStateChange?.('listening');
    this.lifecycle = 'listening';
  }

  private applyPartial(text: string) {
    if (!text || this.finalDelivered) return;
    this.gotPartial = true;
    this.clearPartialTimer();
    this.markListening();
    this.transcript = mergeTranscript(this.transcript, text);
    this.callbacks.onPartialResult?.(this.transcript);
  }

  /** The single place that talks to plugin.start(); serialized so no second
   *  microphone session can ever be opened for the same attempt. */
  private async launch() {
    if (this.finalDelivered || this.stopRequested || this.startInFlight) return;
    this.startInFlight = true;
    try {
      await (await this.plugin()).start({
        language: this.language,
        maxResults: 5,
        partialResults: true,
        popup: false,
        continuousPTT: true,
        allowForSilence: 1500,
        muteRecognizerBeep: true,
        ...(this.contextualStrings.length ? { contextualStrings: this.contextualStrings } : {}),
      });
      if (!this.stopRequested) this.markListening();
    } catch (error) {
      if (this.finalDelivered) return;
      if (this.lifecycle === 'starting') await this.failStart(error);
      else if (!this.stopRequested && isSilenceError(error)) this.scheduleRestart();
      else { console.error('[speech/native] session ended with error', error); await this.finish(); }
    } finally {
      this.startInFlight = false;
    }
  }

  async startListening(language: string, callbacks: RecognitionCallbacks, options: RecognitionOptions = {}): Promise<boolean> {
    if (this.lifecycle !== 'idle' || !acquire(this)) return false;
    this.lifecycle = 'starting';
    this.callbacks = callbacks;
    this.language = language.toLowerCase().startsWith('ar') ? language : 'ar-SA';
    this.contextualStrings = (options.contextualStrings || []).filter(Boolean).slice(0, 200);
    this.transcript = '';
    this.stopRequested = false;
    this.finalDelivered = false;
    this.gotPartial = false;
    try {
      const plugin = await this.plugin();
      // Never let a previous attempt's listeners survive into this session.
      await plugin.removeAllListeners();
      const bestMatch = (matches?: string[]) => (matches || []).reduce((top, value) => value.length > top.length ? value : top, '');
      this.listeners = [
        await plugin.addListener('partialResults', data => this.applyPartial(data.accumulatedText || bestMatch(data.matches))),
        // Android continuous mode closes each silence-delimited segment separately.
        await plugin.addListener('segmentResults', data => this.applyPartial(bestMatch(data.matches))),
        // Proves Android's native recognizer actually owns the microphone.
        await plugin.addListener('audioLevel', () => this.markListening()),
        await plugin.addListener('listeningState', data => {
          const stopped = data.state === 'stopped' || data.status === 'stopped';
          if (!stopped) { this.markListening(); return; }
          if (this.stopRequested || this.lifecycle === 'stopping') { void this.finish(); return; }
          this.scheduleRestart();
        }),
        await plugin.addListener('error', event => {
          console.error('[speech/native] recognizer error', JSON.stringify(event), event);
          if (this.finalDelivered) return;
          // Silence/no-match inside a continuous session is normal: relaunch in place.
          if (!this.stopRequested && isSilenceError(event)) { this.scheduleRestart(); return; }
          if (this.lifecycle === 'starting') { void this.failStart(event); return; }
          if (!this.stopRequested) this.callbacks.onError?.(nativeErrorMessage(event), event);
          void this.finish();
        }),
      ];

      // start() may only resolve when the recognizer closes: never gate the UI on it.
      void this.launch();
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

  /** Silence closed the recognizer — resume listening in the same session. */
  private scheduleRestart() {
    if (this.finalDelivered || this.stopRequested || this.restartTimer) return;
    this.lifecycle = 'restarting';
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.launch();
    }, RESTART_DELAY_MS);
  }
  private clearRestartTimer() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }
  private clearPartialTimer() {
    if (this.partialTimer) clearTimeout(this.partialTimer);
    this.partialTimer = null;
  }
  private clearTimers() {
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = null;
    this.clearPartialTimer();
    this.clearRestartTimer();
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
    this.clearRestartTimer();
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
  /** The single termination path: runs at most once per attempt. */
  private async finish() {
    if (this.finalDelivered) return;
    this.finalDelivered = true;
    this.lifecycle = 'processing';
    this.clearTimers();
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
    if (this.finalDelivered) return;
    console.error('[speech/native] start failed', error);
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
    this.clearTimers();
    try { await (await this.plugin()).stop(); }
    catch (error) { console.error('[speech/native] stop failed', error); }
    this.guardTimer = setTimeout(() => { void this.forceStopAndFinish(); }, STOP_GUARD_MS);
  }
  async dispose() {
    this.stopRequested = true;
    this.clearTimers();
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

/** Android's own SpeechRecognizer, driven by the in-app NoorSpeech plugin:
 *  live partial results, Arabic biasing strings and a continuous session that
 *  Android reopens on silence — the same path the reference app uses. */
interface NoorSpeechPlugin {
  available(): Promise<{ available: boolean; onDeviceAvailable?: boolean; sdk?: number }>;
  checkMicPermission(): Promise<{ microphone: string }>;
  requestMicPermission(): Promise<{ microphone: string }>;
  start(options: { language: string; contextualStrings?: string[]; preferOffline?: boolean }): Promise<void>;
  stop(): Promise<void>;
  forceStop(): Promise<void>;
  getLastPartialResult(): Promise<{ text: string }>;
  addListener(event: string, handler: (data: any) => void): Promise<{ remove: () => void }>;
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
        await plugin.addListener('audioLevel', () => this.markListening()),
        await plugin.addListener('listeningState', data => {
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
