import React from 'react';
import { 
  BookOpen, 
  Rocket, 
  Play,
  Pause,
  Settings2,
  ArrowDownUp,
  FileText,
  Wrench,
  FolderOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SettingsDialog } from './SettingsDialog';
import { BuildCenterDialog } from './BuildCenterDialog';
import { OrderFixerDialog } from './OrderFixerDialog';
import { PageEditorDialog } from './PageEditorDialog';
import { FileEditorDialog } from './FileEditorDialog';
import { GhareebWord } from '@/types/quran';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  wordsCount: number;
  currentWordIndex: number;
  currentPage?: number;
  pageWords?: GhareebWord[];
  allWords?: GhareebWord[];
  onNavigateToPage?: (page: number) => void;
  onHighlightWord?: (index: number) => void;
}

export function Toolbar({ 
  isPlaying, 
  onPlayPause, 
  wordsCount, 
  currentWordIndex,
  currentPage = 1,
  pageWords = [],
  allWords = [],
  onNavigateToPage,
  onHighlightWord,
}: ToolbarProps) {

  return (
    <header className="text-center pb-2">
      {/* Logo & Title */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-arabic text-foreground">
          القرآن الكريم
        </h1>
      </div>
      
      <p className="text-xs text-muted-foreground font-arabic mb-3">
        الميسر في غريب القرآن
      </p>

      {/* Single Row Toolbar Icons */}
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

        {/* Settings (unified - includes fonts, colors, popover) */}
        <SettingsDialog>
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="الإعدادات (الخطوط، الألوان، النوافذ)"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </SettingsDialog>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Validation Report / Fix Mismatches */}
        <Link
          to="/validation"
          className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
          title="تقرير المطابقة وإصلاح المشاكل"
        >
          <Wrench className="w-4 h-4" />
        </Link>

        {/* File Editor */}
        <FileEditorDialog allWords={allWords}>
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="محرر الملفات"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </FileEditorDialog>

        {/* Page Editor */}
        <PageEditorDialog
          currentPage={currentPage}
          pageWords={pageWords}
          onNavigateToPage={onNavigateToPage}
          onHighlightWord={onHighlightWord}
        >
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="التعديل حسب الصفحات"
          >
            <FileText className="w-4 h-4" />
          </button>
        </PageEditorDialog>

        {/* Order Fixer */}
        <OrderFixerDialog
          currentPage={currentPage}
          onNavigateToPage={onNavigateToPage}
        >
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="مصحح الترتيب"
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </OrderFixerDialog>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Build Center */}
        <BuildCenterDialog>
          <button
            className="nav-button w-9 h-9 rounded-lg flex items-center justify-center"
            title="مركز البناء"
          >
            <Rocket className="w-4 h-4" />
          </button>
        </BuildCenterDialog>
      </div>
    </header>
  );
}
