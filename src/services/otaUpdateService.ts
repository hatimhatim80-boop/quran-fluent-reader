/**
 * OTA Update Service — تحديث كود التطبيق داخل APK بدون إعادة بناء.
 * يستخدم @capgo/capacitor-updater لتحميل وتطبيق حزم الويب الجديدة.
 * يدعم rollback تلقائي إذا فشل الإقلاع.
 *
 * إصلاحات مهمة:
 * - كسر كاش manifest وملف zip لتفادي قراءة نسخة قديمة
 * - دعم مسار صحيح في Lovable (public/updates/ota-manifest.json)
 * - رسائل أخطاء أوضح (404/SSL/redirect/CORS)
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

// ✅ هذا صحيح طالما الملف موجود في: public/updates/ota-manifest.json
const OTA_MANIFEST_URL = "https://quran-fluent-reader.lovable.app/updates/ota-manifest.json";

const OTA_VERSION_KEY = "ota_current_version";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getCurrentOTAVersion(): string {
  return localStorage.getItem(OTA_VERSION_KEY) || "0";
}

/** Cache-bust helper */
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

/** Better error formatting */
function explainFetchFailure(status: number, url: string): string {
  if (status === 404) return `الملف غير موجود (404): ${url}`;
  if (status === 403) return `ممنوع الوصول (403): ${url}`;
  if (status >= 500) return `خطأ من السيرفر (${status}): ${url}`;
  return `فشل التحميل (${status}): ${url}`;
}

/**
 * Initialize OTA: notify the plugin that the app booted successfully.
 * This prevents automatic rollback after a successful update.
 * Call this once at app startup (مثلاً في App.tsx useEffect).
 */
export async function initOTA(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    // بعض النسخ لا تحب الاستدعاء قبل جاهزية الويب-فيو
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // تجاهل
  }
}

/**
 * Check for OTA updates, download, apply, and reload.
 */
export async function checkOTAUpdate(onProgress?: (p: OTAProgress) => void): Promise<boolean> {
  const report = (p: OTAProgress) => onProgress?.(p);

  if (!isNativeApp()) {
    report({ phase: "error", message: "OTA متاح فقط داخل تطبيق APK (Android/iOS)" });
    return false;
  }

  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // 1) Fetch manifest (no-store + cache bust)
    report({ phase: "checking", message: "التحقق من تحديث الواجهة..." });

    const manifestUrl = withCacheBust(OTA_MANIFEST_URL);

    let res: Response;
    try {
      res = await fetch(manifestUrl, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
    } catch (e: any) {
      // هذا هو "Failed to fetch" الحقيقي (شبكة/SSL/redirect/cors)
      throw new Error(`فشل جلب ملف التحديث (Network/SSL/CORS): ${e?.message || "Failed to fetch"}`);
    }

    if (!res.ok) {
      throw new Error(explainFetchFailure(res.status, OTA_MANIFEST_URL));
    }

    const manifest: OTAManifest = await res.json();

    if (!manifest?.version || !manifest?.url) {
      throw new Error("صيغة ota-manifest.json غير صحيحة: يجب أن تحتوي version و url");
    }

    const currentVersion = getCurrentOTAVersion();
    if (manifest.version === currentVersion) {
      report({ phase: "up-to-date", message: "لا يوجد تحديث جديد ✓" });
      return false;
    }

    // 2) Download bundle via Capgo plugin
    report({ phase: "downloading", message: `تنزيل تحديث الواجهة (${manifest.version})...` });

    // ✅ مهم جدًا: كسر كاش zip أيضًا
    const bundleUrl = withCacheBust(manifest.url);

    const bundle = await CapacitorUpdater.download({
      url: bundleUrl,
      version: manifest.version,
    });

    // 3) Apply and reload
    report({ phase: "installing", message: "تطبيق التحديث..." });
    await CapacitorUpdater.set(bundle);

    // Save version before reload
    localStorage.setItem(OTA_VERSION_KEY, manifest.version);

    report({ phase: "done", message: `تم التحديث إلى ${manifest.version}!` });

    // Reload to apply
    setTimeout(() => window.location.reload(), 1200);
    return true;
  } catch (error: any) {
    report({
      phase: "error",
      message: `فشل تحديث الواجهة: ${error?.message || "خطأ غير معروف"}`,
    });
    return false;
  }
}
