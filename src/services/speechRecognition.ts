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

function nativeErrorMessage(error: unknown): string {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return /network|unavailable|not available|no match|service/.test(message) ? unavailableMessage : startErrorMessage;
}

class NativeProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'native' as const;
  readonly name = 'التعرف الصوتي في النظام';
  readonly networkRequirement: NetworkRequirement = 'unknown';
  private callbacks: RecognitionCallbacks = {};
  private lifecycle: RecognizerLifecycle = 'idle';
  private listeners: { remove: () => void }[] = [];
  private transcript = '';
  private partial = '';
  private language = 'ar-SA';
  private stopRequested = false;
  private finalDelivered = false;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;

  private async plugin() { return (await import('@capacitor-community/speech-recognition')).SpeechRecognition; }
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    try { return !!(await (await this.plugin()).available())?.available; }
    catch (error) { console.error('[speech/native] availability failed', error); return false; }
  }
  async checkPermission(): Promise<PermissionResult> {
    try { return (await (await this.plugin()).checkPermissions()).speechRecognition as PermissionResult || 'prompt'; }
    catch (error) { console.error('[speech/native] permission check failed', error); return 'prompt'; }
  }
  async requestPermission(): Promise<PermissionResult> {
    try { return (await (await this.plugin()).requestPermissions()).speechRecognition as PermissionResult || 'denied'; }
    catch (error) { console.error('[speech/native] permission request failed', error); return 'denied'; }
  }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    const requested = preferred.toLowerCase().startsWith('ar') ? preferred : 'ar-SA';
    try {
      const languages = (await (await this.plugin()).getSupportedLanguages()).languages || [];
      if (languages.length === 0) return { lang: requested, supported: true, substituted: requested !== preferred };
      const exact = languages.find(item => item.toLowerCase() === requested.toLowerCase());
      if (exact) return { lang: exact, supported: true, substituted: exact !== preferred };
      const arabic = languages.find(item => item.toLowerCase().startsWith('ar'));
      return arabic
        ? { lang: arabic, supported: true, substituted: true }
        : { lang: requested, supported: false, substituted: false };
    } catch (error) {
      console.error('[speech/native] language check failed', error);
      return { lang: requested, supported: true, substituted: requested !== preferred };
    }
  }
  /** Android's start() promise can stay pending while listening; never gate the UI on it. */
  private markListening() {
    if (this.finalDelivered || this.stopRequested) return;
    if (this.lifecycle === 'starting' || this.lifecycle === 'restarting') {
      this.lifecycle = 'listening';
      this.callbacks.onStateChange?.('listening');
    }
  }
  private launch() {
    const options = { language: this.language, maxResults: 5, partialResults: true, popup: false };
    void this.plugin()
      .then(plugin => plugin.start(options))
      .then(() => { if (this.stopRequested) void this.finish(); else this.markListening(); })
      .catch(error => {
        if (this.finalDelivered) return;
        if (this.lifecycle === 'listening') { console.error('[speech/native] session ended with error', error); void this.finish(); }
        else void this.failStart(error);
      });
    // Fallback: some devices only report readiness through the listeningState event.
    this.clearStartTimer();
    this.startTimer = setTimeout(() => this.markListening(), 1200);
  }
  async startListening(language: string, callbacks: RecognitionCallbacks): Promise<boolean> {
    if (this.lifecycle !== 'idle' || !acquire(this)) return false;
    this.lifecycle = 'starting';
    this.callbacks = callbacks;
    this.language = language.toLowerCase().startsWith('ar') ? language : 'ar-SA';
    this.transcript = '';
    this.partial = '';
    this.stopRequested = false;
    this.finalDelivered = false;
    try {
      const plugin = await this.plugin();
      this.listeners = [
        await plugin.addListener('partialResults', data => {
          const text = (data.matches || []).slice(0, 3).reduce((best, value) => value.length > best.length ? value : best, '');
          if (!text) return;
          this.markListening();
          this.partial = text;
          this.callbacks.onPartialResult?.(mergeTranscript(this.transcript, text));
        }),
        await plugin.addListener('listeningState', data => {
          if (data.status !== 'stopped') { this.markListening(); return; }
          this.commitPartial();
          if (this.stopRequested || this.lifecycle === 'stopping') void this.finish();
          else if (this.lifecycle === 'listening') void this.restart();
        }),
      ];
      this.launch();
      return true;
    } catch (error) {
      await this.failStart(error);
      return false;
    }
  }
  private commitPartial() {
    this.transcript = mergeTranscript(this.transcript, this.partial);
    this.partial = '';
  }
  private clearStartTimer() {
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = null;
  }
  private async restart() {
    if (this.stopRequested) { await this.finish(); return; }
    this.lifecycle = 'restarting';
    this.launch();
  }
  private async clearListeners() {
    for (const listener of this.listeners) {
      try { await listener.remove(); } catch (error) { console.error('[speech/native] listener cleanup failed', error); }
    }
    this.listeners = [];
  }
  private clearGuard() {
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = null;
  }
  private async finish() {
    if (this.finalDelivered) return;
    this.finalDelivered = true;
    this.lifecycle = 'processing';
    this.clearGuard();
    this.commitPartial();
    const result = this.transcript.trim();
    await this.clearListeners();
    this.lifecycle = 'idle';
    release(this);
    this.callbacks.onStateChange?.('completed');
    this.callbacks.onFinalResult?.(result);
  }
  private async failStart(error: unknown) {
    console.error('[speech/native] start failed', error);
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
    this.guardTimer = setTimeout(() => { void this.finish(); }, 2000);
  }
  async dispose() {
    this.stopRequested = true;
    this.clearGuard();
    if (this.lifecycle !== 'idle') {
      try { await (await this.plugin()).stop(); } catch (error) { console.error('[speech/native] dispose stop failed', error); }
    }
    this.finalDelivered = true;
    await this.clearListeners();
    this.transcript = '';
    this.partial = '';
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
  const web = new WebProvider();
  if (await web.isAvailable()) return (cachedProvider = web);
  return (cachedProvider = new NoProvider());
}
export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
