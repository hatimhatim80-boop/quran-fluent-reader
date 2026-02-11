import React, { useState } from 'react';
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
} from 'lucide-react';
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

  return (
    <header className="text-center pb-2">
      {/* Logo & Title */}
      <DiagnosticModeActivator>
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-arabic text-foreground">
            القرآن الكريم
          </h1>
        </div>
      </DiagnosticModeActivator>
      
      <p className="text-xs text-muted-foreground font-arabic mb-3">
        الميسر في غريب القرآن
      </p>

      {/* Toolbar Icons */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {/* Play/Pause Button */}
        <button
          type="button"
          className={`nav-button w-9 h-9 rounded-lg ${isPlaying ? 'bg-primary/20 border-primary' : ''}`}
          aria-pressed={isPlaying}
          onClick={onPlayPause}
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 mr-[-2px]" />
          )}
        </button>

        {/* Status badge */}
        {(isPlaying || currentWordIndex >= 0) && wordsCount > 0 && (
          <span className="text-xs font-arabic text-muted-foreground bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">
            {currentWordIndex + 1} / {wordsCount}
          </span>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Settings */}
        <SettingsDialog>
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="الإعدادات"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </SettingsDialog>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Admin tools toggle */}
        <button
          onClick={() => setShowAdminTools(!showAdminTools)}
          className={`nav-button w-9 h-9 rounded-lg flex items-center justify-center ${showAdminTools ? 'bg-primary/20 border-primary' : ''}`}
          title="أدوات الإدارة"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Admin tools - conditionally shown */}
        {showAdminTools && (
          <>
            {/* Full Files Viewer */}
            <FullFilesViewer 
              pages={pages} 
              allWords={allWords}
              onRefresh={onRefreshData}
            >
              <button
                className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
                title="عرض الملفات الكاملة"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </FullFilesViewer>

            {/* Data Manager */}
            <WorkingDataManager allWords={allWords}>
              <button
                className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
                title="مدير التعديلات"
              >
                <Database className="w-4 h-4" />
              </button>
            </WorkingDataManager>

            {/* Full Page Editor */}
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
              <button
                className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
                title="محرر الصفحات الكامل"
              >
                <FileText className="w-4 h-4" />
              </button>
            </FullPageEditorDialog>

            {/* Build Center */}
            <BuildCenterDialog>
              <button
                className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
                title="مركز البناء"
              >
                <Rocket className="w-4 h-4" />
              </button>
            </BuildCenterDialog>
          </>
        )}
      </div>
    </header>
  );
}
