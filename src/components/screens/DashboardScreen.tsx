import React, {useMemo} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import type {
  TrackableApp,
  UsageStat,
} from '../../types';
import {
  LIMIT_STEP_MINUTES,
  clampLimitMinutes,
  getUsageStatusText,
} from '../../utils/dailyLimits';
import {formatDuration} from '../../utils/duration';

export function DashboardScreen({
  availableApps,
  hasUsageAccess,
  totalTrackedMs,
  dailyAnalytics,
  usageByPackage,
  usageError,
  onEditApps,
  onOpenSettings,
  onRefresh,
}: {
  availableApps: TrackableApp[];
  hasUsageAccess: boolean;
  totalTrackedMs: number;
  dailyAnalytics: string;
  usageByPackage: Record<string, UsageStat>;
  usageError: string | null;
  onEditApps: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  const {colors, styles, t} = useAppTheme();
  const {
    selectedPackageNames,
    globalDailyLimit,
    setGlobalDailyLimit,
  } = useSettings();

  const nextLowerGlobal = clampLimitMinutes(globalDailyLimit - LIMIT_STEP_MINUTES);
  const nextHigherGlobal = clampLimitMinutes(globalDailyLimit + LIMIT_STEP_MINUTES);
  const todayAnalytics = useMemo(
    () => parseTodayAnalytics(dailyAnalytics, globalDailyLimit, totalTrackedMs),
    [dailyAnalytics, globalDailyLimit, totalTrackedMs],
  );

  const installedPackageNames = useMemo(
    () => new Set(availableApps.map(app => app.packageName)),
    [availableApps],
  );

  const dashboardItems = useMemo(() => {
    return selectedPackageNames
      .map(packageName => {
        const app = availableApps.find(
          availableApp => availableApp.packageName === packageName,
        );
        const usageMs = usageByPackage[packageName]?.totalTimeMs ?? 0;

        return {
          app,
          packageName,
          usageMs,
          isInstalled: installedPackageNames.has(packageName),
        };
      })
      .sort((first, second) => {
        if (first.isInstalled !== second.isInstalled) {
          return first.isInstalled ? -1 : 1;
        }
        return second.usageMs - first.usageMs;
      });
  }, [availableApps, installedPackageNames, selectedPackageNames, usageByPackage]);

  return (
    <ScreenScaffold
      eyebrow={t('dashboard')}
      title={t('dashboardTitle')}
      body={t('dashboardBody')}
      onOpenSettings={onOpenSettings}>

      <View style={[styles.metricPanel, {backgroundColor: colors.metricBackground}]}>
        <Text style={[styles.metricNumber, {color: colors.metricText}]}>{formatDuration(totalTrackedMs)}</Text>
        <Text style={[styles.metricLabel, {color: colors.metricLabel}]}>{t('trackedToday')}</Text>
      </View>

      <View style={localStyles.insightGrid}>
        <View style={[localStyles.insightTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.insightValue, {color: colors.text}]}>
            {todayAnalytics.currentStreak}
          </Text>
          <Text style={[localStyles.insightLabel, {color: colors.subtleText}]}>
            {t('currentStreakLabel')}
          </Text>
        </View>
        <View style={[localStyles.insightTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text
            style={[
              localStyles.insightValue,
              {color: todayAnalytics.stayedUnderLimit ? colors.success : colors.noticeTitle},
            ]}>
            {todayAnalytics.stayedUnderLimit ? '✓' : '!'}
          </Text>
          <Text style={[localStyles.insightLabel, {color: colors.subtleText}]}>
            {todayAnalytics.stayedUnderLimit
              ? t('underLimitTodayLabel')
              : t('overLimitTodayLabel')}
          </Text>
        </View>
        <View style={[localStyles.insightTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.insightValue, {color: colors.text}]}>
            {todayAnalytics.voiceNoteInterventions}
          </Text>
          <Text style={[localStyles.insightLabel, {color: colors.subtleText}]}>
            {t('voiceInterventionsLabel')}
          </Text>
        </View>
      </View>

      <View style={[styles.usageCard, localStyles.limitCard]}>
        <View style={styles.limitTextGroup}>
          <Text style={styles.limitTitle}>Collective Daily Limit</Text>
          <Text style={styles.limitSubtitle}>
            Voice notes play after {globalDailyLimit}m of total usage.
          </Text>
        </View>
        <View style={styles.limitStepper}>
          <Pressable
            accessibilityRole="button"
            disabled={nextLowerGlobal === globalDailyLimit}
            onPress={() => setGlobalDailyLimit(nextLowerGlobal)}
            style={styles.limitStepButton}>
            <Text style={styles.limitStepText}>-</Text>
          </Pressable>
          <Text style={styles.limitValue}>
            {globalDailyLimit}m
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={nextHigherGlobal === globalDailyLimit}
            onPress={() => setGlobalDailyLimit(nextHigherGlobal)}
            style={styles.limitStepButton}>
            <Text style={styles.limitStepText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dashboardHeader}>
        <Text style={styles.sectionTitle}>{t('trackedApps')}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onRefresh}>
            <Text style={styles.linkText}>{t('refresh')}</Text>
          </Pressable>
          <Pressable onPress={onEditApps}>
            <Text style={styles.linkText}>{t('edit')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.appList}>
        {dashboardItems.map(item => (
          <View key={item.packageName} style={styles.usageCard}>
            <View style={styles.usageRowTop}>
              <View
                style={[
                  styles.appIconSmall,
                  {backgroundColor: item.app?.accent ?? colors.surfaceAlt},
                ]}>
                {item.app?.icon ? (
                  <Image
                    source={{uri: `data:image/png;base64,${item.app.icon}`}}
                    style={{width: '100%', height: '100%', borderRadius: 10}}
                  />
                ) : (
                  <Text style={styles.appIconTextSmall}>
                    {(item.app?.name ?? '?').charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.usageTextGroup}>
                <Text style={styles.usageName}>
                  {item.app?.name ?? item.packageName}
                </Text>
                <Text style={styles.usageStatus}>
                  {getUsageStatusText(item, t)}
                </Text>
              </View>
              <Text style={styles.usageTime}>{formatDuration(item.usageMs)}</Text>
            </View>
          </View>
        ))}
      </View>

      {!hasUsageAccess || usageError ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>
            {hasUsageAccess ? t('usageStatsUnavailable') : t('usageAccessNeeded')}
          </Text>
          <Text style={styles.noticeText}>
            {usageError ?? t('enableUsageAccessBody')}
          </Text>
        </View>
      ) : null}

    </ScreenScaffold>
  );
}

type TodayAnalytics = {
  currentStreak: number;
  stayedUnderLimit: boolean;
  voiceNoteInterventions: number;
};

function parseTodayAnalytics(
  dailyAnalytics: string,
  globalDailyLimit: number,
  totalTrackedMs: number,
): TodayAnalytics {
  const fallbackStayedUnderLimit = totalTrackedMs < globalDailyLimit * 60000;

  try {
    const parsed = JSON.parse(dailyAnalytics || '{}') as {
      currentStreak?: unknown;
      daily?: Record<string, {
        stayedUnderDailyLimit?: unknown;
        voiceNoteInterventions?: unknown;
      }>;
    };
    const today = parsed.daily?.[todayKey()];
    const currentStreak =
      typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0;
    const stayedUnderLimit =
      typeof today?.stayedUnderDailyLimit === 'boolean'
        ? today.stayedUnderDailyLimit
        : fallbackStayedUnderLimit;
    const voiceNoteInterventions =
      typeof today?.voiceNoteInterventions === 'number'
        ? today.voiceNoteInterventions
        : 0;

    return {
      currentStreak,
      stayedUnderLimit,
      voiceNoteInterventions,
    };
  } catch {
    return {
      currentStreak: 0,
      stayedUnderLimit: fallbackStayedUnderLimit,
      voiceNoteInterventions: 0,
    };
  }
}

function todayKey() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

const localStyles = StyleSheet.create({
    insightGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
    },
    insightTile: {
        borderRadius: 16,
        borderWidth: 1,
        flex: 1,
        minHeight: 92,
        paddingHorizontal: 10,
        paddingVertical: 14,
    },
    insightValue: {
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 6,
        textAlign: 'center',
    },
    insightLabel: {
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
        textAlign: 'center',
    },
    limitCard: {
        marginBottom: 32,
        padding: 20,
    }
});
