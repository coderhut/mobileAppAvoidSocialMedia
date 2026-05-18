export type Step = 'onboarding' | 'permission' | 'apps' | 'dashboard';
export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguageCode = 'en' | 'ur';
export type LimitMode = 'track' | 'warn';

export type TranslationKey =
  | 'appName'
  | 'settings'
  | 'close'
  | 'theme'
  | 'useDeviceSetting'
  | 'light'
  | 'dark'
  | 'language'
  | 'english'
  | 'urdu'
  | 'selected'
  | 'privacyNoteTitle'
  | 'privacyNoteBody'
  | 'introTitle'
  | 'introBody'
  | 'trackSelectedApps'
  | 'keepLocal'
  | 'androidUsageAccess'
  | 'getStarted'
  | 'previewDashboard'
  | 'stepOne'
  | 'permissionTitle'
  | 'permissionBody'
  | 'whatThisEnables'
  | 'whatThisEnablesBody'
  | 'openUsageAccessSettings'
  | 'checkingAccess'
  | 'accessDetected'
  | 'returnAfterEnabling'
  | 'androidOnlyTitle'
  | 'androidOnlyBody'
  | 'unableToCheckAccess'
  | 'usageStatsAndroidOnly'
  | 'usageStatsUnavailableBody'
  | 'stepTwo'
  | 'appSelectionTitle'
  | 'appSelectionBody'
  | 'selectedLabel'
  | 'addLabel'
  | 'continueWith'
  | 'appSingular'
  | 'appPlural'
  | 'dashboard'
  | 'dashboardTitle'
  | 'dashboardBody'
  | 'dashboardEmpty'
  | 'trackedToday'
  | 'usageStatsUnavailable'
  | 'usageAccessNeeded'
  | 'enableUsageAccessBody'
  | 'noUsageToday'
  | 'notInstalled'
  | 'selectedAppsMissing'
  | 'dailyLimit'
  | 'trackOnly'
  | 'warnAfter'
  | 'remaining'
  | 'overLimit'
  | 'minutesShort'
  | 'trackedApps'
  | 'refresh'
  | 'edit';

export type TrackableApp = {
  name: string;
  packageName: string;
  category: string;
  accent: string;
  isSystemApp?: boolean;
};

export type UsageStat = {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastTimeUsedMs: number;
};

export type DailyLimitSetting = {
  mode: LimitMode;
  limitMinutes: number;
};

export type DailyLimitSettings = Record<string, DailyLimitSetting>;

export type InstalledApp = {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
};

export type UsageStatsBridge = {
  getInstalledApps: () => Promise<InstalledApp[]>;
  hasUsageAccess: () => Promise<boolean>;
  getTodayUsageStats: () => Promise<UsageStat[]>;
};

export type AppPreferences = {
  themePreference?: string;
  language?: string;
  selectedPackageNames?: string[];
  dailyLimitSettings?: string;
};

export type AppPreferencesBridge = {
  getPreferences: () => Promise<AppPreferences>;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  setSelectedPackageNames: (packageNames: string[]) => Promise<void>;
  setDailyLimitSettings: (settingsJson: string) => Promise<void>;
};

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  mutedText: string;
  subtleText: string;
  border: string;
  primary: string;
  primaryText: string;
  success: string;
  noticeBackground: string;
  noticeBorder: string;
  noticeTitle: string;
  noticeText: string;
  metricBackground: string;
  metricText: string;
  metricLabel: string;
};
