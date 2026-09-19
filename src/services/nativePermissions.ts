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

  // ── 2. Microphone — required by the single recitation engine (NoorSpeech) ──
  try {
    const provider = await getSpeechProvider();
    const current = await provider.checkPermission();
    console.log('[nativePermissions] Microphone permission check:', current);
    if (current !== 'granted') {
      console.log('[nativePermissions] Microphone permission request result:', await provider.requestPermission());
    }
  } catch (e) {
    console.error('[nativePermissions] Microphone permission error:', e);
  }

  console.log('[nativePermissions] All permission requests completed');
}
