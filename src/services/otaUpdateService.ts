/**
 * OTA Update Service — تحديث كود التطبيق داخل APK بدون إعادة بناء.
 * يستخدم @capgo/capacitor-updater لتحميل وتطبيق حزم الويب الجديدة.
 * يدعم rollback تلقائي إذا فشل الإقلاع.
 */

import { Capacitor } from '@capacitor/core';

export type OTAPhase = 'checking' | 'downloading' | 'installing' | 'done' | 'error' | 'up-to-date';

export interface OTAProgress {
  phase: OTAPhase;
  message: string;
}

interface OTAManifest {
  version: string;
  url: string;
  updatedAt: string;
  notes?: string;
}

const OTA_MANIFEST_URL = 'https://quran-fluent-reader.lovable.app/updates/ota-manifest.json';
const OTA_VERSION_KEY = 'ota_current_version';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getCurrentOTAVersion(): string {
  return localStorage.getItem(OTA_VERSION_KEY) || '0';
}

/**
 * Initialize OTA: notify the plugin that the app booted successfully.
 * This prevents automatic rollback after a successful update.
 * Call this once at app startup.
 */
export async function initOTA(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Silently ignore — not critical
  }
}

/**
 * Check for OTA updates, download, apply, and reload.
 */
export async function checkOTAUpdate(
  onProgress?: (p: OTAProgress) => void,
): Promise<boolean> {
  const report = (p: OTAProgress) => onProgress?.(p);

  if (!isNativeApp()) {
    report({ phase: 'error', message: 'OTA متاح فقط في التطبيق الأصلي (APK)' });
    return false;
  }

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // 1. Check manifest
    report({ phase: 'checking', message: 'التحقق من التحديثات...' });

    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`فشل تحميل بيان التحديث: ${res.status}`);

    const manifest: OTAManifest = await res.json();
    const currentVersion = getCurrentOTAVersion();

    if (manifest.version === currentVersion) {
      report({ phase: 'up-to-date', message: 'لا يوجد تحديث جديد ✓' });
      return false;
    }

    // 2. Download bundle
    report({ phase: 'downloading', message: 'جارٍ التنزيل...' });

    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    // 3. Apply and reload
    report({ phase: 'installing', message: 'جارٍ تطبيق التحديث...' });
    await CapacitorUpdater.set(bundle);

    // Save version before reload
    localStorage.setItem(OTA_VERSION_KEY, manifest.version);

    report({ phase: 'done', message: `تم التحديث إلى ${manifest.version}!` });

    // Reload to apply
    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return true;
  } catch (error: any) {
    report({
      phase: 'error',
      message: `فشل التحديث: ${error.message || 'خطأ غير معروف'}`,
    });
    return false;
  }
}
