export type Step = 'onboarding' | 'setup_permissions' | 'apps' | 'recordings' | 'dashboard';
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
  | 'overlayPermissionTitle'
  | 'overlayPermissionBody'
  | 'openOverlaySettings'
  | 'overlayAccessDetected'
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
  | 'edit'
  | 'stepThree'
  | 'recordingsTitle'
  | 'recordingsBody'
  | 'level1Title'
  | 'level1Desc'
  | 'level2Title'
  | 'level2Desc'
  | 'level3Title'
  | 'level3Desc'
  | 'holdToRecord'
  | 'releaseToStop'
  | 'required'
  | 'optional'
  | 'minRecordingsAlert'
  | 'finishSetup'
  | 'setupPermissionsTitle'
  | 'setupPermissionsBody'
  | 'usageAccessLabel'
  | 'usageAccessDesc'
  | 'overlayLabel'
  | 'overlayDesc'
  | 'microphoneLabel'
  | 'microphoneDesc'
  | 'notificationLabel'
  | 'notificationDesc'
  | 'grantLabel'
  | 'allSetLabel';

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
  hasOverlayPermission: () => Promise<boolean>;
  requestOverlayPermission: () => Promise<void>;
  startWatchdogService: () => Promise<void>;
  stopWatchdogService: () => Promise<void>;
};

export type AppPreferences = {
  themePreference?: string;
  language?: string;
  selectedPackageNames?: string[];
  dailyLimitSettings?: string;
  voiceNotes?: string; // JSON string of Record<string, string[]> (level -> filePaths)
  globalDailyLimit?: number; // In minutes
};

export type AppPreferencesBridge = {
  getPreferences: () => Promise<AppPreferences>;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  setSelectedPackageNames: (packageNames: string[]) => Promise<void>;
  setDailyLimitSettings: (settingsJson: string) => Promise<void>;
  setVoiceNotes: (voiceNotesJson: string) => Promise<void>;
  setGlobalDailyLimit: (limitMinutes: number) => Promise<void>;
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
