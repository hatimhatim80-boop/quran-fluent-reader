/**
 * تنظيف شامل للكاش وبيانات المتصفح ثم إعادة التحميل.
 * يُستخدم عند الحاجة للتخلص من النسخ القديمة تمامًا.
 */
export async function hardRefreshClean(): Promise<void> {
  try {
    // 1. localStorage & sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // 2. إلغاء تسجيل Service Workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // 3. حذف Cache Storage
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // 4. حذف قواعد IndexedDB (best-effort — غير مدعومة في كل المتصفحات)
    if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
      try {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs.map((db) =>
            db?.name
              ? new Promise<void>((res) => {
                  const req = indexedDB.deleteDatabase(db.name!);
                  req.onsuccess = () => res();
                  req.onerror = () => res();
                  req.onblocked = () => res();
                })
              : Promise.resolve(),
          ),
        );
      } catch {
        // Firefox لا يدعم indexedDB.databases() — نتجاهل الخطأ
      }
    }
  } finally {
    // إعادة التحميل بدون cache (force-reload)
    window.location.href = window.location.href;
    location.reload();
  }
}
