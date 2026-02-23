import { useRef, useCallback, useState } from 'react';
import { normalizeArabic } from '@/utils/quranParser';

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/**
 * Normalize text from speech recognition for comparison with Quranic text.
 * Speech API returns simplified Arabic without diacritics, so we normalize both sides.
 */
function normalizeForMatch(text: string): string {
  // Use aggressive normalization to maximize matching
  let n = normalizeArabic(text, 'aggressive');
  // Remove all whitespace and punctuation
  n = n.replace(/[\s\u200B-\u200F\u202A-\u202E\uFEFF.,،؟!:;'\"()\[\]{}<>]/g, '');
  return n;
}

/**
 * Check if the spoken text matches the expected word.
 * Uses fuzzy matching: if the spoken text contains the expected word or vice versa.
 */
function doesMatch(spoken: string, expected: string): boolean {
  const s = normalizeForMatch(spoken);
  const e = normalizeForMatch(expected);
  if (!s || !e) return false;
  // Exact match
  if (s === e) return true;
  // Spoken contains expected or expected contains spoken (for short words)
  if (s.includes(e) || e.includes(s)) return true;
  // Check if any word in the spoken text matches
  const spokenWords = spoken.split(/\s+/);
  for (const w of spokenWords) {
    const nw = normalizeForMatch(w);
    if (nw === e || nw.includes(e) || e.includes(nw)) return true;
  }
  return false;
}

interface UseSpeechRecognitionOptions {
  onMatch: () => void;
  onNoMatch?: (spokenText: string) => void;
  lang?: string;
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastSpoken, setLastSpoken] = useState<string>('');
  const expectedWordRef = useRef<string>('');
  const callbacksRef = useRef<UseSpeechRecognitionOptions | null>(null);
  const autoRestartRef = useRef(false);

  const stopListening = useCallback(() => {
    autoRestartRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((expectedWord: string, callbacks: UseSpeechRecognitionOptions) => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      console.warn('[speech] Web Speech API not supported');
      return false;
    }

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    expectedWordRef.current = expectedWord;
    callbacksRef.current = callbacks;
    autoRestartRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.lang = callbacks.lang || 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      setIsListening(true);
      console.log('[speech] Listening for:', expectedWord);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Check all results from the latest
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript.trim();
          if (!transcript) continue;
          
          setLastSpoken(transcript);
          console.log('[speech] Heard:', transcript, '| Expected:', expectedWordRef.current);
          
          if (doesMatch(transcript, expectedWordRef.current)) {
            console.log('[speech] ✓ MATCH!');
            autoRestartRef.current = false;
            try { recognition.abort(); } catch {}
            recognitionRef.current = null;
            setIsListening(false);
            callbacksRef.current?.onMatch();
            return;
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('[speech] Error:', event.error);
      // Don't stop on 'no-speech' or 'aborted' — keep listening
      if (event.error === 'not-allowed' || event.error === 'service-not-available') {
        autoRestartRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // Auto-restart if we haven't matched yet and weren't explicitly stopped
      if (autoRestartRef.current && expectedWordRef.current) {
        try {
          const newRecognition = new SpeechRecognition();
          newRecognition.lang = recognition.lang;
          newRecognition.continuous = true;
          newRecognition.interimResults = true;
          newRecognition.maxAlternatives = 5;
          newRecognition.onstart = recognition.onstart;
          newRecognition.onresult = recognition.onresult;
          newRecognition.onerror = recognition.onerror;
          newRecognition.onend = recognition.onend;
          recognitionRef.current = newRecognition;
          newRecognition.start();
        } catch {
          setIsListening(false);
          autoRestartRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch (err) {
      console.error('[speech] Failed to start:', err);
      return false;
    }
  }, []);

  /**
   * Update the expected word without restarting recognition.
   * Useful when advancing to the next blank while keeping mic open.
   */
  const updateExpectedWord = useCallback((word: string, callbacks: UseSpeechRecognitionOptions) => {
    expectedWordRef.current = word;
    callbacksRef.current = callbacks;
    console.log('[speech] Updated expected word to:', word);
  }, []);

  return {
    isListening,
    lastSpoken,
    startListening,
    stopListening,
    updateExpectedWord,
    isSupported: isSpeechRecognitionSupported(),
  };
}
