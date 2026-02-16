import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import '@fontsource/amiri-quran/400.css';

/**
 * Hook that applies settings to CSS custom properties in real-time.
 * This ensures all font, color, and popover settings take immediate effect.
 */
export function useSettingsApplier() {
  const { settings } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;

    // === FONT SETTINGS ===
    const fontMap: Record<string, string> = {
      amiri: "'Amiri', 'Noto Naskh Arabic', serif",
      amiriQuran: "'Amiri Quran', 'Amiri', serif",
      notoNaskh: "'Noto Naskh Arabic', 'Amiri', serif",
      scheherazade: "'Scheherazade New', 'Amiri', serif",
      uthman: "'KFGQPC HAFS Uthmanic Script', 'Amiri', serif",
      uthmanicHafs: "'UthmanicHafs', 'KFGQPC HAFS Uthmanic Script', 'Amiri', serif",
      uthmanTN: "'UthmanTN', 'Amiri', serif",
      kfgqpcAnnotated: "'KFGQPCAnnotated', 'Amiri', serif",
      meQuran: "'me_quran', 'Amiri', serif",
      qalam: "'Al Qalam Quran', 'Amiri', serif",
      custom: settings.fonts.customFontFamily ? `'${settings.fonts.customFontFamily}', 'Amiri', serif` : "'Amiri', serif",
    };

    root.style.setProperty('--quran-font-family', fontMap[settings.fonts.fontFamily] || fontMap.uthman);
    root.style.setProperty('--quran-font-size', `${settings.fonts.quranFontSize}rem`);
    root.style.setProperty('--meaning-font-size', `${settings.fonts.meaningFontSize}rem`);
    root.style.setProperty('--quran-line-height', String(settings.fonts.lineHeight));
    root.style.setProperty('--quran-font-weight', String(settings.fonts.fontWeight));

    // === COLOR SETTINGS ===
    // Highlight intensity affects opacity/saturation
    const intensityMap: Record<string, { opacity: number; saturation: number }> = {
      soft: { opacity: 0.4, saturation: 60 },
      medium: { opacity: 0.6, saturation: 80 },
      strong: { opacity: 0.9, saturation: 95 },
    };
    const intensity = intensityMap[settings.colors.highlightIntensity] || intensityMap.medium;
    
    root.style.setProperty('--highlight-opacity', String(intensity.opacity));
    root.style.setProperty('--highlight-saturation', `${intensity.saturation}%`);
    root.style.setProperty('--highlight-color', settings.colors.highlightColor);
    root.style.setProperty('--highlight-style', settings.colors.highlightStyle || 'background');
    
    // Page background color
    if (settings.colors.pageBackgroundColor) {
      root.style.setProperty('--page-bg-custom', settings.colors.pageBackgroundColor);
    } else {
      root.style.removeProperty('--page-bg-custom');
    }
    
    // Popover colors
    root.style.setProperty('--popover-bg-custom', settings.colors.popoverBackground);
    root.style.setProperty('--popover-text-custom', settings.colors.popoverText);
    root.style.setProperty('--popover-border-custom', settings.colors.popoverBorder);
    root.style.setProperty('--popover-text-resolved', `hsl(${settings.colors.popoverText})`);

    // === POPOVER STYLE SETTINGS ===
    root.style.setProperty('--popover-width', `${settings.popover.width}px`);
    root.style.setProperty('--popover-padding', `${settings.popover.padding}px`);
    root.style.setProperty('--popover-border-radius', `${settings.popover.borderRadius}px`);
    root.style.setProperty('--popover-opacity', String(settings.popover.opacity / 100));
    
    const shadowMap: Record<string, string> = {
      none: 'none',
      soft: '0 2px 8px rgba(0, 0, 0, 0.08)',
      medium: '0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.08)',
      strong: '0 12px 32px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.12)',
    };
    root.style.setProperty('--popover-shadow', shadowMap[settings.popover.shadow] || shadowMap.medium);
    root.style.setProperty('--popover-show-arrow', settings.popover.showArrow ? '1' : '0');

    // === DISPLAY SETTINGS ===
    root.style.setProperty('--quran-text-align', settings.display?.textAlign || 'justify');
    root.style.setProperty('--quran-text-direction', settings.display?.textDirection || 'rtl');

    // Custom font support
    if (settings.fonts.fontFamily === 'custom' && (settings.fonts as any).customFontUrl) {
      const url = (settings.fonts as any).customFontUrl;
      const existingLink = document.getElementById('custom-quran-font-link');
      if (existingLink) existingLink.remove();
      const link = document.createElement('link');
      link.id = 'custom-quran-font-link';
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }

    // Debug mode logging
    if (settings.debugMode) {
      console.log('[SettingsApplier] Applied settings:', {
        font: settings.fonts.fontFamily,
        fontSize: settings.fonts.quranFontSize,
        intensity: settings.colors.highlightIntensity,
        popoverWidth: settings.popover.width,
      });
    }
  }, [settings]);

  return settings;
}
