/**
 * Update Service — checks a remote manifest, downloads new TEXT data, stores in IndexedDB.
 * هذا الملف مخصص لتحديث البيانات (JSON/نص)، وليس لتحديث واجهة التطبيق (ZIP).
 */
import { getMeta, setMeta, storeData } from "./offlineDatabase";

export interface ManifestFile {
  key: string;
  url: string;
  sha256?: string;
}

export interface UpdateManifest {
  version: number;
  updatedAt: string;
  files: ManifestFile[];
}

export interface UpdateProgress {
  phase: "checking" | "downloading" | "done" | "error" | "up-to-date";
  current: number;
  total: number;
  message: string;
}

// ✅ manifest البيانات
const DEFAULT_MANIFEST_URL = "/updates/manifest.json";

// Cache-bust helper
function withCacheBust(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("t", String(Date.now()));
    return u.toString();
  } catch {
    // fallback if URL is relative weird
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  }
}

async function fetchJsonNoStore(url: string): Promise<Response> {
  // "no-store" أقوى من "no-cache"
  return fetch(withCacheBust(url), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
}

async function fetchTextNoStore(url: string): Promise<Response> {
  return fetch(withCacheBust(url), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
}

/**
 * Get the currently stored manifest version (0 = never updated).
 */
export async function getLocalVersion(): Promise<number> {
  const v = await getMeta("manifestVersion");
  return typeof v === "number" ? v : 0;
}

export async function getLastUpdated(): Promise<string | null> {
  const v = await getMeta("lastUpdated");
  return typeof v === "string" ? v : null;
}

export async function getLastChecked(): Promise<string | null> {
  const v = await getMeta("lastChecked");
  return typeof v === "string" ? v : null;
}

/**
 * Check for DATA updates and download new TEXT files.
 * @param manifestUrl Override the default manifest URL
 * @param onProgress Callback for progress updates
 * @returns true if updated, false if already up-to-date
 */
export async function checkAndUpdate(
  manifestUrl: string = DEFAULT_MANIFEST_URL,
  onProgress?: (p: UpdateProgress) => void,
): Promise<boolean> {
  const report = (p: UpdateProgress) => onProgress?.(p);

  try {
    report({ phase: "checking", current: 0, total: 0, message: "جاري التحقق من تحديث البيانات..." });

    const res = await fetchJsonNoStore(manifestUrl);
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);

    const manifest: UpdateManifest = await res.json();
    await setMeta("lastChecked", new Date().toISOString());

    // Validate minimal shape (أخطاء manifest تسبب مشاكل غامضة)
    if (!manifest || typeof manifest.version !== "number" || !Array.isArray(manifest.files)) {
      throw new Error("Manifest format invalid (expected: {version:number, files:[]})");
    }

    const localVersion = await getLocalVersion();
    if (manifest.version <= localVersion) {
      report({ phase: "up-to-date", current: 0, total: 0, message: "البيانات محدّثة بالفعل" });
      return false;
    }

    const total = manifest.files.length;
    if (total === 0) {
      // لا ملفات للتحديث، لكن نخزن رقم النسخة
      await setMeta("manifestVersion", manifest.version);
      await setMeta("lastUpdated", new Date().toISOString());
      report({ phase: "done", current: 0, total: 0, message: "لا توجد ملفات جديدة — تم اعتماد النسخة." });
      return true;
    }

    for (let i = 0; i < total; i++) {
      const file = manifest.files[i];
      report({
        phase: "downloading",
        current: i + 1,
        total,
        message: `تحميل بيانات: ${file.key} (${i + 1}/${total})...`,
      });

      if (!file?.key || !file?.url) {
        throw new Error(`Manifest file entry invalid at index ${i}`);
      }

      const fileRes = await fetchTextNoStore(file.url);
      if (!fileRes.ok) throw new Error(`Failed to download ${file.key}: ${fileRes.status}`);

      const data = await fileRes.text();

      if (file.sha256) {
        const hash = await computeSHA256(data);
        if (hash !== file.sha256) throw new Error(`SHA-256 mismatch for ${file.key}`);
      }

      await storeData(file.key, data, manifest.version);
    }

    await setMeta("manifestVersion", manifest.version);
    await setMeta("lastUpdated", new Date().toISOString());

    report({ phase: "done", current: total, total, message: "تم تحديث البيانات بنجاح!" });
    return true;
  } catch (error: any) {
    report({
      phase: "error",
      current: 0,
      total: 0,
      message: `فشل تحديث البيانات: ${error?.message || "خطأ غير معروف"}`,
    });
    throw error;
  }
}

async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
