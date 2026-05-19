import React, {useMemo} from 'react';
import {Pressable, Text, View, Image} from 'react-native';
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
  getDailyLimitSetting,
  getUsageStatusText,
} from '../../utils/dailyLimits';
import {formatDuration} from '../../utils/duration';

export function DashboardScreen({
  availableApps,
  hasUsageAccess,
  totalTrackedMs,
  usageByPackage,
  usageError,
  onEditApps,
  onOpenSettings,
  onRefresh,
}: {
  availableApps: TrackableApp[];
  hasUsageAccess: boolean;
  totalTrackedMs: number;
  usageByPackage: Record<string, UsageStat>;
  usageError: string | null;
  onEditApps: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  const {styles, t} = useAppTheme();
  const {
    selectedPackageNames,
    dailyLimitSettings,
    updateDailyLimitSetting,
    globalDailyLimit,
    setGlobalDailyLimit,
  } = useSettings();

  const nextLowerGlobal = clampLimitMinutes(globalDailyLimit - LIMIT_STEP_MINUTES);
  const nextHigherGlobal = clampLimitMinutes(globalDailyLimit + LIMIT_STEP_MINUTES);

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
  const hasMissingApps = dashboardItems.some(item => !item.isInstalled);

  return (
    <ScreenScaffold
      eyebrow={t('dashboard')}
      title={t('dashboardTitle')}
      body={t('dashboardBody')}
      onOpenSettings={onOpenSettings}>
      <View style={styles.metricPanel}>
        <Text style={styles.metricNumber}>{formatDuration(totalTrackedMs)}</Text>
        <Text style={styles.metricLabel}>{t('trackedToday')}</Text>
      </View>

      <View style={styles.usageCard}>
        <View style={styles.limitTextGroup}>
          <Text style={styles.limitTitle}>Collective Daily Limit</Text>
          <Text style={styles.limitSubtitle}>
            Voice notes will play after {globalDailyLimit} minutes of total distracting app usage.
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
            {globalDailyLimit}
            {t('minutesShort')}
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

      {selectedPackageNames.length === 0 ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t('trackedApps')}</Text>
          <Text style={styles.noticeText}>{t('dashboardEmpty')}</Text>
        </View>
      ) : null}

      {hasMissingApps ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t('notInstalled')}</Text>
          <Text style={styles.noticeText}>{t('selectedAppsMissing')}</Text>
        </View>
      ) : null}

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
        {dashboardItems.map(item => {
          const limitSetting = getDailyLimitSetting(
            dailyLimitSettings,
            item.packageName,
          );
          const nextLowerLimit = clampLimitMinutes(
            limitSetting.limitMinutes - LIMIT_STEP_MINUTES,
          );
          const nextHigherLimit = clampLimitMinutes(
            limitSetting.limitMinutes + LIMIT_STEP_MINUTES,
          );

          return (
            <View key={item.packageName} style={styles.usageCard}>
              <View style={styles.usageRowTop}>
                <View
                  style={[
                    styles.appIconSmall,
                    {backgroundColor: item.app?.accent ?? '#64748B'},
                  ]}>
                  {item.app?.icon ? (
                    <Image
                      source={{uri: `data:image/png;base64,${item.app.icon}`}}
                      style={{width: '100%', height: '100%', borderRadius: 8}}
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
                    {getUsageStatusText(item, limitSetting, t)}
                  </Text>
                </View>
                <Text style={styles.usageTime}>{formatDuration(item.usageMs)}</Text>
              </View>

              {item.isInstalled ? (
                <View style={styles.limitControls}>
                  <View style={styles.limitTextGroup}>
                    <Text style={styles.limitTitle}>{t('dailyLimit')}</Text>
                    <Text style={styles.limitSubtitle}>
                      {limitSetting.mode === 'warn'
                        ? `${t('warnAfter')} ${limitSetting.limitMinutes}${t(
                            'minutesShort',
                          )}`
                        : t('trackOnly')}
                    </Text>
                  </View>
                  <View style={styles.limitActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        onUpdateDailyLimitSetting(item.packageName, {
                          ...limitSetting,
                          mode: 'track',
                        })
                      }
                      style={[
                        styles.limitChip,
                        limitSetting.mode === 'track' && styles.limitChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.limitChipText,
                          limitSetting.mode === 'track' &&
                            styles.limitChipTextSelected,
                        ]}>
                        {t('trackOnly')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        onUpdateDailyLimitSetting(item.packageName, {
                          ...limitSetting,
                          mode: 'warn',
                        })
                      }
                      style={[
                        styles.limitChip,
                        limitSetting.mode === 'warn' && styles.limitChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.limitChipText,
                          limitSetting.mode === 'warn' &&
                            styles.limitChipTextSelected,
                        ]}>
                        {t('warnAfter')}
                      </Text>
                    </Pressable>
                  </View>

                  {limitSetting.mode === 'warn' ? (
                    <View style={styles.limitStepper}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={nextLowerLimit === limitSetting.limitMinutes}
                        onPress={() =>
                          onUpdateDailyLimitSetting(item.packageName, {
                            ...limitSetting,
                            limitMinutes: nextLowerLimit,
                          })
                        }
                        style={styles.limitStepButton}>
                        <Text style={styles.limitStepText}>-</Text>
                      </Pressable>
                      <Text style={styles.limitValue}>
                        {limitSetting.limitMinutes}
                        {t('minutesShort')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={nextHigherLimit === limitSetting.limitMinutes}
                        onPress={() =>
                          onUpdateDailyLimitSetting(item.packageName, {
                            ...limitSetting,
                            limitMinutes: nextHigherLimit,
                          })
                        }
                        style={styles.limitStepButton}>
                        <Text style={styles.limitStepText}>+</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}
