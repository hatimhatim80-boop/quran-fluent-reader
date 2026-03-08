/**
 * Unified Speech Recognition Hook — Web Speech API only
 * 
 * Works in Chrome, Edge, and most modern Android WebViews.
 * Falls back gracefully (isSupported=false) on unsupported browsers.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

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

export async function openNativeAppSettings(): Promise<void> {
  // No-op for web-only mode
}

export function useSpeech(): UseSpeechReturn {
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const recognitionRef = useRef<any>(null);
  const autoRestartRef = useRef(false);

  const isSupported = !!getWebSpeechCtor();

  // Check permission state on mount
  useEffect(() => {
    if (!isSupported) {
      setPermissionState('denied');
      return;
    }
    // Try to query microphone permission
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
    if (!Ctor) {
      setError('Web Speech API غير متاح');
      return false;
    }

    // Stop existing
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

    rec.onstart = () => {
      setIsListening(true);
      setPermissionState('granted');
    };

    rec.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
      transcriptRef.current = fullTranscript;
    };

    rec.onerror = (event: any) => {
      console.log('[useSpeech] Error:', event.error);
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
      // 'no-speech' and 'aborted' are normal — let onend handle restart
    };

    rec.onend = () => {
      if (autoRestartRef.current) {
        // Auto-restart to keep listening
        try {
          const newRec = new Ctor();
          newRec.lang = rec.lang;
          newRec.continuous = true;
          newRec.interimResults = true;
          newRec.maxAlternatives = 3;
          newRec.onstart = rec.onstart;
          newRec.onresult = rec.onresult;
          newRec.onerror = rec.onerror;
          newRec.onend = rec.onend;
          recognitionRef.current = newRec;
          newRec.start();
        } catch {
          setIsListening(false);
          autoRestartRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      return true;
    } catch (err: any) {
      console.error('[useSpeech] Failed to start:', err);
      setError(err?.message || 'فشل بدء التعرف الصوتي');
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoRestartRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  return {
    start,
    stop,
    transcript,
    transcriptRef,
    isListening,
    isSupported,
    permissionState,
    error,
    providerType: isSupported ? 'web' : 'none',
  };
}
