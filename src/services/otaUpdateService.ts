/**
 * OTA Update Service — تحديث كود التطبيق داخل APK بدون إعادة بناء.
 * يستخدم @capgo/capacitor-updater لتحميل وتطبيق حزم الويب الجديدة.
 * يدعم rollback تلقائي إذا فشل الإقلاع.
 *
 * تحسينات:
 * - cache-bust للـ manifest والـ zip
 * - fetch no-store + headers no-cache
 * - رسائل أوضح لأخطاء الشبكة/SSL/CORS
 */

import { Capacitor } from "@capacitor/core";

export type OTAPhase = "checking" | "downloading" | "installing" | "done" | "error" | "up-to-date";

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

const OTA_MANIFEST_URL = "https://quran-fluent-reader.lovable.app/updates/ota-manifest.json";
const OTA_VERSION_KEY = "ota_current_version";

function withCacheBust(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("t", String(Date.now()));
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  }
}

function explainStatus(status: number, url: string): string {
  if (status === 404) return `404 الملف غير موجود: ${url}`;
  if (status === 403) return `403 ممنوع الوصول: ${url}`;
  if (status === 401) return `401 غير مصرح: ${url}`;
  if (status >= 500) return `${status} خطأ سيرفر: ${url}`;
  return `${status} فشل تحميل: ${url}`;
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getCurrentOTAVersion(): string {
  return localStorage.getItem(OTA_VERSION_KEY) || "0";
}

/**
 * Initialize OTA: notify the plugin that the app booted successfully.
 * Call this once at app startup.
 */
export async function initOTA(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // ignore
  }
}

/**
 * Check for OTA updates, download, apply, and reload.
 */
export async function checkOTAUpdate(onProgress?: (p: OTAProgress) => void): Promise<boolean> {
  const report = (p: OTAProgress) => onProgress?.(p);

  if (!isNativeApp()) {
    report({ phase: "error", message: "OTA متاح فقط في التطبيق الأصلي (APK)" });
    return false;
  }

  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // 1) Fetch manifest (no-store + cache-bust)
    report({ phase: "checking", message: "التحقق من تحديث الواجهة..." });

    let res: Response;
    try {
      res = await fetch(withCacheBust(OTA_MANIFEST_URL), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
    } catch (e: any) {
      throw new Error(`Failed to fetch (Network/SSL/CORS): ${e?.message || "Failed to fetch"}`);
    }

    if (!res.ok) throw new Error(explainStatus(res.status, OTA_MANIFEST_URL));

    const manifest: OTAManifest = await res.json();
    if (!manifest?.version || !manifest?.url) {
      throw new Error("صيغة ota-manifest.json غير صحيحة: يجب وجود version و url");
    }

    const currentVersion = getCurrentOTAVersion();
    if (manifest.version === currentVersion) {
      report({ phase: "up-to-date", message: "لا يوجد تحديث جديد ✓" });
      return false;
    }

    // 2) Download bundle (cache-bust للـ zip أيضًا)
    report({ phase: "downloading", message: `جارٍ تنزيل التحديث (${manifest.version})...` });

    const bundle = await CapacitorUpdater.download({
      url: withCacheBust(manifest.url),
      version: manifest.version,
    });

    // 3) Apply and reload
    report({ phase: "installing", message: "جارٍ تطبيق التحديث..." });
    await CapacitorUpdater.set(bundle);

    localStorage.setItem(OTA_VERSION_KEY, manifest.version);

    report({ phase: "done", message: `تم التحديث إلى ${manifest.version}!` });

    setTimeout(() => window.location.reload(), 1200);

    return true;
  } catch (error: any) {
    report({
      phase: "error",
      message: `فشل التحديث: ${error?.message || "خطأ غير معروف"}`,
    });
    return false;
  }
}
