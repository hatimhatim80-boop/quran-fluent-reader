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
  mode: 'continuous';
  mobileLinesPerPage: number;
  desktopLinesPerPage: number;
  minWordsPerLine: number;
  textDirection: 'rtl' | 'ltr';
  textAlign: 'right' | 'left' | 'center' | 'justify';
  autoFitFont: boolean;
  balanceLastLine: boolean;
}

// Color settings
export interface ColorSettings {
  highlightColor: string;
  highlightIntensity: 'soft' | 'medium' | 'strong';
  highlightStyle: 'background' | 'text-only';
  pageBackgroundColor: string;
  containerBorderColor: string;
  popoverBackground: string;
  popoverWordColor: string;
  popoverMeaningColor: string;
  popoverBorder: string;
  /** @deprecated use popoverWordColor instead */
  popoverText?: string;
}

// Meaning box font size settings
export interface MeaningBoxFontSettings {
  wordFontSize: number;
  meaningFontSize: number;
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
  meaningBox: MeaningBoxFontSettings;
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
    containerBorderColor: '',
    popoverBackground: '38 50% 97%',
    popoverWordColor: '25 30% 18%',
    popoverMeaningColor: '25 20% 35%',
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
    mode: 'continuous',
    mobileLinesPerPage: 15,
    desktopLinesPerPage: 15,
    minWordsPerLine: 5,
    textDirection: 'rtl',
    textAlign: 'justify',
    autoFitFont: false,
    balanceLastLine: false,
  },
  update: {
    manifestUrl: '/updates/manifest.json',
    autoUpdate: false,
  },
  meaningBox: {
    wordFontSize: 1.4,
    meaningFontSize: 1.1,
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
  setMeaningBox: (mb: Partial<MeaningBoxFontSettings>) => void;
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

      setMeaningBox: (mb) =>
        set((state) => ({
          settings: {
            ...state.settings,
            meaningBox: { ...state.settings.meaningBox, ...mb },
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
