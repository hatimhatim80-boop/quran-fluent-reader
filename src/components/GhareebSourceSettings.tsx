import React from 'react';
import { BookMarked } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GhareebSharedMeaningMode, GhareebSourceMode } from '@/services/ghareebSourceSettings';
import { DEFAULT_GHAREEB_SOURCE_SETTINGS, normalizeGhareebSourceSettings } from '@/services/ghareebSourceSettings';

export function GhareebSourceSettings({ compact = false }: { compact?: boolean }) {
  const storedSourceMode = useSettingsStore((s) => s.settings.ghareebSources?.sourceMode);
  const storedSharedMeaningMode = useSettingsStore((s) => s.settings.ghareebSources?.sharedMeaningMode);
  const setGhareebSources = useSettingsStore((s) => s.setGhareebSources);
  const ghareebSources = normalizeGhareebSourceSettings({
    sourceMode: storedSourceMode,
    sharedMeaningMode: storedSharedMeaningMode,
  });

  return (
    <div className={compact ? 'space-y-3' : 'rounded-xl border border-border bg-card/60 p-4 space-y-4'} dir="rtl">
      {!compact && (
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-primary" />
          <h3 className="font-arabic text-sm font-bold text-foreground">مصادر الكلمات والمعاني</h3>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="font-arabic text-xs text-muted-foreground">مصدر عرض الكلمات</Label>
        <Select
          value={ghareebSources.sourceMode}
          onValueChange={(value) => setGhareebSources({ sourceMode: value as GhareebSourceMode })}
        >
          <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="muyassar-only" className="font-arabic">عرض كلمات الميسر فقط</SelectItem>
            <SelectItem value="new-only" className="font-arabic">عرض كلمات الكتاب الجديد فقط</SelectItem>
            <SelectItem value="both" className="font-arabic">عرض جميع الكلمات من المصادر</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ghareebSources.sourceMode === 'both' && (
        <div className="space-y-1.5">
          <Label className="font-arabic text-xs text-muted-foreground">عند اشتراك الكلمة بين أكثر من مصدر، اعرض معنى:</Label>
          <Select
            value={ghareebSources.sharedMeaningMode}
            onValueChange={(value) => setGhareebSources({ sharedMeaningMode: value as GhareebSharedMeaningMode })}
          >
            <SelectTrigger className="font-arabic"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="muyassar" className="font-arabic">الميسر في غريب القرآن</SelectItem>
              <SelectItem value="new" className="font-arabic">الكتاب الجديد</SelectItem>
              <SelectItem value="ask" className="font-arabic">اسألني عند الضغط على الكلمة</SelectItem>
              <SelectItem value="both" className="font-arabic">اعرض المعنيين</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
