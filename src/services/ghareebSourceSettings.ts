export type GhareebSourceKey = 'muyassar' | 'new' | 'muharrar';
export type GhareebSourceMode = 'muyassar-only' | 'new-only' | 'muharrar-only' | 'both';
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
  muharrar: 'المحرر في غريب القرآن',
} as const;
