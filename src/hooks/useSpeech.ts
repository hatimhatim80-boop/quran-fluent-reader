/**
 * Unified Speech Recognition Hook (Provider Pattern)
 * 
 * Auto-selects between:
 * - Native provider (Capacitor: Android SpeechRecognizer / iOS SFSpeechRecognizer)
 * - Web provider (Web Speech API)
 * 
 * Returns a consistent API regardless of platform.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpeechProviderType = 'native' | 'web' | 'none';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export interface UseSpeechReturn {
  start: (lang?: string) => Promise<boolean>;
  stop: () => Promise<void>;
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  permissionState: PermissionState;
  error: string | null;
  providerType: SpeechProviderType;
}

// ─── Detect provider ────────────────────────────────────────────────────────

function detectProvider(): SpeechProviderType {
  const isNative = Capacitor.isNativePlatform();
  console.log('[useSpeech] Is Native Platform:', isNative);

  if (isNative) {
    // Only use native on actual native platforms (APK/iOS)
    const registered = Capacitor.isPluginAvailable('SpeechRecognition');
    console.log('[useSpeech] Native SpeechRecognition plugin available:', registered);
    if (registered) return 'native';
  }

  // Web Speech API — only for browser (never on native)
  if (!isNative) {
    const w = window as any;
    if (w.SpeechRecognition || w.webkitSpeechRecognition) {
      return 'web';
    }
  }

  return 'none';
}

// ─── Native Provider helpers ─────────────────────────────────────────────────

async function getNativeSpeechPlugin() {
  try {
    const mod = await import('@capacitor-community/speech-recognition');
    return mod.SpeechRecognition;
  } catch {
    return null;
  }
}

// ─── Web Provider helpers ────────────────────────────────────────────────────

interface WebSpeechInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getWebSpeechCtor(): (new () => WebSpeechInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSpeech(): UseSpeechReturn {
  const [providerType] = useState<SpeechProviderType>(() => {
    const p = detectProvider();
    console.log('[useSpeech] Speech provider:', p);
    return p;
  });

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [error, setError] = useState<string | null>(null);

  const webRecRef = useRef<WebSpeechInstance | null>(null);
  const nativeListenerRef = useRef<any>(null);
  const nativeEndListenerRef = useRef<any>(null);
  const autoRestartRef = useRef(false);
  const nativeLangRef = useRef('ar-SA');

  // ── Check permission on mount ──
  useEffect(() => {
    if (providerType === 'native') {
      (async () => {
        try {
          const plugin = await getNativeSpeechPlugin();
          if (!plugin) { setPermissionState('denied'); return; }
          const result = await plugin.checkPermissions();
          const state = result?.speechRecognition || 'prompt';
          setPermissionState(state as PermissionState);
        } catch {
          setPermissionState('unknown');
        }
      })();
    } else if (providerType === 'web') {
      setPermissionState('granted'); // Web Speech doesn't have explicit permission API
    } else {
      setPermissionState('denied');
    }
  }, [providerType]);

  // ── Stop ──
  const stop = useCallback(async () => {
    autoRestartRef.current = false;
    setIsListening(false);

    if (providerType === 'native') {
      try {
        const plugin = await getNativeSpeechPlugin();
        if (plugin) {
          await plugin.stop();
          if (nativeListenerRef.current) {
            await nativeListenerRef.current.remove();
            nativeListenerRef.current = null;
          }
          if (nativeEndListenerRef.current) {
            await nativeEndListenerRef.current.remove();
            nativeEndListenerRef.current = null;
          }
        }
      } catch {}
    } else if (providerType === 'web') {
      try { webRecRef.current?.abort(); } catch {}
      webRecRef.current = null;
    }
  }, [providerType]);

  // ── Start ──
  const start = useCallback(async (lang = 'ar-SA'): Promise<boolean> => {
    setError(null);
    setTranscript('');

    // ── Native ──
    if (providerType === 'native') {
      try {
        const plugin = await getNativeSpeechPlugin();
        if (!plugin) {
          console.error('[useSpeech] Native speech plugin not loaded');
          setError('Native speech plugin not available');
          return false;
        }

        // Check if speech recognition is available on this device
        try {
          const avail = await plugin.available();
          console.log('[useSpeech] Native available():', JSON.stringify(avail));
          if (!avail?.available) {
            setError('Speech recognition not available on this device');
            return false;
          }
        } catch (e) {
          console.log('[useSpeech] available() check failed:', e);
        }

        // Request permissions explicitly
        console.log('[useSpeech] Requesting permissions...');
        const perms = await plugin.requestPermissions();
        console.log('[useSpeech] Permission result:', JSON.stringify(perms));
        const state = perms?.speechRecognition || 'denied';
        setPermissionState(state as PermissionState);
        if (state === 'denied') {
          console.error('[useSpeech] Permission DENIED');
          setError('صلاحية الميكروفون مرفوضة. افتح إعدادات التطبيق وفعّل صلاحية الميكروفون');
          return false;
        }

        // Remove old listeners
        if (nativeListenerRef.current) {
          await nativeListenerRef.current.remove();
        }
        if (nativeEndListenerRef.current) {
          await nativeEndListenerRef.current.remove();
        }

        nativeLangRef.current = lang;
        autoRestartRef.current = true;

        // Listen for partial results
        nativeListenerRef.current = await plugin.addListener('partialResults', (data: any) => {
          console.log('[useSpeech] Native partialResults RAW:', JSON.stringify(data));
          const matches = data?.matches || data?.value;
          if (Array.isArray(matches) && matches.length > 0) {
            console.log('[useSpeech] Native transcript update:', matches[0]);
            setTranscript(matches[0]);
          } else if (typeof matches === 'string') {
            console.log('[useSpeech] Native transcript (string):', matches);
            setTranscript(matches);
          } else {
            console.log('[useSpeech] Native partialResults: no usable data');
          }
        });

        // Auto-restart when native recognition ends (silence timeout)
        nativeEndListenerRef.current = await plugin.addListener('listeningState', (data: any) => {
          const status = data?.status;
          console.log('[useSpeech] Native listeningState:', status);
          if (status === 'stopped' && autoRestartRef.current) {
            console.log('[useSpeech] Native ended, auto-restarting...');
            setTimeout(async () => {
              if (!autoRestartRef.current) return;
              try {
                const restartResult = await plugin.start({
                  language: nativeLangRef.current,
                  maxResults: 5,
                  partialResults: true,
                  popup: true,
                });
                if (restartResult?.matches && restartResult.matches.length > 0) {
                  setTranscript(restartResult.matches[0]);
                }
                console.log('[useSpeech] Native auto-restarted');
              } catch (e) {
                console.log('[useSpeech] Native auto-restart failed:', e);
                setIsListening(false);
                autoRestartRef.current = false;
              }
            }, 300);
          }
        });

        const startOpts = {
          language: lang,
          maxResults: 5,
          partialResults: true,
          popup: true,
        };
        console.log('[useSpeech] Native start options:', JSON.stringify(startOpts));
        
        // On Android, start() returns matches when partialResults is true + popup
        // We also listen via partialResults event as backup
        const result = await plugin.start(startOpts);
        console.log('[useSpeech] Native start() returned:', JSON.stringify(result));
        if (result?.matches && result.matches.length > 0) {
          setTranscript(result.matches[0]);
        }

        setIsListening(true);
        console.log('[useSpeech] Native recognition started successfully, lang:', lang);
        return true;
      } catch (err: any) {
        setError(err?.message || 'Native speech failed');
        setIsListening(false);
        autoRestartRef.current = false;
        return false;
      }
    }

    // ── Web ──
    if (providerType === 'web') {
      const Ctor = getWebSpeechCtor();
      if (!Ctor) {
        setError('Web Speech API not available');
        return false;
      }

      try { webRecRef.current?.abort(); } catch {}

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      autoRestartRef.current = true;

      rec.onstart = () => {
        setIsListening(true);
        console.log('[useSpeech] Web recognition started, lang:', lang);
      };

      rec.onresult = (event: any) => {
        let full = '';
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        setTranscript(full.trim());
      };

      rec.onerror = (event: any) => {
        const errType = event.error;
        console.log('[useSpeech] Web error:', errType);
        if (errType === 'not-allowed' || errType === 'service-not-available') {
          autoRestartRef.current = false;
          setIsListening(false);
          setError(errType);
          setPermissionState('denied');
        }
      };

      rec.onend = () => {
        if (autoRestartRef.current) {
          try {
            const newRec = new Ctor();
            newRec.lang = rec.lang;
            newRec.continuous = true;
            newRec.interimResults = true;
            newRec.maxAlternatives = 5;
            newRec.onstart = rec.onstart;
            newRec.onresult = rec.onresult;
            newRec.onerror = rec.onerror;
            newRec.onend = rec.onend;
            webRecRef.current = newRec;
            newRec.start();
          } catch {
            setIsListening(false);
            autoRestartRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      webRecRef.current = rec;
      try {
        rec.start();
        return true;
      } catch (err: any) {
        setError(err?.message || 'Web speech failed');
        return false;
      }
    }

    setError('No speech recognition available');
    return false;
  }, [providerType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoRestartRef.current = false;
      try { webRecRef.current?.abort(); } catch {}
      (async () => {
        try {
          const plugin = await getNativeSpeechPlugin();
          if (plugin) await plugin.stop();
          if (nativeListenerRef.current) await nativeListenerRef.current.remove();
          if (nativeEndListenerRef.current) await nativeEndListenerRef.current.remove();
        } catch {}
      })();
    };
  }, []);

  return {
    start,
    stop,
    transcript,
    isListening,
    isSupported: providerType !== 'none',
    permissionState,
    error,
    providerType,
  };
}
