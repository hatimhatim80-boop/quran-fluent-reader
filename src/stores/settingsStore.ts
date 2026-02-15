import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Font settings
export interface FontSettings {
  fontFamily: 'amiri' | 'amiriQuran' | 'notoNaskh' | 'scheherazade' | 'uthman' | 'uthmanicHafs' | 'meQuran' | 'qalam' | 'custom';
  quranFontSize: number;
  meaningFontSize: number;
  lineHeight: number;
  fontWeight: 400 | 500 | 600 | 700;
  customFontUrl?: string;
  customFontFamily?: string;
}

// Display settings
export interface DisplaySettings {
  mode: 'continuous' | 'lines15' | 'hybrid' | 'auto15';
  mobileLinesPerPage: number;
  desktopLinesPerPage: number;
  minWordsPerLine: number;
  textDirection: 'rtl' | 'ltr';
  textAlign: 'right' | 'left' | 'center' | 'justify';
  autoFitFont: boolean;
  balanceLastLine: boolean;
  auto15ShortPageAlign: 'center' | 'top';
}

// Color settings
export interface ColorSettings {
  highlightColor: string;
  highlightIntensity: 'soft' | 'medium' | 'strong';
  highlightStyle: 'background' | 'text-only';
  pageBackgroundColor: string;
  popoverBackground: string;
  popoverText: string;
  popoverBorder: string;
}

// Popover style settings
export interface PopoverSettings {
  width: number;
  padding: number;
  borderRadius: number;
  shadow: 'none' | 'soft' | 'medium' | 'strong';
  showArrow: boolean;
  opacity: number;
}

// Autoplay settings
export interface AutoplaySettings {
  speed: number;
  thinkingGap: number;
  autoAdvancePage: boolean;
  pauseOnMissingMeaning: boolean;
}

// Update settings
export interface UpdateSettings {
  manifestUrl: string;
  autoUpdate: boolean;
}

// Complete app settings
export interface AppSettings {
  fonts: FontSettings;
  colors: ColorSettings;
  popover: PopoverSettings;
  autoplay: AutoplaySettings;
  display: DisplaySettings;
  update: UpdateSettings;
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
    highlightStyle: 'background',
    pageBackgroundColor: '',
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
    mobileLinesPerPage: 15,
    desktopLinesPerPage: 15,
    minWordsPerLine: 5,
    textDirection: 'rtl',
    textAlign: 'justify',
    autoFitFont: false,
    balanceLastLine: false,
    auto15ShortPageAlign: 'center',
  },
  update: {
    manifestUrl: '/updates/manifest.json',
    autoUpdate: false,
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
  setUpdate: (update: Partial<UpdateSettings>) => void;
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

      setUpdate: (update) =>
        set((state) => ({
          settings: {
            ...state.settings,
            update: { ...state.settings.update, ...update },
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
