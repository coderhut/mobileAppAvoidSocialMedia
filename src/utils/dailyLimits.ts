import type {
  DailyLimitSetting,
  DailyLimitSettings,
  TrackableApp,
  TranslationKey,
} from '../types';

export const DEFAULT_DAILY_LIMIT_SETTING: DailyLimitSetting = {
  mode: 'track',
  limitMinutes: 30,
};

export const LIMIT_STEP_MINUTES = 5;

const MIN_LIMIT_MINUTES = 5;
const MAX_LIMIT_MINUTES = 480;

export function parseDailyLimitSettings(
  value: string | undefined,
): DailyLimitSettings {
  if (!value) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!parsedValue || typeof parsedValue !== 'object') {
      return {};
    }

    return Object.entries(parsedValue).reduce<DailyLimitSettings>(
      (settings, [packageName, setting]) => {
        if (typeof packageName === 'string' && isDailyLimitSetting(setting)) {
          settings[packageName] = normalizeDailyLimitSetting(setting);
        }

        return settings;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function normalizeDailyLimitSetting(
  setting: DailyLimitSetting,
): DailyLimitSetting {
  return {
    mode: setting.mode === 'warn' ? 'warn' : 'track',
    limitMinutes: clampLimitMinutes(setting.limitMinutes),
  };
}

export function getDailyLimitSetting(
  settings: DailyLimitSettings,
  packageName: string,
) {
  return normalizeDailyLimitSetting(
    settings[packageName] ?? DEFAULT_DAILY_LIMIT_SETTING,
  );
}

export function clampLimitMinutes(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_DAILY_LIMIT_SETTING.limitMinutes;
  }

  return Math.min(
    MAX_LIMIT_MINUTES,
    Math.max(MIN_LIMIT_MINUTES, Math.round(minutes)),
  );
}

export function getUsageStatusText(
  item: {
    app?: TrackableApp;
    isInstalled: boolean;
    usageMs: number;
  },
  t: (key: TranslationKey) => string,
) {
  if (!item.isInstalled) {
    return t('notInstalled');
  }

  if (item.usageMs === 0) {
    return t('noUsageToday');
  }

  return item.app?.category ?? t('trackedToday');
}

function isDailyLimitSetting(value: unknown): value is DailyLimitSetting {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const setting = value as Partial<DailyLimitSetting>;
  return (
    (setting.mode === 'track' || setting.mode === 'warn') &&
    typeof setting.limitMinutes === 'number'
  );
}
