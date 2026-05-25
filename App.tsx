import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  StatusBar,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SettingsPanel } from './src/components/common/SettingsPanel';
import { AppSelectionScreen } from './src/components/screens/AppSelectionScreen';
import { DashboardScreen } from './src/components/screens/DashboardScreen';
import { IntroScreen } from './src/components/screens/IntroScreen';
import { LanguageSelectionScreen } from './src/components/screens/LanguageSelectionScreen';
import { SetupPermissionsScreen } from './src/components/screens/SetupPermissionsScreen';
import { VoiceRecordingScreen } from './src/components/screens/VoiceRecordingScreen';
import { TRANSLATIONS } from './src/locales';
import { UsageStatsModule } from './src/native/modules';
import { AppThemeContext, useAppTheme } from './src/theme/ThemeContext';
import { DARK_COLORS, LIGHT_COLORS } from './src/theme/colors';
import { createThemedStyles } from './src/theme/styles';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import type {
  Step,
  ThemeMode,
  TrackableApp,
  TranslationKey,
  UsageStat,
} from './src/types';
import { FALLBACK_TRACKABLE_APPS, toTrackableApp } from './src/utils/apps';

function App() {
  return (
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  );
}

function ThemedApp() {
  const { themePreference, language, setLanguage, setThemePreference } =
    useSettings();
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
  const { colors, styles, t } = useAppTheme();
  const {
    selectedPackageNames,
    setLanguage,
    isLoadingPreferences,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
  } = useSettings();
  const [step, setStep] = useState<Step>('language');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableApps, setAvailableApps] = useState<TrackableApp[]>(
    FALLBACK_TRACKABLE_APPS,
  );
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [hasUsageAccess, setHasUsageAccess] = useState(false);
  const [hasOverlayAccess, setHasOverlayAccess] = useState(false);
  const [hasNotificationAccess, setHasNotificationAccess] = useState(false);
  const [hasMicrophoneAccess, setHasMicrophoneAccess] = useState(false);
  const [_isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);

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

  const hasAllOnboardingPermissions =
    hasUsageAccess && hasOverlayAccess && hasMicrophoneAccess;
  const visibleStep =
    hasCompletedOnboarding && step === 'language' ? 'dashboard' : step;
  const onboardingStepIndex = getOnboardingStepIndex(visibleStep);

  async function openUsageAccessSettings() {
    if (Platform.OS !== 'android') {
      Alert.alert(t('androidOnlyTitle'), t('androidOnlyBody'));
      return;
    }

    try {
      await UsageStatsModule?.requestUsageAccessPermission();
    } catch {
      Alert.alert(t('appName'), t('unableToCheckAccess'));
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

    try {
      const nextHasOverlayAccess =
        await UsageStatsModule.hasOverlayPermission();
      setHasOverlayAccess(nextHasOverlayAccess);
      return nextHasOverlayAccess;
    } catch {
      return false;
    }
  }, []);

  const refreshNotificationAccess = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageStatsModule) return false;
    try {
      const granted = await UsageStatsModule.hasNotificationPermission();
      setHasNotificationAccess(granted);
      return granted;
    } catch {
      return false;
    }
  }, []);

  const refreshMicrophoneAccess = React.useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      setHasMicrophoneAccess(granted);
      return granted;
    } catch {
      return false;
    }
  }, []);

  const requestMicrophoneAccess = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      refreshMicrophoneAccess();
    } catch (err) {
      console.warn(err);
    }
  };

  const requestNotificationAccess = async () => {
    if (Platform.OS !== 'android') return;
    try {
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as any,
        );
      }
      refreshNotificationAccess();
    } catch (err) {
      console.warn(err);
    }
  };

  async function openOverlaySettings() {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return;
    }
    await UsageStatsModule.requestOverlayPermission();
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
    refreshNotificationAccess();
    refreshMicrophoneAccess();
    loadInstalledApps();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshUsageAccess();
        refreshOverlayAccess();
        refreshNotificationAccess();
        refreshMicrophoneAccess();
        loadInstalledApps();
      }
    });

    return () => subscription.remove();
  }, [
    loadInstalledApps,
    refreshUsageAccess,
    refreshOverlayAccess,
    refreshNotificationAccess,
    refreshMicrophoneAccess,
  ]);

  React.useEffect(() => {
    if (hasUsageAccess) {
      refreshUsageStats();
    }
  }, [hasUsageAccess, refreshUsageStats]);

  React.useEffect(() => {
    if (hasCompletedOnboarding) {
      setStep('dashboard');
    }
  }, [hasCompletedOnboarding]);

  function renderContent() {
    if (visibleStep === 'language') {
      return (
        <LanguageSelectionScreen
          onSelect={lang => {
            setLanguage(lang);
            setStep('onboarding');
          }}
        />
      );
    }

    if (visibleStep === 'onboarding') {
      return (
        <IntroScreen
          onContinue={() => setStep('setup_permissions')}
          onBack={() => setStep('language')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          hideHeader={!hasCompletedOnboarding}
        />
      );
    }

    if (visibleStep === 'recordings') {
      return (
        <VoiceRecordingScreen
          onContinue={() =>
            setStep(hasCompletedOnboarding ? 'dashboard' : 'apps')
          }
          onBack={() =>
            setStep(hasCompletedOnboarding ? 'dashboard' : 'setup_permissions')
          }
          onOpenSettings={() => setIsSettingsOpen(true)}
          hideHeader={!hasCompletedOnboarding}
        />
      );
    }

    if (visibleStep === 'apps') {
      return (
        <AppSelectionScreen
          availableApps={availableApps}
          isLoadingApps={isLoadingApps}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onBack={() =>
            setStep(hasCompletedOnboarding ? 'dashboard' : 'recordings')
          }
          onContinue={() => {
            setHasCompletedOnboarding(true);
            setStep('dashboard');
          }}
          hideHeader={!hasCompletedOnboarding}
        />
      );
    }

    if (visibleStep === 'setup_permissions') {
      return (
        <SetupPermissionsScreen
          hasUsageAccess={hasUsageAccess}
          hasOverlayAccess={hasOverlayAccess}
          hasNotificationAccess={hasNotificationAccess}
          hasMicrophoneAccess={hasMicrophoneAccess}
          onOpenUsageSettings={openUsageAccessSettings}
          onOpenOverlaySettings={openOverlaySettings}
          requestMicrophone={requestMicrophoneAccess}
          requestNotifications={requestNotificationAccess}
          onOpenSettingsMenu={() => setIsSettingsOpen(true)}
          onBack={() =>
            setStep(hasCompletedOnboarding ? 'dashboard' : 'onboarding')
          }
          onContinue={() => {
            if (!hasAllOnboardingPermissions) {
              return;
            }
            setStep(hasCompletedOnboarding ? 'dashboard' : 'recordings');
          }}
          hideHeader={!hasCompletedOnboarding}
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

  if (isLoadingPreferences) {
    return (
      <View style={[styles.safeArea, localStyles.loadingScreen]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[localStyles.loadingTitle, { color: colors.text }]}>
          {t('appName')}
        </Text>
        <Text style={[localStyles.loadingBody, { color: colors.mutedText }]}>
          {t('loadingPreferencesLabel')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      {!hasCompletedOnboarding && onboardingStepIndex !== null && (
        <OnboardingProgressBar
          activeStepIndex={onboardingStepIndex}
          segmentColor={colors.primary}
          trackColor={colors.border}
        />
      )}
      <View style={styles.appShell}>{renderContent()}</View>
      <SettingsPanel
        isVisible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onEditRecordings={() => setStep('recordings')}
        onManagePermissions={() => setStep('setup_permissions')}
      />
    </View>
  );
}

const ONBOARDING_STEPS: Step[] = [
  'language',
  'onboarding',
  'setup_permissions',
  'recordings',
  'apps',
];

function getOnboardingStepIndex(step: Step) {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index === -1 ? null : index;
}

function OnboardingProgressBar({
  activeStepIndex,
  segmentColor,
  trackColor,
}: {
  activeStepIndex: number;
  segmentColor: string;
  trackColor: string;
}) {
  const topOffset =
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

  return (
    <View
      style={[localStyles.progressBarContainer, { paddingTop: topOffset + 3 }]}
      accessibilityRole="progressbar"
    >
      {ONBOARDING_STEPS.map((progressStep, index) => (
        <View
          key={progressStep}
          style={[
            localStyles.progressSegment,
            {
              backgroundColor:
                index <= activeStepIndex ? segmentColor : trackColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  loadingBody: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  progressBarContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    marginBottom: 7,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
});

export default App;
