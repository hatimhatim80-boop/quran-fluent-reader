/**
 * Thin React binding over the single speech engine (NoorSpeech, Android native).
 * No second implementation lives here: everything is delegated to
 * `@/services/speechRecognition`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechProvider, type QuranSpeechRecognitionProvider } from '@/services/speechRecognition';

export type SpeechProviderType = 'native' | 'none';
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

export async function openNativeAppSettings(): Promise<void> {}

export function useSpeech(): UseSpeechReturn {
  const providerRef = useRef<QuranSpeechRecognitionProvider | null>(null);
  const transcriptRef = useRef('');
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [providerType, setProviderType] = useState<SpeechProviderType>('none');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const provider = await getSpeechProvider();
      if (cancelled) return;
      providerRef.current = provider;
      setProviderType(provider.id);
      setPermissionState(await provider.checkPermission());
    })();
    return () => { cancelled = true; void providerRef.current?.dispose(); };
  }, []);

  const start = useCallback(async (lang = 'ar-SA') => {
    const provider = providerRef.current || (await getSpeechProvider());
    providerRef.current = provider;
    if (provider.id === 'none') return false;

    let permission = await provider.checkPermission();
    if (permission !== 'granted') permission = await provider.requestPermission();
    setPermissionState(permission);
    if (permission !== 'granted') return false;

    setError(null);
    transcriptRef.current = '';
    setTranscript('');
    const started = await provider.startListening(lang, {
      onPartialResult: text => { transcriptRef.current = text; setTranscript(text); },
      onFinalResult: text => { transcriptRef.current = text; setTranscript(text); setIsListening(false); },
      onStateChange: state => setIsListening(state === 'listening'),
      onError: message => setError(message),
    });
    setIsListening(started);
    return started;
  }, []);

  const stop = useCallback(async () => {
    await providerRef.current?.stopListening();
    setIsListening(false);
  }, []);

  return {
    start,
    stop,
    transcript,
    transcriptRef,
    isListening,
    isSupported: providerType === 'native',
    permissionState,
    error,
    providerType,
  };
}
