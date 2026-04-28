export type GhareebSourceKey = 'muyassar' | 'new';
export type GhareebSourceMode = 'muyassar-only' | 'new-only' | 'both';
export type GhareebSharedMeaningMode = GhareebSourceKey | 'ask' | 'both';

export interface GhareebSourceSettingsValue {
  sourceMode: GhareebSourceMode;
  sharedMeaningMode: GhareebSharedMeaningMode;
}

export const DEFAULT_GHAREEB_SOURCE_SETTINGS: GhareebSourceSettingsValue = {
  sourceMode: 'muyassar-only',
  sharedMeaningMode: 'muyassar',
};

export const GHAREEB_SOURCE_LABELS = {
  muyassar: 'الميسر في غريب القرآن',
  new: 'الكتاب الجديد',
} as const;

export function normalizeGhareebSourceSettings(settings?: Partial<GhareebSourceSettingsValue>): GhareebSourceSettingsValue {
  const sourceMode = settings?.sourceMode === 'new-only' || settings?.sourceMode === 'both'
    ? settings.sourceMode
    : DEFAULT_GHAREEB_SOURCE_SETTINGS.sourceMode;
  const sharedMeaningMode = settings?.sharedMeaningMode === 'new' || settings?.sharedMeaningMode === 'ask' || settings?.sharedMeaningMode === 'both'
    ? settings.sharedMeaningMode
    : DEFAULT_GHAREEB_SOURCE_SETTINGS.sharedMeaningMode;

  return { sourceMode, sharedMeaningMode };
}
