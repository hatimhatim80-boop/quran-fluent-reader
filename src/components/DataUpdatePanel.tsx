import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useSettingsStore } from '@/stores/settingsStore';
import { checkAndUpdate, getLastUpdated, getLastChecked, getLocalVersion, UpdateProgress } from '@/services/updateService';
import { toast } from 'sonner';

export function DataUpdatePanel() {
  const { settings, setUpdate } = useSettingsStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState<number>(0);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Online/offline listener
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load meta on mount
  useEffect(() => {
    (async () => {
      setLastUpdated(await getLastUpdated());
      setLocalVersion(await getLocalVersion());
    })();
  }, []);

  const handleUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setProgress(null);

    try {
      const updated = await checkAndUpdate(
        settings.update?.manifestUrl || '/updates/manifest.json',
        (p) => setProgress(p),
      );

      if (updated) {
        toast.success('تم تحديث البيانات بنجاح! أعد تحميل الصفحة لتطبيق التغييرات.');
        setLastUpdated(new Date().toISOString());
        setLocalVersion(await getLocalVersion());
      } else {
        toast.info('البيانات محدّثة بالفعل');
      }
    } catch {
      toast.error('فشل التحديث. تحقق من اتصال الإنترنت.');
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating, settings.update?.manifestUrl]);

  // Auto-update on mount if enabled and online
  useEffect(() => {
    if (settings.update?.autoUpdate && isOnline && !isUpdating) {
      handleUpdate();
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const formatDate = (iso: string | null) => {
    if (!iso) return 'لم يتم التحديث بعد';
    try {
      return new Intl.DateTimeFormat('ar', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Online/Offline Status */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${
        isOnline
          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
      }`}>
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        )}
        <span className="font-arabic text-sm font-bold">
          {isOnline ? 'متصل بالإنترنت' : 'غير متصل (وضع أوفلاين)'}
        </span>
      </div>

      {/* Last update info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-arabic">
        <Clock className="w-3.5 h-3.5" />
        <span>آخر تحديث: {formatDate(lastUpdated)}</span>
        {localVersion > 0 && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">v{localVersion}</span>
        )}
      </div>

      {/* Update button */}
      <Button
        onClick={handleUpdate}
        disabled={isUpdating || !isOnline}
        className="w-full gap-2 font-arabic"
        variant={isUpdating ? 'secondary' : 'default'}
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {isUpdating ? 'جاري التحديث...' : 'تحديث البيانات'}
      </Button>

      {/* Progress bar */}
      {progress && progress.phase === 'downloading' && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground font-arabic text-center">
            {progress.message}
          </p>
        </div>
      )}

      {/* Status message */}
      {progress && progress.phase === 'done' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-sm font-arabic">
          <CheckCircle2 className="w-4 h-4" />
          {progress.message}
        </div>
      )}

      {progress && progress.phase === 'up-to-date' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-muted-foreground text-sm font-arabic">
          <CheckCircle2 className="w-4 h-4" />
          {progress.message}
        </div>
      )}

      {progress && progress.phase === 'error' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm font-arabic">
          <AlertCircle className="w-4 h-4" />
          {progress.message}
        </div>
      )}

      {/* Auto-update toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div>
          <Label className="font-arabic">التحديث تلقائيًا</Label>
          <p className="text-xs text-muted-foreground font-arabic mt-1">
            تحديث البيانات عند توفر الإنترنت
          </p>
        </div>
        <Switch
          checked={settings.update?.autoUpdate ?? false}
          onCheckedChange={(v) => setUpdate({ autoUpdate: v })}
        />
      </div>
    </div>
  );
}
