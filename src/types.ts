export type Step =
  | 'language'
  | 'onboarding'
  | 'recordings'
  | 'apps'
  | 'setup_permissions'
  | 'dashboard';
export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguageCode = 'en' | 'ur';
export type LimitMode = 'track' | 'warn';

export type TranslationKey =
  | 'appName'
  | 'settings'
  | 'close'
  | 'loadingPreferencesLabel'
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
  | 'continueLabel'
  | 'saveLabel'
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
  | 'manageVoiceNotesLabel'
  | 'managePermissionsLabel'
  | 'voiceNotesTitle'
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
  | 'startRecordingLabel'
  | 'doneLabel'
  | 'pendingLabel'
  | 'playingLabel'
  | 'readyLabel'
  | 'pausedLabel'
  | 'playLabel'
  | 'pauseLabel'
  | 'resumeLabel'
  | 'stopLabel'
  | 'required'
  | 'optional'
  | 'requiredVoiceNoteAlert'
  | 'voiceNotesSavedAlert'
  | 'minRecordingsAlert'
  | 'finishSetup'
  | 'setupPermissionsTitle'
  | 'setupPermissionsBody'
  | 'doneSettingPermissionsLabel'
  | 'usageAccessLabel'
  | 'usageAccessDesc'
  | 'usageAccessRequiredMessage'
  | 'overlayLabel'
  | 'overlayDesc'
  | 'overlayRequiredMessage'
  | 'microphoneLabel'
  | 'microphoneDesc'
  | 'microphoneRequiredMessage'
  | 'notificationLabel'
  | 'notificationDesc'
  | 'grantLabel'
  | 'allSetLabel'
  | 'renownedAppsLabel'
  | 'otherAppsLabel';

export type TrackableApp = {
  name: string;
  packageName: string;
  category: string;
  accent: string;
  icon?: string;
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
  icon?: string;
};

export type UsageStatsBridge = {
  getInstalledApps: () => Promise<InstalledApp[]>;
  hasUsageAccess: () => Promise<boolean>;
  getTodayUsageStats: () => Promise<UsageStat[]>;
  hasOverlayPermission: () => Promise<boolean>;
  hasNotificationPermission: () => Promise<boolean>;
  requestUsageAccessPermission: () => Promise<void>;
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
  voiceNoteDurations?: string; // JSON string of Record<level, Record<index, durationMs>>
  globalDailyLimit?: number; // In minutes
  hasCompletedOnboarding?: boolean;
};

export type AppPreferencesBridge = {
  getPreferences: () => Promise<AppPreferences>;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  setSelectedPackageNames: (packageNames: string[]) => Promise<void>;
  setDailyLimitSettings: (settingsJson: string) => Promise<void>;
  setVoiceNotes: (voiceNotesJson: string) => Promise<void>;
  setVoiceNoteDurations: (durationsJson: string) => Promise<void>;
  setGlobalDailyLimit: (limitMinutes: number) => Promise<void>;
  setHasCompletedOnboarding: (completed: boolean) => Promise<void>;
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
