/**
 * OTA Update Service — تحديث كود التطبيق داخل APK بدون إعادة بناء.
 * يستخدم @capgo/capacitor-updater لتحميل وتطبيق حزم الويب الجديدة.
 */

import { Capacitor } from '@capacitor/core';

// OTA manifest hosted remotely
export interface OTAManifest {
  version: string;
  url: string; // URL to the zip bundle
  updatedAt: string;
  notes?: string;
}

export interface OTAProgress {
  phase: 'checking' | 'downloading' | 'installing' | 'done' | 'error' | 'up-to-date';
  percent: number;
  message: string;
}

const OTA_MANIFEST_URL = 'https://quran-fluent-reader.lovable.app/updates/ota-manifest.json';
const OTA_VERSION_KEY = 'ota_current_version';

/**
 * Check if running inside a native Capacitor app.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get current installed OTA version.
 */
export function getCurrentOTAVersion(): string {
  return localStorage.getItem(OTA_VERSION_KEY) || '0';
}

/**
 * Check for OTA updates and apply if available.
 */
export async function checkOTAUpdate(
  onProgress?: (p: OTAProgress) => void,
): Promise<boolean> {
  const report = (p: OTAProgress) => onProgress?.(p);

  if (!isNativeApp()) {
    report({ phase: 'error', percent: 0, message: 'OTA متاح فقط في التطبيق الأصلي (APK)' });
    return false;
  }

  try {
    // Dynamically import to avoid errors on web
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    report({ phase: 'checking', percent: 0, message: 'جاري التحقق من التحديثات...' });

    // Fetch remote manifest
    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`فشل تحميل بيان التحديث: ${res.status}`);

    const manifest: OTAManifest = await res.json();
    const currentVersion = getCurrentOTAVersion();

    if (manifest.version === currentVersion) {
      report({ phase: 'up-to-date', percent: 100, message: 'التطبيق محدّث بالفعل' });
      return false;
    }

    // Download the new bundle
    report({ phase: 'downloading', percent: 10, message: 'جاري تحميل التحديث...' });

    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    report({ phase: 'downloading', percent: 80, message: 'تم التحميل، جاري التثبيت...' });

    // Apply the update
    report({ phase: 'installing', percent: 90, message: 'جاري تطبيق التحديث...' });
    await CapacitorUpdater.set(bundle);

    // Save version
    localStorage.setItem(OTA_VERSION_KEY, manifest.version);

    report({ phase: 'done', percent: 100, message: `تم التحديث إلى النسخة ${manifest.version}! أعد تشغيل التطبيق.` });
    return true;
  } catch (error: any) {
    report({
      phase: 'error',
      percent: 0,
      message: `فشل التحديث: ${error.message || 'خطأ غير معروف'}`,
    });
    return false;
  }
}
