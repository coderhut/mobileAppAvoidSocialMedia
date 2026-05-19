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
import {BatteryOptimizationScreen} from './src/components/screens/BatteryOptimizationScreen';
import {DashboardScreen} from './src/components/screens/DashboardScreen';
import {IntroScreen} from './src/components/screens/IntroScreen';
import {OverlayPermissionScreen} from './src/components/screens/OverlayPermissionScreen';
import {PermissionScreen} from './src/components/screens/PermissionScreen';
import {VoiceRecordingScreen} from './src/components/screens/VoiceRecordingScreen';
import {TRANSLATIONS} from './src/locales';
import {UsageStatsModule} from './src/native/modules';
import {AppThemeContext, useAppTheme} from './src/theme/ThemeContext';
import {DARK_COLORS, LIGHT_COLORS} from './src/theme/colors';
import {createThemedStyles} from './src/theme/styles';
import {SettingsProvider, useSettings} from './src/contexts/SettingsContext';
import type {
  LanguageCode,
  Step,
  ThemeMode,
  ThemePreference,
  TrackableApp,
  TranslationKey,
  UsageStat,
} from './src/types';
import {FALLBACK_TRACKABLE_APPS, toTrackableApp} from './src/utils/apps';

function App() {
  return (
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  );
}

function ThemedApp() {
  const {themePreference, language, setLanguage, setThemePreference} = useSettings();
  const systemScheme = useColorScheme();
  const themeMode: ThemeMode =
    themePreference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themePreference;

  const colors = themeMode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createThemedStyles(colors), [colors]);

  const theme = useMemo(
    () => ({
      colors,
      language,
      mode: themeMode,
      setLanguage,
      setThemePreference,
      styles,
      t: (key: TranslationKey) => TRANSLATIONS[language][key],
      themePreference,
    }),
    [
      colors,
      language,
      setLanguage,
      setThemePreference,
      styles,
      themeMode,
      themePreference,
    ],
  );

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
  const {selectedPackageNames} = useSettings();
  const [step, setStep] = useState<Step>('onboarding');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableApps, setAvailableApps] = useState<TrackableApp[]>(
    FALLBACK_TRACKABLE_APPS,
  );
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [hasUsageAccess, setHasUsageAccess] = useState(false);
  const [hasOverlayAccess, setHasOverlayAccess] = useState(false);
  const [isIgnoringBatteryOptimizations, setIsIgnoringBatteryOptimizations] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [isCheckingOverlay, setIsCheckingOverlay] = useState(false);
  const [isCheckingBattery, setIsCheckingBattery] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);

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

  const totalTrackedMs = useMemo(() => {
    return selectedPackageNames.reduce((total, packageName) => {
      return total + (usageByPackage[packageName]?.totalTimeMs ?? 0);
    }, 0);
  }, [selectedPackageNames, usageByPackage]);

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

  const refreshOverlayAccess = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return false;
    }

    setIsCheckingOverlay(true);
    try {
      const nextHasOverlayAccess = await UsageStatsModule.hasOverlayPermission();
      setHasOverlayAccess(nextHasOverlayAccess);
      return nextHasOverlayAccess;
    } catch {
      return false;
    } finally {
      setIsCheckingOverlay(false);
    }
  }, []);

  async function openOverlaySettings() {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return;
    }
    await UsageStatsModule.requestOverlayPermission();
  }

  const refreshBatteryAccess = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return false;
    }

    setIsCheckingBattery(true);
    try {
      const nextHasBatteryAccess = await UsageStatsModule.isIgnoringBatteryOptimizations();
      setIsIgnoringBatteryOptimizations(nextHasBatteryAccess);
      return nextHasBatteryAccess;
    } catch {
      return false;
    } finally {
      setIsCheckingBattery(false);
    }
  }, []);

  async function openBatterySettings() {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return;
    }
    await UsageStatsModule.requestIgnoreBatteryOptimizations();
  }

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
    if (hasUsageAccess && hasOverlayAccess && step === 'dashboard') {
      UsageStatsModule?.startWatchdogService().catch(() => undefined);
    }
  }, [hasUsageAccess, hasOverlayAccess, step]);

  React.useEffect(() => {
    refreshUsageAccess();
    refreshOverlayAccess();
    refreshBatteryAccess();
    loadInstalledApps();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshUsageAccess();
        refreshOverlayAccess();
        refreshBatteryAccess();
        loadInstalledApps();
      }
    });

    return () => subscription.remove();
  }, [loadInstalledApps, refreshUsageAccess, refreshOverlayAccess, refreshBatteryAccess]);

  React.useEffect(() => {
    if (hasUsageAccess) {
      refreshUsageStats();
    }
  }, [hasUsageAccess, refreshUsageStats]);

  React.useEffect(() => {
    if (step === 'battery' && isIgnoringBatteryOptimizations) {
      setStep('overlay');
    }
  }, [isIgnoringBatteryOptimizations, step]);

  React.useEffect(() => {
    if (step === 'overlay' && hasOverlayAccess) {
      setStep('permission');
    }
  }, [hasOverlayAccess, step]);

  React.useEffect(() => {
    if (step === 'permission' && hasUsageAccess) {
      setStep('apps');
    }
  }, [hasUsageAccess, step]);

  function renderContent() {
    if (step === 'onboarding') {
      return (
        <IntroScreen
          onContinue={() => setStep('battery')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSkipToDashboard={() => setStep('dashboard')}
        />
      );
    }

    if (step === 'battery') {
      return (
        <BatteryOptimizationScreen
          isIgnoringBatteryOptimizations={isIgnoringBatteryOptimizations}
          isCheckingAccess={isCheckingBattery}
          onOpenSettings={openBatterySettings}
          onOpenSettingsMenu={() => setIsSettingsOpen(true)}
        />
      );
    }

    if (step === 'overlay') {
      return (
        <OverlayPermissionScreen
          hasOverlayAccess={hasOverlayAccess}
          isCheckingAccess={isCheckingOverlay}
          onOpenSettings={openOverlaySettings}
          onOpenSettingsMenu={() => setIsSettingsOpen(true)}
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
          onContinue={() => setStep('recordings')}
        />
      );
    }

    if (step === 'recordings') {
      return (
        <VoiceRecordingScreen
          onContinue={() => setStep('dashboard')}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      );
    }

    return (
      <DashboardScreen
        availableApps={availableApps}
        hasUsageAccess={hasUsageAccess}
        totalTrackedMs={totalTrackedMs}
        usageByPackage={usageByPackage}
        usageError={usageError}
        onEditApps={() => setStep('apps')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={refreshUsageStats}
      />
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.appShell}>{renderContent()}</View>
      <SettingsPanel
        isVisible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onEditRecordings={() => setStep('recordings')}
      />
    </View>
  );
}

export default App;
