/**
 * Unified Speech Recognition Hook — Hybrid: Native (Capacitor) + Web Speech API
 * 
 * On native Android/iOS (APK): uses @capacitor-community/speech-recognition
 * On browsers (PWA/Safari/Chrome): uses Web Speech API
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

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

function getWebSpeechCtor(): (new () => any) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const isNative = Capacitor.isNativePlatform();

export async function openNativeAppSettings(): Promise<void> {
  if (!isNative) return;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings');
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  } catch {
    // silently fail
  }
}

// ─── Native provider (Capacitor plugin) ───
function useNativeSpeech(): UseSpeechReturn {
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const pluginRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);

  // Load plugin lazily
  const getPlugin = useCallback(async () => {
    if (pluginRef.current) return pluginRef.current;
    try {
      const mod = await import('@capacitor-community/speech-recognition');
      pluginRef.current = mod.SpeechRecognition;
      return pluginRef.current;
    } catch {
      return null;
    }
  }, []);

  // Check permissions on mount
  useEffect(() => {
    (async () => {
      const plugin = await getPlugin();
      if (!plugin) { setPermissionState('denied'); return; }
      try {
        const { speechRecognition } = await plugin.checkPermissions();
        setPermissionState(speechRecognition as PermissionState);
      } catch {
        setPermissionState('unknown');
      }
    })();
  }, [getPlugin]);

  const stop = useCallback(async () => {
    const plugin = await getPlugin();
    if (!plugin) return;
    try {
      await plugin.stop();
    } catch {}
    if (listenerRef.current) {
      try { await listenerRef.current.remove(); } catch {}
      listenerRef.current = null;
    }
    setIsListening(false);
  }, [getPlugin]);

  const start = useCallback(async (lang?: string): Promise<boolean> => {
    const plugin = await getPlugin();
    if (!plugin) {
      setError('إضافة التعرف الصوتي غير متاحة');
      return false;
    }

    // Request permission if needed
    const { speechRecognition: perm } = await plugin.checkPermissions();
    if (perm !== 'granted') {
      const { speechRecognition: newPerm } = await plugin.requestPermissions();
      setPermissionState(newPerm as PermissionState);
      if (newPerm !== 'granted') {
        setError('إذن الميكروفون مرفوض');
        setPermissionState('denied');
        return false;
      }
    }
    setPermissionState('granted');

    // Clean previous listener
    if (listenerRef.current) {
      try { await listenerRef.current.remove(); } catch {}
    }

    setError(null);
    setTranscript('');
    transcriptRef.current = '';

    // Listen for partial results
    listenerRef.current = await plugin.addListener('partialResults', (data: any) => {
      const text = (data.matches || data.value || []).join(' ');
      if (text) {
        setTranscript(text);
        transcriptRef.current = text;
      }
    });

    try {
      await plugin.start({
        language: lang || 'ar-SA',
        partialResults: true,
        popup: false,
      });
      setIsListening(true);
      return true;
    } catch (err: any) {
      console.error('[useSpeech native] start error:', err);
      setError(err?.message || 'فشل بدء التعرف الصوتي');
      return false;
    }
  }, [getPlugin]);

  // Cleanup
  useEffect(() => {
    return () => {
      (async () => {
        const plugin = await getPlugin();
        if (plugin) try { await plugin.stop(); } catch {}
        if (listenerRef.current) try { await listenerRef.current.remove(); } catch {}
      })();
    };
  }, [getPlugin]);

  return {
    start, stop, transcript, transcriptRef,
    isListening, isSupported: true, permissionState, error,
    providerType: 'native',
  };
}

// ─── Web provider (Web Speech API) ───
function useWebSpeech(): UseSpeechReturn {
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const recognitionRef = useRef<any>(null);
  const autoRestartRef = useRef(false);

  const isSupported = !!getWebSpeechCtor();

  useEffect(() => {
    if (!isSupported) { setPermissionState('denied'); return; }
    navigator.permissions?.query({ name: 'microphone' as any })
      .then(result => {
        setPermissionState(result.state as PermissionState);
        result.onchange = () => setPermissionState(result.state as PermissionState);
      })
      .catch(() => setPermissionState('unknown'));
  }, [isSupported]);

  const stop = useCallback(async () => {
    autoRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(async (lang?: string): Promise<boolean> => {
    const Ctor = getWebSpeechCtor();
    if (!Ctor) { setError('Web Speech API غير متاح'); return false; }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    setError(null);
    setTranscript('');
    transcriptRef.current = '';
    autoRestartRef.current = true;

    const rec = new Ctor();
    rec.lang = lang || 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => { setIsListening(true); setPermissionState('granted'); };

    rec.onresult = (event: any) => {
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      setTranscript(full);
      transcriptRef.current = full;
    };

    rec.onerror = (event: any) => {
      console.log('[useSpeech web] Error:', event.error);
      if (event.error === 'not-allowed') {
        setPermissionState('denied');
        setError('إذن الميكروفون مرفوض');
        autoRestartRef.current = false;
        setIsListening(false);
      } else if (event.error === 'service-not-available') {
        setError('خدمة التعرف الصوتي غير متاحة');
        autoRestartRef.current = false;
        setIsListening(false);
      }
    };

    rec.onend = () => {
      if (autoRestartRef.current) {
        try {
          const nr = new Ctor();
          nr.lang = rec.lang; nr.continuous = true; nr.interimResults = true; nr.maxAlternatives = 3;
          nr.onstart = rec.onstart; nr.onresult = rec.onresult; nr.onerror = rec.onerror; nr.onend = rec.onend;
          recognitionRef.current = nr;
          nr.start();
        } catch { setIsListening(false); autoRestartRef.current = false; }
      } else { setIsListening(false); }
    };

    recognitionRef.current = rec;
    try { rec.start(); return true; }
    catch (err: any) { setError(err?.message || 'فشل بدء التعرف الصوتي'); return false; }
  }, []);

  useEffect(() => {
    return () => {
      autoRestartRef.current = false;
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
    };
  }, []);

  return {
    start, stop, transcript, transcriptRef,
    isListening, isSupported, permissionState, error,
    providerType: isSupported ? 'web' : 'none',
  };
}

// ─── Main export: auto-selects provider ───
export function useSpeech(): UseSpeechReturn {
  // On native platforms, always use the Capacitor plugin
  if (isNative) {
    return useNativeSpeech();
  }
  // On web/PWA, use Web Speech API
  return useWebSpeech();
}
