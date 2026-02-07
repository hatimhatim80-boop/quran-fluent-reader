import React from 'react';
import { 
  BookOpen, 
  Type, 
  Palette, 
  LayoutGrid, 
  Rocket, 
  ClipboardCheck,
  Play,
  Pause,
  Settings2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SettingsDialog } from './SettingsDialog';
import { BuildCenterDialog } from './BuildCenterDialog';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  wordsCount: number;
  currentWordIndex: number;
}

export function Toolbar({ isPlaying, onPlayPause, wordsCount, currentWordIndex }: ToolbarProps) {
  return (
    <header className="text-center pb-2">
      <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
        {/* Logo */}
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-arabic text-foreground">
            القرآن الكريم
          </h1>
        </div>

        {/* Play/Pause Button */}
        <button
          type="button"
          className={`nav-button w-10 h-10 rounded-lg ${isPlaying ? 'bg-primary/20 border-primary' : ''}`}
          aria-pressed={isPlaying}
          onClick={onPlayPause}
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل معاني الكلمات'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 mr-[-2px]" />
          )}
        </button>

        {/* Status badge */}
        {(isPlaying || currentWordIndex >= 0) && wordsCount > 0 && (
          <span className="text-xs font-arabic text-muted-foreground bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">
            {currentWordIndex + 1} / {wordsCount}
          </span>
        )}

        {/* Toolbar Icons */}
        <div className="flex items-center gap-1">
          {/* Settings */}
          <SettingsDialog>
            <button
              className="nav-button w-10 h-10 rounded-lg flex items-center justify-center"
              title="الإعدادات"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </SettingsDialog>

          {/* Build Center */}
          <BuildCenterDialog>
            <button
              className="nav-button w-10 h-10 rounded-lg flex items-center justify-center"
              title="مركز البناء"
            >
              <Rocket className="w-5 h-5" />
            </button>
          </BuildCenterDialog>

          {/* Validation Report */}
          <Link
            to="/validation"
            className="nav-button w-10 h-10 rounded-lg flex items-center justify-center"
            title="تقرير التحقق من المطابقة"
          >
            <ClipboardCheck className="w-5 h-5" />
          </Link>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground font-arabic">
        الميسر في غريب القرآن
      </p>
    </header>
  );
}
