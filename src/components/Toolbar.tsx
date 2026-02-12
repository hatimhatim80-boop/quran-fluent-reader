import React, { useState, useCallback } from 'react';
import { 
  BookOpen, 
  Rocket, 
  Play,
  Pause,
  Settings2,
  FileText,
  Database,
  FolderOpen,
  MoreHorizontal,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { checkAndUpdate } from '@/services/updateService';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsDialog } from './SettingsDialog';
import { BuildCenterDialog } from './BuildCenterDialog';
import { FullPageEditorDialog } from './FullPageEditorDialog';
import { WorkingDataManager } from './WorkingDataManager';
import { FullFilesViewer } from './FullFilesViewer';
import { DiagnosticModeActivator } from './DiagnosticModeActivator';
import { GhareebWord, QuranPage } from '@/types/quran';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  wordsCount: number;
  currentWordIndex: number;
  currentPage?: number;
  pages?: QuranPage[];
  pageWords?: GhareebWord[];
  allWords?: GhareebWord[];
  renderedWords?: GhareebWord[];
  onNavigateToPage?: (page: number) => void;
  onHighlightWord?: (index: number) => void;
  onRefreshData?: () => void;
  onForceRebuild?: () => void;
}

export function Toolbar({ 
  isPlaying, 
  onPlayPause, 
  wordsCount, 
  currentWordIndex,
  currentPage = 1,
  pages = [],
  pageWords = [],
  allWords = [],
  renderedWords = [],
  onNavigateToPage,
  onHighlightWord,
  onRefreshData,
  onForceRebuild,
}: ToolbarProps) {
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { settings } = useSettingsStore();

  const handleUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const updated = await checkAndUpdate(
        settings.update?.manifestUrl || '/updates/manifest.json',
      );

      if (updated) {
        toast.success('تم تحديث البيانات بنجاح!');
      } else {
        toast.info('البيانات محدّثة بالفعل');
      }
    } catch {
      toast.error('فشل التحديث. تحقق من اتصال الإنترنت.');
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating, settings.update?.manifestUrl]);

  return (
    <header className="pb-1">
      {/* Title */}
      <DiagnosticModeActivator>
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
          </div>
          <h1 className="text-lg font-bold font-arabic text-foreground">
            القرآن الكريم
          </h1>
        </div>
      </DiagnosticModeActivator>
      
      <p className="text-[11px] text-muted-foreground font-arabic mb-2 text-center">
        الميسر في غريب القرآن
      </p>

      {/* Compact toolbar row */}
      <div className="flex items-center justify-center gap-1.5">
        {/* Play/Pause */}
        <button
          type="button"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isPlaying 
              ? 'bg-primary text-primary-foreground shadow-md' 
              : 'nav-button'
          }`}
          onClick={onPlayPause}
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 mr-[-1px]" />}
        </button>

        {/* Word counter */}
        {(isPlaying || currentWordIndex >= 0) && wordsCount > 0 && (
          <span className="text-[10px] font-arabic text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
            {currentWordIndex + 1}/{wordsCount}
          </span>
        )}

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Update button */}
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isUpdating 
              ? 'bg-primary/10 text-primary' 
              : 'nav-button'
          }`}
          title="تحديث البيانات"
        >
          {isUpdating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Settings */}
        <SettingsDialog>
          <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="الإعدادات">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </SettingsDialog>

        {/* Admin toggle */}
        <button
          onClick={() => setShowAdminTools(!showAdminTools)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            showAdminTools ? 'bg-primary/15 border border-primary/30' : 'nav-button'
          }`}
          title="أدوات الإدارة"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {showAdminTools && (
          <>
            <FullFilesViewer pages={pages} allWords={allWords} onRefresh={onRefreshData}>
              <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="عرض الملفات">
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </FullFilesViewer>

            <WorkingDataManager allWords={allWords}>
              <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="مدير التعديلات">
                <Database className="w-3.5 h-3.5" />
              </button>
            </WorkingDataManager>

            <FullPageEditorDialog
              currentPage={currentPage}
              pages={pages}
              pageWords={pageWords}
              allWords={allWords}
              renderedWords={renderedWords}
              onNavigateToPage={onNavigateToPage}
              onHighlightWord={onHighlightWord}
              onRefreshData={onRefreshData}
            >
              <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="محرر الصفحات">
                <FileText className="w-3.5 h-3.5" />
              </button>
            </FullPageEditorDialog>

            <BuildCenterDialog>
              <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="مركز البناء">
                <Rocket className="w-3.5 h-3.5" />
              </button>
            </BuildCenterDialog>
          </>
        )}
      </div>
    </header>
  );
}
