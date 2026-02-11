import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Font settings
export interface FontSettings {
  fontFamily: 'amiri' | 'amiriQuran' | 'notoNaskh' | 'scheherazade' | 'uthman' | 'uthmanicHafs';
  quranFontSize: number; // rem
  meaningFontSize: number; // rem
  lineHeight: number;
  fontWeight: 400 | 500 | 600 | 700;
}

// Display settings
export interface DisplaySettings {
  mode: 'continuous' | 'lines15'; // continuous flow or 15-line Madina style
}

// Color settings
export interface ColorSettings {
  highlightColor: string; // HSL values
  highlightIntensity: 'soft' | 'medium' | 'strong';
  popoverBackground: string;
  popoverText: string;
  popoverBorder: string;
}

// Popover style settings
export interface PopoverSettings {
  width: number; // px
  padding: number; // px
  borderRadius: number; // px
  shadow: 'none' | 'soft' | 'medium' | 'strong';
  showArrow: boolean;
  opacity: number; // 0-100
}

// Autoplay settings
export interface AutoplaySettings {
  speed: number; // seconds per word
  thinkingGap: number; // ms before showing meaning
  autoAdvancePage: boolean;
  pauseOnMissingMeaning: boolean;
}

// Complete app settings
export interface AppSettings {
  fonts: FontSettings;
  colors: ColorSettings;
  popover: PopoverSettings;
  autoplay: AutoplaySettings;
  display: DisplaySettings;
  debugMode: boolean;
}

// Default settings
const defaultSettings: AppSettings = {
  fonts: {
    fontFamily: 'uthman',
    quranFontSize: 1.75,
    meaningFontSize: 1.15,
    lineHeight: 1.9,
    fontWeight: 400,
  },
  colors: {
    highlightColor: '48 80% 90%',
    highlightIntensity: 'medium',
    popoverBackground: '38 50% 97%',
    popoverText: '25 30% 18%',
    popoverBorder: '35 25% 88%',
  },
  popover: {
    width: 200,
    padding: 12,
    borderRadius: 12,
    shadow: 'medium',
    showArrow: true,
    opacity: 100,
  },
  autoplay: {
    speed: 4,
    thinkingGap: 800,
    autoAdvancePage: false,
    pauseOnMissingMeaning: false,
  },
  display: {
    mode: 'lines15',
  },
  debugMode: false,
};

interface SettingsState {
  settings: AppSettings;
  setFonts: (fonts: Partial<FontSettings>) => void;
  setColors: (colors: Partial<ColorSettings>) => void;
  setPopover: (popover: Partial<PopoverSettings>) => void;
  setAutoplay: (autoplay: Partial<AutoplaySettings>) => void;
  setDisplay: (display: Partial<DisplaySettings>) => void;
  setDebugMode: (enabled: boolean) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,

      setFonts: (fonts) =>
        set((state) => ({
          settings: {
            ...state.settings,
            fonts: { ...state.settings.fonts, ...fonts },
          },
        })),

      setColors: (colors) =>
        set((state) => ({
          settings: {
            ...state.settings,
            colors: { ...state.settings.colors, ...colors },
          },
        })),

      setPopover: (popover) =>
        set((state) => ({
          settings: {
            ...state.settings,
            popover: { ...state.settings.popover, ...popover },
          },
        })),

      setAutoplay: (autoplay) =>
        set((state) => ({
          settings: {
            ...state.settings,
            autoplay: { ...state.settings.autoplay, ...autoplay },
          },
        })),

      setDisplay: (display) =>
        set((state) => ({
          settings: {
            ...state.settings,
            display: { ...state.settings.display, ...display },
          },
        })),

      setDebugMode: (enabled) =>
        set((state) => ({
          settings: { ...state.settings, debugMode: enabled },
        })),

      resetSettings: () => set({ settings: defaultSettings }),

      exportSettings: () => {
        const data = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          settings: get().settings,
        };
        return JSON.stringify(data, null, 2);
      },

      importSettings: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.settings) {
            set({ settings: { ...defaultSettings, ...data.settings } });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'quran-app-settings',
    }
  )
);
