/**
 * Unified Speech Recognition Hook (DISABLED)
 * 
 * Speech recognition is currently disabled.
 * This stub returns a consistent no-op API so the rest of the app compiles without errors.
 * To re-enable, restore the original implementation from version control.
 */

import { useRef } from 'react';

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

export async function openNativeAppSettings(): Promise<void> {
  // No-op — speech disabled
}

export function useSpeech(): UseSpeechReturn {
  const transcriptRef = useRef('');

  return {
    start: async () => false,
    stop: async () => {},
    transcript: '',
    transcriptRef,
    isListening: false,
    isSupported: false,
    permissionState: 'denied',
    error: null,
    providerType: 'none',
  };
}
