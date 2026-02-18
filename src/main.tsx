import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ✅ تسجيل Service Worker فقط في PROD (لا في localhost/DEV)
// يمنع تراكم نسخ قديمة أثناء التطوير على اللابتوب
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // VitePWA يُسجّل الـ SW تلقائيًا عند autoUpdate — لا حاجة لكود إضافي هنا
  // لكن نُضيف listener لإعادة التحميل التلقائي عند وجود تحديث جديد
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
