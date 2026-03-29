import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold font-arabic text-foreground">٤٠٤</h1>
        <p className="text-lg text-muted-foreground font-arabic">الصفحة غير موجودة</p>
        <p className="text-xs text-muted-foreground/60 font-mono" dir="ltr">{location.pathname}</p>
        <a href="/" className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-arabic hover:bg-primary/90 transition-colors">
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
};

export default NotFound;
