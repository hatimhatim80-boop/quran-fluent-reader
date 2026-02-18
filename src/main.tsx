import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ✅ تسجيل Service Worker فقط في PROD (لا في localhost/DEV)
// يمنع تراكم نسخ قديمة أثناء التطوير على اللابتوب
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  // أبلغ التطبيق عند وجود SW جديد في حالة الانتظار
  navigator.serviceWorker.ready.then((reg) => {
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // يوجد SW جديد في الانتظار — أبلغ التطبيق
          navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  });
}
