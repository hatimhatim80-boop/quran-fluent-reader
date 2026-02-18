import { useEffect, useState } from 'react';
import { hardRefreshClean } from '@/utils/hardRefreshClean';
import { RefreshCw, X } from 'lucide-react';

/**
 * يظهر شريطًا في أعلى الصفحة عند اكتشاف Service Worker جديد
 * أو عند وجود ?_nocache في الرابط (بعد التنظيف).
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    // إذا جاء المستخدم بعد إعادة تحميل النظيفة — لا نعرض البانر
    const url = new URL(window.location.href);
    if (url.searchParams.has('_nocache')) {
      // نظّف الـ URL فقط
      url.searchParams.delete('_nocache');
      window.history.replaceState({}, '', url.toString());
      return;
    }

    // انتظر رسالة من Service Worker
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShow(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // تحقق إذا كان هناك waiting SW فعلاً
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) setShow(true);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  if (!show) return null;

  const handleRefresh = async () => {
    setCleaning(true);
    await hardRefreshClean();
  };

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-2 px-4 py-2.5
                 bg-primary text-primary-foreground text-sm font-arabic shadow-lg"
    >
      <span>🆕 يوجد تحديث جديد للتطبيق</span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={cleaning}
          className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30
                     px-3 py-1 rounded-full text-xs transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
          {cleaning ? 'جارٍ التحديث...' : 'تحديث الآن'}
        </button>
        <button onClick={() => setShow(false)} className="opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
