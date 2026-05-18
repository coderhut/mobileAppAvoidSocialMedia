import React, {useMemo, useState} from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  StatusBar,
  View,
  useColorScheme,
} from 'react-native';
import {SettingsPanel} from './src/components/common/SettingsPanel';
import {AppSelectionScreen} from './src/components/screens/AppSelectionScreen';
import {DashboardScreen} from './src/components/screens/DashboardScreen';
import {IntroScreen} from './src/components/screens/IntroScreen';
import {PermissionScreen} from './src/components/screens/PermissionScreen';
import {TRANSLATIONS} from './src/locales';
import {AppPreferencesModule, UsageStatsModule} from './src/native/modules';
import {AppThemeContext, useAppTheme} from './src/theme/ThemeContext';
import {DARK_COLORS, LIGHT_COLORS} from './src/theme/colors';
import {createThemedStyles} from './src/theme/styles';
import type {
  DailyLimitSetting,
  DailyLimitSettings,
  LanguageCode,
  Step,
  ThemeMode,
  ThemePreference,
  TrackableApp,
  TranslationKey,
  UsageStat,
} from './src/types';
import {FALLBACK_TRACKABLE_APPS, toTrackableApp} from './src/utils/apps';
import {
  normalizeDailyLimitSetting,
  parseDailyLimitSettings,
} from './src/utils/dailyLimits';

function App() {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('system');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const themeMode: ThemeMode =
    themePreference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themePreference;

  const colors = themeMode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createThemedStyles(colors), [colors]);
  const handleSetLanguage = React.useCallback((nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage);
    AppPreferencesModule?.setLanguage(nextLanguage).catch(() => undefined);
  }, []);
  const handleSetThemePreference = React.useCallback(
    (nextThemePreference: ThemePreference) => {
      setThemePreference(nextThemePreference);
      AppPreferencesModule?.setThemePreference(nextThemePreference).catch(
        () => undefined,
      );
    },
    [],
  );
  const theme = useMemo(
    () => ({
      colors,
      language,
      mode: themeMode,
      setLanguage: handleSetLanguage,
      setThemePreference: handleSetThemePreference,
      styles,
      t: (key: TranslationKey) => TRANSLATIONS[language][key],
      themePreference,
    }),
    [
      colors,
      handleSetLanguage,
      handleSetThemePreference,
      language,
      styles,
      themeMode,
      themePreference,
    ],
  );

  React.useEffect(() => {
    let isMounted = true;

    AppPreferencesModule?.getPreferences()
      .then(preferences => {
        if (!isMounted) {
          return;
        }

        if (isThemePreference(preferences.themePreference)) {
          setThemePreference(preferences.themePreference);
        }

        if (isLanguageCode(preferences.language)) {
          setLanguage(preferences.language);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppThemeContext.Provider value={theme}>
      <StatusBar
        backgroundColor={colors.background}
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
      />
      <AppContent />
    </AppThemeContext.Provider>
  );
}

function AppContent() {
  const {styles, t} = useAppTheme();
  const [step, setStep] = useState<Step>('onboarding');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableApps, setAvailableApps] = useState<TrackableApp[]>(
    FALLBACK_TRACKABLE_APPS,
  );
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [hasUsageAccess, setHasUsageAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [dailyLimitSettings, setDailyLimitSettings] =
    useState<DailyLimitSettings>({});
  const [selectedPackageNames, setSelectedPackageNames] = useState<string[]>([
    'com.instagram.android',
    'com.google.android.youtube',
  ]);

  const selectedApps = useMemo(
    () =>
      selectedPackageNames
        .map(packageName =>
          availableApps.find(app => app.packageName === packageName),
        )
        .filter((app): app is TrackableApp => Boolean(app)),
    [availableApps, selectedPackageNames],
  );

  const usageByPackage = useMemo(() => {
    return usageStats.reduce<Record<string, UsageStat>>((accumulator, stat) => {
      accumulator[stat.packageName] = stat;
      return accumulator;
    }, {});
  }, [usageStats]);

  const totalTrackedMs = selectedApps.reduce((total, app) => {
    return total + (usageByPackage[app.packageName]?.totalTimeMs ?? 0);
  }, 0);

  function toggleApp(packageName: string) {
    setSelectedPackageNames(current => {
      const nextPackageNames = current.includes(packageName)
        ? current.filter(selectedPackageName => selectedPackageName !== packageName)
        : [...current, packageName];

      AppPreferencesModule?.setSelectedPackageNames(nextPackageNames).catch(
        () => undefined,
      );
      return nextPackageNames;
    });
  }

  function updateDailyLimitSetting(
    packageName: string,
    setting: DailyLimitSetting,
  ) {
    setDailyLimitSettings(current => {
      const nextSettings = {
        ...current,
        [packageName]: normalizeDailyLimitSetting(setting),
      };

      AppPreferencesModule?.setDailyLimitSettings(
        JSON.stringify(nextSettings),
      ).catch(() => undefined);
      return nextSettings;
    });
  }

  async function openUsageAccessSettings() {
    if (Platform.OS !== 'android') {
      Alert.alert(t('androidOnlyTitle'), t('androidOnlyBody'));
      return;
    }

    try {
      await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
    } catch {
      await Linking.openSettings();
    }
  }

  const refreshUsageAccess = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return false;
    }

    setIsCheckingAccess(true);
    try {
      const nextHasUsageAccess = await UsageStatsModule.hasUsageAccess();
      setHasUsageAccess(nextHasUsageAccess);
      if (nextHasUsageAccess) {
        setUsageError(null);
      }
      return nextHasUsageAccess;
    } catch {
      setUsageError(t('unableToCheckAccess'));
      return false;
    } finally {
      setIsCheckingAccess(false);
    }
  }, [t]);

  const refreshUsageStats = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      setUsageError(t('usageStatsAndroidOnly'));
      return;
    }

    try {
      const stats = await UsageStatsModule.getTodayUsageStats();
      setUsageStats(stats);
      setUsageError(null);
    } catch {
      setUsageStats([]);
      setUsageError(t('usageStatsUnavailableBody'));
    }
  }, [t]);

  const loadInstalledApps = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return;
    }

    setIsLoadingApps(true);
    try {
      const installedApps = await UsageStatsModule.getInstalledApps();
      const nextApps = installedApps.map(toTrackableApp);

      if (nextApps.length > 0) {
        setAvailableApps(nextApps);
      }
    } catch {
      setAvailableApps(FALLBACK_TRACKABLE_APPS);
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  React.useEffect(() => {
    refreshUsageAccess();
    loadInstalledApps();

    AppPreferencesModule?.getPreferences()
      .then(preferences => {
        if (Array.isArray(preferences.selectedPackageNames)) {
          setSelectedPackageNames(preferences.selectedPackageNames);
        }

        setDailyLimitSettings(
          parseDailyLimitSettings(preferences.dailyLimitSettings),
        );
      })
      .catch(() => undefined);

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshUsageAccess();
        loadInstalledApps();
      }
    });

    return () => subscription.remove();
  }, [loadInstalledApps, refreshUsageAccess]);

  React.useEffect(() => {
    if (hasUsageAccess) {
      refreshUsageStats();
    }
  }, [hasUsageAccess, refreshUsageStats]);

  React.useEffect(() => {
    if (step === 'permission' && hasUsageAccess) {
      setStep('apps');
    }
  }, [hasUsageAccess, step]);

  function renderContent() {
    if (step === 'onboarding') {
      return (
        <IntroScreen
          onContinue={() => setStep('permission')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSkipToDashboard={() => setStep('dashboard')}
        />
      );
    }

    if (step === 'permission') {
      return (
        <PermissionScreen
          hasUsageAccess={hasUsageAccess}
          isCheckingAccess={isCheckingAccess}
          onOpenSettingsMenu={() => setIsSettingsOpen(true)}
          onOpenSettings={openUsageAccessSettings}
        />
      );
    }

    if (step === 'apps') {
      return (
        <AppSelectionScreen
          availableApps={availableApps}
          isLoadingApps={isLoadingApps}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleApp={toggleApp}
          onContinue={() => setStep('dashboard')}
          selectedPackageNames={selectedPackageNames}
        />
      );
    }

    return (
      <DashboardScreen
        availableApps={availableApps}
        dailyLimitSettings={dailyLimitSettings}
        hasUsageAccess={hasUsageAccess}
        selectedPackageNames={selectedPackageNames}
        totalTrackedMs={totalTrackedMs}
        usageByPackage={usageByPackage}
        usageError={usageError}
        onEditApps={() => setStep('apps')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={refreshUsageStats}
        onUpdateDailyLimitSetting={updateDailyLimitSetting}
      />
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.appShell}>{renderContent()}</View>
      <SettingsPanel
        isVisible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </View>
  );
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'en' || value === 'ur';
}

export default App;
