/**
 * QuranSpeechRecognitionProvider
 * ------------------------------------------------------------------
 * An engine-independent speech-recognition layer.
 *
 * The memorization session only ever calls:
 *   startListening() / stopListening() / onPartialResult() / onFinalResult()
 * and never knows which engine is behind it.
 *
 * Two implementations ship today:
 *   - native : @capacitor-community/speech-recognition (Android/iOS, the
 *              path the APK actually uses)
 *   - web    : window.SpeechRecognition (desktop browsers / preview only)
 *
 * Lifecycle is an explicit state machine with a single global lock, so
 * start/stop/restart/dispose can never race: a new recognizer is never opened
 * while the previous one is still closing, and "stop" always beats the
 * automatic restart that follows an Android silence gap.
 */

import { Capacitor } from '@capacitor/core';

export type MicState =
  | 'idle'
  | 'requestingPermission'
  | 'listening'
  | 'processing'
  | 'completed'
  | 'permissionDenied'
  | 'unavailable'
  | 'error';

/** Internal lifecycle of the recognizer itself. */
export type RecognizerLifecycle =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'restarting'
  | 'stopping'
  | 'processing';

export type PermissionResult = 'granted' | 'denied' | 'prompt';

/**
 * Whether the engine needs the network. Android decides per device, language
 * and installed system components — so it is honestly reported as 'unknown'
 * and handled by trying, never by assuming.
 */
export type NetworkRequirement = 'required' | 'optional' | 'unknown';

export interface RecognitionCallbacks {
  /** Live (interim) text — never used for grading. */
  onPartialResult?: (text: string) => void;
  /** Best final text once listening stopped. Fires exactly once per session. */
  onFinalResult?: (text: string) => void;
  onStateChange?: (state: MicState) => void;
  onError?: (message: string, technical?: unknown) => void;
}

export interface LanguageCheck {
  /** The language that will actually be used. */
  lang: string;
  supported: boolean;
  /** True when the requested Arabic was replaced by another Arabic locale. */
  substituted: boolean;
}

export interface QuranSpeechRecognitionProvider {
  readonly id: 'native' | 'web' | 'none';
  readonly name: string;
  readonly networkRequirement: NetworkRequirement;
  isAvailable(): Promise<boolean>;
  checkPermission(): Promise<PermissionResult>;
  requestPermission(): Promise<PermissionResult>;
  /** Verifies an Arabic locale exists; never silently switches to another language. */
  resolveLanguage(preferred: string): Promise<LanguageCheck>;
  startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean>;
  stopListening(): Promise<void>;
  /** Hard release of every resource — used on unmount / interruptions. */
  dispose(): Promise<void>;
}

/* ─────────────── shared single-session lock ─────────────── */

let lockOwner: object | null = null;

function acquireLock(owner: object): boolean {
  if (lockOwner) return false;
  lockOwner = owner;
  return true;
}

function releaseLock(owner: object) {
  if (lockOwner === owner) lockOwner = null;
}

function pickBest(matches: string[] | undefined): string {
  if (!matches || matches.length === 0) return '';
  // The engines return alternatives ordered by confidence; the longest of the
  // top alternatives is usually the most complete recitation.
  return matches.slice(0, 3).reduce((a, b) => (b && b.length > a.length ? b : a), matches[0] || '');
}

const words = (t: string) => t.split(/\s+/).filter(Boolean);

/**
 * Appends `next` to `base` without repeating the overlap.
 * Android restarts its recognizer after a silence gap and frequently replays
 * the tail of the previous phase as the head of the new one.
 */
export function mergeTranscript(base: string, next: string): string {
  const a = words(base);
  const b = words(next);
  if (b.length === 0) return a.join(' ');
  if (a.length === 0) return b.join(' ');
  const max = Math.min(a.length, b.length);
  for (let k = max; k > 0; k--) {
    const tail = a.slice(a.length - k).join(' ');
    const head = b.slice(0, k).join(' ');
    if (tail === head) return [...a, ...b.slice(k)].join(' ');
  }
  return [...a, ...b].join(' ');
}

/* ─────────────── native (Capacitor) ─────────────── */

class NativeProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'native' as const;
  readonly name = 'التعرف الصوتي في النظام';
  /** Android may or may not have an on-device model — decided by trying. */
  readonly networkRequirement: NetworkRequirement = 'unknown';

  private listeners: { remove: () => void }[] = [];
  private cb: RecognitionCallbacks = {};
  private accumulated = '';
  private lastPartial = '';
  private lifecycle: RecognizerLifecycle = 'idle';
  private stopRequested = false;
  private finished = false;
  private lang = 'ar-SA';
  private guardTimer: ReturnType<typeof setTimeout> | null = null;

  private async plugin() {
    const mod = await import('@capacitor-community/speech-recognition');
    return mod.SpeechRecognition;
  }

  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const p = await this.plugin();
      const res = await p.available();
      return !!res?.available;
    } catch (e) {
      console.error('[speech/native] availability check failed', e);
      return false;
    }
  }

  async checkPermission(): Promise<PermissionResult> {
    try {
      const p = await this.plugin();
      const res = await p.checkPermissions();
      return (res?.speechRecognition as PermissionResult) || 'prompt';
    } catch (e) {
      console.error('[speech/native] permission check failed', e);
      return 'prompt';
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    try {
      const p = await this.plugin();
      const res = await p.requestPermissions();
      return (res?.speechRecognition as PermissionResult) || 'denied';
    } catch (e) {
      console.error('[speech/native] permission request failed', e);
      return 'denied';
    }
  }

  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    const want = preferred || 'ar-SA';
    try {
      const p = await this.plugin();
      const res = await p.getSupportedLanguages();
      const list = (res?.languages as string[] | undefined)?.map(String) || [];
      if (list.length === 0) return { lang: want, supported: true, substituted: false };
      if (list.some(l => l.toLowerCase() === want.toLowerCase())) {
        return { lang: want, supported: true, substituted: false };
      }
      const arabic = list.find(l => l.toLowerCase().startsWith('ar'));
      if (arabic) return { lang: arabic, supported: true, substituted: true };
      return { lang: want, supported: false, substituted: false };
    } catch (e) {
      console.error('[speech/native] language list failed', e);
      // Unable to enumerate — try the requested Arabic rather than guessing.
      return { lang: want, supported: true, substituted: false };
    }
  }

  async startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean> {
    if (this.lifecycle !== 'idle') return false;
    if (!acquireLock(this)) return false;

    this.lifecycle = 'starting';
    this.cb = cb;
    this.lang = lang || 'ar-SA';
    this.accumulated = '';
    this.lastPartial = '';
    this.stopRequested = false;
    this.finished = false;

    try {
      const p = await this.plugin();
      const partialHandle = await p.addListener('partialResults', (data) => {
        const text = pickBest(data?.matches);
        if (!text) return;
        this.lastPartial = text;
        this.cb.onPartialResult?.(mergeTranscript(this.accumulated, text));
      });
      const stateHandle = await p.addListener('listeningState', (data) => {
        if (data?.status !== 'stopped') return;
        if (this.lastPartial) {
          this.accumulated = mergeTranscript(this.accumulated, this.lastPartial);
          this.lastPartial = '';
        }
        // Android closes the recognizer after a silence gap. Keep going unless
        // the student asked to finish — "stop" always wins.
        if (this.stopRequested || this.lifecycle === 'stopping') {
          void this.finish();
        } else if (this.lifecycle === 'listening') {
          void this.restart();
        }
      });
      this.listeners.push(partialHandle, stateHandle);

      await p.start({ language: this.lang, maxResults: 5, partialResults: true, popup: false });

      if (this.stopRequested) {
        // Stop pressed while we were still starting.
        await this.finish();
        return true;
      }
      this.lifecycle = 'listening';
      cb.onStateChange?.('listening');
      return true;
    } catch (e) {
      console.error('[speech/native] start failed', e);
      await this.clearListeners();
      this.lifecycle = 'idle';
      releaseLock(this);
      cb.onError?.(describeNativeError(e), e);
      cb.onStateChange?.('error');
      return false;
    }
  }

  private async restart() {
    this.lifecycle = 'restarting';
    try {
      const p = await this.plugin();
      if (this.stopRequested) { await this.finish(); return; }
      await p.start({ language: this.lang, maxResults: 5, partialResults: true, popup: false });
      if (this.stopRequested) { await this.finish(); return; }
      this.lifecycle = 'listening';
    } catch (e) {
      console.error('[speech/native] restart failed', e);
      await this.finish();
    }
  }

  private async finish() {
    if (this.finished) return;
    this.finished = true;
    this.lifecycle = 'processing';
    if (this.guardTimer) { clearTimeout(this.guardTimer); this.guardTimer = null; }

    const finalText = mergeTranscript(this.accumulated, this.lastPartial).replace(/\s+/g, ' ').trim();
    this.accumulated = '';
    this.lastPartial = '';

    // Listeners must be gone before another session may open.
    await this.clearListeners();
    this.lifecycle = 'idle';
    releaseLock(this);

    this.cb.onStateChange?.('completed');
    this.cb.onFinalResult?.(finalText);
  }

  private async clearListeners() {
    for (const l of this.listeners) {
      try { l.remove(); } catch (e) { console.error('[speech/native] listener remove failed', e); }
    }
    this.listeners = [];
    try {
      const p = await this.plugin();
      await p.removeAllListeners();
    } catch (e) {
      console.error('[speech/native] removeAllListeners failed', e);
    }
  }

  async stopListening(): Promise<void> {
    if (this.lifecycle === 'idle' || this.finished) return;
    this.stopRequested = true;
    this.lifecycle = 'stopping';
    this.cb.onStateChange?.('processing');
    try {
      const p = await this.plugin();
      await p.stop();
    } catch (e) {
      console.error('[speech/native] stop failed', e);
    }
    // `listeningState: stopped` normally finishes; never lose the transcript
    // just because that event is late.
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => { void this.finish(); }, 2000);
  }

  async dispose(): Promise<void> {
    this.stopRequested = true;
    if (this.guardTimer) { clearTimeout(this.guardTimer); this.guardTimer = null; }
    if (this.lifecycle === 'idle' && this.listeners.length === 0) { releaseLock(this); return; }
    this.finished = true;
    try {
      const p = await this.plugin();
      await p.stop();
    } catch { /* recognizer already closed */ }
    await this.clearListeners();
    this.accumulated = '';
    this.lastPartial = '';
    this.lifecycle = 'idle';
    releaseLock(this);
  }
}

function describeNativeError(e: unknown): string {
  const msg = String((e as { message?: string })?.message || e || '').toLowerCase();
  if (msg.includes('network')) {
    return 'التعرف الصوتي غير متاح حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.';
  }
  if (msg.includes('not available') || msg.includes('unavailable') || msg.includes('no match') || msg.includes('service')) {
    return 'التعرف الصوتي غير متاح حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.';
  }
  return 'تعذّر تشغيل الميكروفون — أعد المحاولة.';
}

/* ─────────────── web fallback ─────────────── */

interface WebRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function webCtor(): (new () => WebRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

class WebProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'web' as const;
  readonly name = 'التعرف الصوتي في المتصفح';
  readonly networkRequirement: NetworkRequirement = 'required';

  private rec: WebRecognition | null = null;
  private cb: RecognitionCallbacks = {};
  private finalText = '';
  private lifecycle: RecognizerLifecycle = 'idle';
  private stopRequested = false;
  private finished = false;

  async isAvailable(): Promise<boolean> {
    return webCtor() !== null;
  }

  async checkPermission(): Promise<PermissionResult> {
    try {
      const status = await (navigator as any)?.permissions?.query?.({ name: 'microphone' });
      return (status?.state as PermissionResult) || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return 'granted';
    } catch (e) {
      console.error('[speech/web] mic permission denied', e);
      return 'denied';
    }
  }

  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    // Browsers expose no reliable list; the requested Arabic is used as-is.
    return { lang: preferred || 'ar-SA', supported: true, substituted: false };
  }

  private settle() {
    if (this.finished) return;
    this.finished = true;
    this.rec = null;
    this.lifecycle = 'idle';
    releaseLock(this);
    const text = this.finalText.trim();
    this.finalText = '';
    this.cb.onStateChange?.('completed');
    this.cb.onFinalResult?.(text);
  }

  async startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean> {
    if (this.lifecycle !== 'idle') return false;
    const Ctor = webCtor();
    if (!Ctor) { cb.onStateChange?.('unavailable'); return false; }
    if (!acquireLock(this)) return false;

    this.lifecycle = 'starting';
    this.cb = cb;
    this.finalText = '';
    this.stopRequested = false;
    this.finished = false;

    const rec = new Ctor();
    rec.lang = lang || 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r[0]?.transcript || '').trim();
        if (!text) continue;
        if (r.isFinal) this.finalText = mergeTranscript(this.finalText, text);
        else interim = mergeTranscript(interim, text);
      }
      this.cb.onPartialResult?.(mergeTranscript(this.finalText, interim));
    };
    rec.onerror = (event: any) => {
      if (event?.error === 'not-allowed') {
        this.stopRequested = true;
        this.cb.onStateChange?.('permissionDenied');
      } else if (event?.error === 'network' || event?.error === 'service-not-allowed') {
        this.stopRequested = true;
        this.cb.onError?.('التعرف الصوتي غير متاح حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.', event.error);
      } else if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('[speech/web] error', event.error);
        this.cb.onError?.('تعذّر التعرف على الصوت', event.error);
      }
    };
    rec.onend = () => {
      if (!this.stopRequested && this.lifecycle === 'listening') {
        this.lifecycle = 'restarting';
        try { rec.start(); this.lifecycle = 'listening'; return; }
        catch (e) { console.error('[speech/web] restart failed', e); }
      }
      this.settle();
    };

    this.rec = rec;
    try {
      rec.start();
      this.lifecycle = 'listening';
      cb.onStateChange?.('listening');
      return true;
    } catch (e) {
      console.error('[speech/web] start failed', e);
      this.rec = null;
      this.lifecycle = 'idle';
      releaseLock(this);
      cb.onError?.('تعذّر تشغيل الميكروفون — أعد المحاولة.', e);
      cb.onStateChange?.('error');
      return false;
    }
  }

  async stopListening(): Promise<void> {
    if (this.lifecycle === 'idle' || this.finished) return;
    this.stopRequested = true;
    this.lifecycle = 'stopping';
    this.cb.onStateChange?.('processing');
    if (!this.rec) { this.settle(); return; }
    try { this.rec.stop(); } catch (e) { console.error('[speech/web] stop failed', e); }
    setTimeout(() => this.settle(), 2000);
  }

  async dispose(): Promise<void> {
    this.stopRequested = true;
    this.finished = true;
    if (this.rec) {
      try { this.rec.abort(); } catch { /* already closed */ }
      this.rec = null;
    }
    this.finalText = '';
    this.lifecycle = 'idle';
    releaseLock(this);
  }
}

class NoProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'none' as const;
  readonly name = 'غير متاح';
  readonly networkRequirement: NetworkRequirement = 'unknown';
  async isAvailable() { return false; }
  async checkPermission(): Promise<PermissionResult> { return 'denied'; }
  async requestPermission(): Promise<PermissionResult> { return 'denied'; }
  async resolveLanguage(preferred: string): Promise<LanguageCheck> {
    return { lang: preferred || 'ar-SA', supported: false, substituted: false };
  }
  async startListening() { return false; }
  async stopListening() { /* nothing to stop */ }
  async dispose() { /* nothing to release */ }
}

let cached: QuranSpeechRecognitionProvider | null = null;

/** Picks the engine that actually works in the current environment. */
export async function getSpeechProvider(): Promise<QuranSpeechRecognitionProvider> {
  if (cached) return cached;
  const native = new NativeProvider();
  if (await native.isAvailable()) { cached = native; return cached; }
  const web = new WebProvider();
  if (await web.isAvailable()) { cached = web; return cached; }
  cached = new NoProvider();
  return cached;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
