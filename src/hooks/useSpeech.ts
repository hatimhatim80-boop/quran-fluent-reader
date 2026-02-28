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

// ─── Open Native App Settings (for when permission is permanently denied) ───

export async function openNativeAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Re-request via speech plugin — on Android, if permanently denied,
    // this may show a system dialog pointing user to settings
    const plugin = await getNativeSpeechPlugin();
    if (plugin) {
      const result = await plugin.requestPermissions();
      console.log('[useSpeech] Re-request permissions result:', JSON.stringify(result));
    }
  } catch (e) {
    console.error('[useSpeech] openNativeAppSettings error:', e);
  }
}

// ─── Native Microphone Permission (Android RECORD_AUDIO) ────────────────────

async function requestNativeMicPermission(): Promise<boolean> {
  try {
    const plugin = await getNativeSpeechPlugin();
    if (!plugin) return false;

    try {
      const check = await plugin.checkPermissions();
      console.log('[useSpeech] checkPermissions result:', JSON.stringify(check));
      if (check?.speechRecognition === 'granted') return true;
    } catch (e) {
      console.log('[useSpeech] checkPermissions threw (non-fatal):', e);
      // Continue to request even if check fails
    }

    try {
      const result = await plugin.requestPermissions();
      console.log('[useSpeech] requestPermissions result:', JSON.stringify(result));
      if (result?.speechRecognition === 'granted') return true;
    } catch (e) {
      console.log('[useSpeech] requestPermissions threw (non-fatal):', e);
    }

    // If both check/request failed or returned non-granted,
    // still return true to let start() try — permission may already be granted
    // at OS level even if the plugin can't confirm it
    console.log('[useSpeech] Permission status unclear, proceeding optimistically');
    return true;
  } catch (e) {
    console.error('[useSpeech] Permission request fatal error:', e);
    return true; // Still try — worst case start() will fail with a clear error
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpeechProviderType = 'native' | 'web' | 'none';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export interface UseSpeechReturn {
  start: (lang?: string) => Promise<boolean>;
  stop: () => Promise<void>;
  transcript: string;
  transcriptRef: React.RefObject<string>;
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

  const [transcript, _setTranscript] = useState('');
  const transcriptRef = useRef('');
  const setTranscript = useCallback((val: string) => {
    transcriptRef.current = val;
    _setTranscript(val);
  }, []);
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [error, setError] = useState<string | null>(null);

  const webRecRef = useRef<WebSpeechInstance | null>(null);
  const nativeListenerRef = useRef<any>(null);
  const nativeEndListenerRef = useRef<any>(null);
  const autoRestartRef = useRef(false);
  const nativeLangRef = useRef('ar-SA');
  // Accumulate transcript across native auto-restarts
  // Native engine resets on restart, so we save previous sessions' text
  const nativeAccumulatedRef = useRef('');

  // ── Check permission on mount ──
  // Note: nativePermissions.ts already requests permission on app startup,
  // so by this point permission is likely already granted at OS level.
  // We set 'granted' optimistically if the plugin check fails.
  useEffect(() => {
    if (providerType === 'native') {
      (async () => {
        try {
          const plugin = await getNativeSpeechPlugin();
          if (!plugin) {
            console.error('[useSpeech] Plugin not loaded on mount');
            setPermissionState('prompt'); // Don't block — start() will retry
            return;
          }
          const result = await plugin.checkPermissions();
          console.log('[useSpeech] Mount checkPermissions:', JSON.stringify(result));
          const state = result?.speechRecognition || 'granted'; // Default to granted
          setPermissionState(state as PermissionState);
        } catch (e) {
          console.log('[useSpeech] Mount checkPermissions failed (non-fatal):', e);
          // Permission is likely granted via nativePermissions.ts startup
          setPermissionState('granted');
        }
      })();
    } else if (providerType === 'web') {
      setPermissionState('granted');
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
    nativeAccumulatedRef.current = '';

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

        // ── Step 1: Request RECORD_AUDIO permission explicitly ──
        // Android requires a native in-app permission request, not just browser-level
        console.log('[useSpeech] Requesting native microphone permission (RECORD_AUDIO)...');
        const hasPermission = await requestNativeMicPermission();
        console.log('[useSpeech] Native mic permission granted:', hasPermission);
        
        if (!hasPermission) {
          console.error('[useSpeech] Microphone permission DENIED');
          setPermissionState('denied');
          setError('صلاحية الميكروفون مرفوضة. افتح إعدادات التطبيق ← الأذونات ← الميكروفون ← سماح');
          return false;
        }
        setPermissionState('granted');

        // Remove old listeners
        if (nativeListenerRef.current) {
          await nativeListenerRef.current.remove();
        }
        if (nativeEndListenerRef.current) {
          await nativeEndListenerRef.current.remove();
        }

        nativeLangRef.current = lang;
        autoRestartRef.current = true;

        // Listen for partial results — accumulate across auto-restarts
        nativeListenerRef.current = await plugin.addListener('partialResults', (data: any) => {
          const matches = data?.matches || data?.value;
          let sessionText = '';
          if (Array.isArray(matches) && matches.length > 0) {
            sessionText = matches[0];
          } else if (typeof matches === 'string') {
            sessionText = matches;
          }
          if (sessionText) {
            // Combine accumulated text from previous sessions + current session
            const accumulated = nativeAccumulatedRef.current;
            const fullTranscript = accumulated ? (accumulated + ' ' + sessionText).trim() : sessionText;
            console.log('[useSpeech] Native transcript:', sessionText.substring(0, 40), '| full:', fullTranscript.substring(Math.max(0, fullTranscript.length - 60)));
            setTranscript(fullTranscript);
          }
        });

        // Auto-restart when native recognition ends (silence timeout)
        // Save current session text before restart so we can accumulate
        nativeEndListenerRef.current = await plugin.addListener('listeningState', (data: any) => {
          const status = data?.status;
          console.log('[useSpeech] Native listeningState:', status);
          if (status === 'stopped' && autoRestartRef.current) {
            // Save current full transcript as accumulated base for next session
            nativeAccumulatedRef.current = transcriptRef.current || '';
            console.log('[useSpeech] Native ended, saving accumulated:', nativeAccumulatedRef.current.substring(Math.max(0, nativeAccumulatedRef.current.length - 60)));
            setTimeout(async () => {
              if (!autoRestartRef.current) return;
              try {
                await plugin.start({
                  language: nativeLangRef.current,
                  maxResults: 5,
                  partialResults: true,
                  popup: false,
                });
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
          popup: false,
        };
        console.log('[useSpeech] Native start options:', JSON.stringify(startOpts));
        
        // popup:false is more reliable on Android (popup:true gives intermittent error 0)
        // Results come via partialResults listener
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
        // Only take the latest final result + current interim
        // to avoid accumulating duplicate text
        let finalText = '';
        let interimText = '';
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += t;
          } else {
            interimText += t;
          }
        }
        const combined = (finalText + interimText).trim();
        setTranscript(combined);
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
    transcriptRef,
    isListening,
    isSupported: providerType !== 'none',
    permissionState,
    error,
    providerType,
  };
}
