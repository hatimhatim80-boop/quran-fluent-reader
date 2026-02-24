/**
 * Native Permission Requests on App Startup
 * 
 * Requests microphone + notification permissions immediately when the app launches.
 * Also creates a default notification channel so Android enables the notification toggle.
 */

import { Capacitor } from '@capacitor/core';

export async function requestAllNativePermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  console.log('[nativePermissions] Requesting native permissions on startup...');

  // ── 1. Microphone (RECORD_AUDIO) ──
  try {
    const speechMod = await import('@capacitor-community/speech-recognition');
    const plugin = speechMod.SpeechRecognition;

    const check = await plugin.checkPermissions();
    console.log('[nativePermissions] Mic permission check:', JSON.stringify(check));

    if (check?.speechRecognition !== 'granted') {
      const result = await plugin.requestPermissions();
      console.log('[nativePermissions] Mic permission request result:', JSON.stringify(result));
    } else {
      console.log('[nativePermissions] Mic permission already granted');
    }
  } catch (e) {
    console.error('[nativePermissions] Mic permission error:', e);
  }

  // ── 2. Notifications — create channel + request permission ──
  try {
    const notifMod = await import('@capacitor/local-notifications');
    const LocalNotifications = notifMod.LocalNotifications;

    // Create a default notification channel (required for Android 8+)
    // This makes the notification toggle in Android settings become active
    try {
      await LocalNotifications.createChannel({
        id: 'general',
        name: 'عام',
        description: 'إشعارات التطبيق العامة',
        importance: 5, // max importance
        visibility: 1, // public
        vibration: true,
        sound: 'default',
      });
      console.log('[nativePermissions] Notification channel "general" created');
    } catch (chErr) {
      console.log('[nativePermissions] Channel creation error (may already exist):', chErr);
    }

    // Check and request notification permission
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

  console.log('[nativePermissions] All permission requests completed');
}
