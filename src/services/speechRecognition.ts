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
 * Only one microphone session can exist at a time — enforced here, so
 * hammering the record button cannot open a second recognizer.
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

export type PermissionResult = 'granted' | 'denied' | 'prompt';

export interface RecognitionCallbacks {
  /** Live (interim) text — never used for grading. */
  onPartialResult?: (text: string) => void;
  /** Best final text once listening stopped. */
  onFinalResult?: (text: string) => void;
  onStateChange?: (state: MicState) => void;
  onError?: (message: string, technical?: unknown) => void;
}

export interface QuranSpeechRecognitionProvider {
  readonly id: 'native' | 'web' | 'none';
  readonly name: string;
  /** Recognition may need the network (used to warn, never to block). */
  readonly requiresNetwork: boolean;
  isAvailable(): Promise<boolean>;
  checkPermission(): Promise<PermissionResult>;
  requestPermission(): Promise<PermissionResult>;
  startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean>;
  stopListening(): Promise<void>;
  /** Hard release of every resource — used on unmount / interruptions. */
  dispose(): Promise<void>;
}

/* ─────────────── shared single-session guard ─────────────── */

let sessionBusy = false;

function pickBest(matches: string[] | undefined): string {
  if (!matches || matches.length === 0) return '';
  // The engines return alternatives ordered by confidence; the longest of the
  // top alternatives is usually the most complete recitation.
  return matches.slice(0, 3).reduce((a, b) => (b && b.length > a.length ? b : a), matches[0] || '');
}

/* ─────────────── native (Capacitor) ─────────────── */

class NativeProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'native' as const;
  readonly name = 'التعرف الصوتي في النظام';
  readonly requiresNetwork = false; // Android may use on-device models

  private listeners: { remove: () => void }[] = [];
  private cb: RecognitionCallbacks = {};
  private segments: string[] = [];
  private lastPartial = '';
  private active = false;
  private lang = 'ar-SA';

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

  async startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean> {
    if (sessionBusy) return false;
    sessionBusy = true;
    this.cb = cb;
    this.lang = lang;
    this.segments = [];
    this.lastPartial = '';
    this.active = true;

    try {
      const p = await this.plugin();
      const partialHandle = await p.addListener('partialResults', (data) => {
        const text = pickBest(data?.matches);
        if (!text) return;
        this.lastPartial = text;
        const joined = [...this.segments, text].join(' ').trim();
        this.cb.onPartialResult?.(joined);
      });
      const stateHandle = await p.addListener('listeningState', (data) => {
        if (data?.status !== 'stopped') return;
        // Android's recognizer closes itself after a silence gap. While the
        // student has not pressed "إنهاء التسميع", keep the session going.
        if (this.lastPartial) {
          this.segments.push(this.lastPartial);
          this.lastPartial = '';
        }
        if (this.active) void this.restart();
        else this.finish();
      });
      this.listeners.push(partialHandle, stateHandle);

      await p.start({
        language: this.lang,
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
      cb.onStateChange?.('listening');
      return true;
    } catch (e) {
      console.error('[speech/native] start failed', e);
      sessionBusy = false;
      this.active = false;
      await this.clearListeners();
      cb.onError?.('تعذّر تشغيل الميكروفون', e);
      cb.onStateChange?.('error');
      return false;
    }
  }

  private async restart() {
    try {
      const p = await this.plugin();
      if (!this.active) return;
      await p.start({ language: this.lang, maxResults: 5, partialResults: true, popup: false });
    } catch (e) {
      console.error('[speech/native] restart failed', e);
      this.active = false;
      this.finish();
    }
  }

  private finish() {
    const finalText = [...this.segments, this.lastPartial].join(' ').replace(/\s+/g, ' ').trim();
    this.segments = [];
    this.lastPartial = '';
    void this.clearListeners();
    sessionBusy = false;
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
    if (!sessionBusy) return;
    this.active = false;
    this.cb.onStateChange?.('processing');
    try {
      const p = await this.plugin();
      await p.stop();
    } catch (e) {
      console.error('[speech/native] stop failed', e);
    }
    // `listeningState: stopped` normally finishes; guard in case it never fires.
    setTimeout(() => { if (sessionBusy) this.finish(); }, 1200);
  }

  async dispose(): Promise<void> {
    this.active = false;
    try {
      const p = await this.plugin();
      await p.stop();
    } catch { /* recognizer already closed */ }
    await this.clearListeners();
    sessionBusy = false;
  }
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
  readonly requiresNetwork = true;

  private rec: WebRecognition | null = null;
  private cb: RecognitionCallbacks = {};
  private finalText = '';
  private active = false;

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

  async startListening(lang: string, cb: RecognitionCallbacks): Promise<boolean> {
    if (sessionBusy) return false;
    const Ctor = webCtor();
    if (!Ctor) { cb.onStateChange?.('unavailable'); return false; }
    sessionBusy = true;
    this.cb = cb;
    this.finalText = '';
    this.active = true;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r[0]?.transcript || '').trim();
        if (!text) continue;
        if (r.isFinal) this.finalText = `${this.finalText} ${text}`.trim();
        else interim = `${interim} ${text}`.trim();
      }
      this.cb.onPartialResult?.(`${this.finalText} ${interim}`.trim());
    };
    rec.onerror = (event: any) => {
      if (event?.error === 'not-allowed') {
        this.active = false;
        this.cb.onStateChange?.('permissionDenied');
      } else if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('[speech/web] error', event.error);
        this.cb.onError?.('تعذّر التعرف على الصوت', event.error);
      }
    };
    rec.onend = () => {
      if (this.active) {
        try { rec.start(); return; } catch (e) { console.error('[speech/web] restart failed', e); }
      }
      this.rec = null;
      sessionBusy = false;
      this.cb.onStateChange?.('completed');
      this.cb.onFinalResult?.(this.finalText.trim());
    };

    this.rec = rec;
    try {
      rec.start();
      cb.onStateChange?.('listening');
      return true;
    } catch (e) {
      console.error('[speech/web] start failed', e);
      this.rec = null;
      this.active = false;
      sessionBusy = false;
      cb.onError?.('تعذّر تشغيل الميكروفون', e);
      cb.onStateChange?.('error');
      return false;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.rec) { sessionBusy = false; return; }
    this.active = false;
    this.cb.onStateChange?.('processing');
    try { this.rec.stop(); } catch (e) { console.error('[speech/web] stop failed', e); }
  }

  async dispose(): Promise<void> {
    this.active = false;
    if (this.rec) {
      try { this.rec.abort(); } catch { /* already closed */ }
      this.rec = null;
    }
    sessionBusy = false;
  }
}

class NoProvider implements QuranSpeechRecognitionProvider {
  readonly id = 'none' as const;
  readonly name = 'غير متاح';
  readonly requiresNetwork = false;
  async isAvailable() { return false; }
  async checkPermission(): Promise<PermissionResult> { return 'denied'; }
  async requestPermission(): Promise<PermissionResult> { return 'denied'; }
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
