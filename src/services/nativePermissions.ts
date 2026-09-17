/**
 * Native Permission Requests on App Startup
 * 
 * Requests notification permissions immediately when the app launches.
 * Also creates a default notification channel so Android enables the notification toggle.
 * 
 * Also requests microphone/speech permission so the recitation session never stalls.
 */

import { Capacitor } from '@capacitor/core';

export async function requestAllNativePermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  console.log('[nativePermissions] Requesting native permissions on startup...');

  // ── 1. Notifications — create channel + request permission ──
  try {
    const notifMod = await import('@capacitor/local-notifications');
    const LocalNotifications = notifMod.LocalNotifications;

    // Create a default notification channel (required for Android 8+)
    try {
      await LocalNotifications.createChannel({
        id: 'general',
        name: 'عام',
        description: 'إشعارات التطبيق العامة',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'default',
      });
      console.log('[nativePermissions] Notification channel "general" created');
    } catch (chErr) {
      console.log('[nativePermissions] Channel creation error (may already exist):', chErr);
    }

    const checkNotif = await LocalNotifications.checkPermissions();
    console.log('[nativePermissions] Notification permission check:', JSON.stringify(checkNotif));

    if (checkNotif?.display !== 'granted') {
      const result = await LocalNotifications.requestPermissions();
      console.log('[nativePermissions] Notification permission request result:', JSON.stringify(result));
    } else {
      console.log('[nativePermissions] Notification permission already granted');
    }
  } catch (e) {
    console.error('[nativePermissions] Notification permission error:', e);
  }

  // ── 2. Microphone / speech recognition — required by the recitation session ──
  try {
    const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition');
    const current = await SpeechRecognition.checkPermissions() as Record<string, unknown>;
    console.log('[nativePermissions] Speech permission check:', JSON.stringify(current));
    if (Object.values(current || {}).some(value => String(value) !== 'granted')) {
      const result = await SpeechRecognition.requestPermissions() as Record<string, unknown>;
      console.log('[nativePermissions] Speech permission request result:', JSON.stringify(result));
    }
  } catch (e) {
    console.error('[nativePermissions] Speech permission error:', e);
  }

  console.log('[nativePermissions] All permission requests completed');
}
