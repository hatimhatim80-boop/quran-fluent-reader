import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, LogOut } from 'lucide-react';
import { SessionManager } from '@/components/SessionManager';
import { useState } from 'react';
import { GhareebEntryDialog, useGhareebEntry } from '@/components/GhareebEntryDialog';
import { isNativeApp } from '@/services/otaUpdateService';

export default function Home() {
  const { showDialog, triggerEntry, closeDialog } = useGhareebEntry();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-lg w-full space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-arabic text-foreground">حفظ وفهم القرآن</h1>
          <p className="text-sm font-arabic text-muted-foreground">اختر البوابة التي تريد الدخول إليها</p>
        </div>

        {/* Portal cards */}
        <div className="grid gap-4">
          {/* Ghareeb Portal */}
          <button
            onClick={triggerEntry}
            className="page-frame p-6 flex items-center gap-4 hover:border-primary/50 hover:shadow-lg transition-all group w-full text-right"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-arabic text-foreground">بوابة الغريب</h2>
              <p className="text-xs font-arabic text-muted-foreground leading-relaxed">
                عرض المصحف مع تظليل الكلمات الغريبة ومعانيها
              </p>
            </div>
          </button>

          {/* Tahfeez Portal */}
          <Link
            to="/tahfeez"
            className="page-frame p-6 flex items-center gap-4 hover:border-primary/50 hover:shadow-lg transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-arabic text-foreground">بوابة التحفيظ</h2>
              <p className="text-xs font-arabic text-muted-foreground leading-relaxed">
                اختبارات الإخفاء الزمني لتقوية الحفظ
              </p>
            </div>
          </Link>
        </div>

        {/* Sessions section */}
        <SessionManager />

        {/* Exit button */}
        <button
          onClick={() => {
            if (isNativeApp() && (window as any).Capacitor?.Plugins?.App) {
              (window as any).Capacitor.Plugins.App.exitApp();
            } else {
              window.close();
            }
          }}
          className="w-full page-frame p-3 flex items-center justify-center gap-2 hover:border-destructive/50 hover:bg-destructive/5 transition-all text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-arabic">الخروج من التطبيق</span>
        </button>
      </div>

      {/* Ghareeb entry dialog */}
      <GhareebEntryDialog open={showDialog} onClose={closeDialog} />
    </div>
  );
}
