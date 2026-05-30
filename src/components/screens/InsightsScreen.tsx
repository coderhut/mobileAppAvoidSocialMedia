import React, {useMemo, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import {formatDuration} from '../../utils/duration';

type DayInsight = {
  dateKey: string;
  dayLabel: string;
  totalTrackedMs: number;
  dailyLimitMinutes: number;
  stayedUnderLimit: boolean;
};

type InsightTab = 'week' | 'month' | 'all_time';

type AnalyticsSnapshot = {
  daily: Record<string, Record<string, unknown>>;
  monthlySummaries: Record<string, Record<string, unknown>>;
  currentStreak: number;
  longestStreak: number;
  bestUsageDay: UsageDaySummary | null;
  worstUsageDay: UsageDaySummary | null;
};

type UsageDaySummary = {
  date: string;
  totalTrackedMs: number;
  dailyLimitMinutes: number;
};

type MonthDayInsight = {
  dateKey: string;
  dayNumber: number;
  totalTrackedMs: number | null;
  stayedUnderLimit: boolean;
  dailyLimitMinutes: number;
  limitHits: number;
  voiceNoteInterventions: number;
  lastInterventionLevel: number | null;
  lastInterventionPackage: string | null;
  perAppUsageMs: Record<string, number>;
};

export function InsightsScreen({
  dailyAnalytics,
  onGoHome,
  onOpenSettings,
  onRefresh,
}: {
  dailyAnalytics: string;
  onGoHome: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  const {colors, styles, t} = useAppTheme();
  const {globalDailyLimit} = useSettings();
  const [activeTab, setActiveTab] = useState<InsightTab>('week');
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey());
  const analytics = useMemo(() => parseAnalytics(dailyAnalytics), [dailyAnalytics]);
  const week = useMemo(
    () => buildWeekInsights(analytics.daily, globalDailyLimit),
    [analytics.daily, globalDailyLimit],
  );
  const month = useMemo(
    () => buildMonthInsights(analytics, globalDailyLimit, selectedMonthKey),
    [analytics, globalDailyLimit, selectedMonthKey],
  );
  const allTime = useMemo(() => buildAllTimeInsights(analytics), [analytics]);
  const maxTrackedMs = Math.max(
    ...week.days.map(day => day.totalTrackedMs),
    globalDailyLimit * 60000,
    1,
  );

  return (
    <ScreenScaffold
      eyebrow={t('insights')}
      headerTitle={t('insights')}
      title={
        activeTab === 'week'
          ? t('weeklyInsightsTitle')
          : activeTab === 'month'
          ? t('monthlyInsightsTitle')
          : t('allTimeInsightsTitle')
      }
      body={
        activeTab === 'week'
          ? t('weeklyInsightsBody')
          : activeTab === 'month'
          ? t('monthlyInsightsBody')
          : t('allTimeInsightsBody')
      }
      onGoHome={onGoHome}
      onOpenSettings={onOpenSettings}
      fixedHeader>
      <View style={[localStyles.segmentedControl, {backgroundColor: colors.surfaceAlt}]}>
        {(['week', 'month', 'all_time'] as InsightTab[]).map(tab => {
          const isSelected = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
              onPress={() => setActiveTab(tab)}
              style={[
                localStyles.segmentButton,
                isSelected && {backgroundColor: colors.primary},
              ]}>
              <Text
                style={[
                  localStyles.segmentText,
                  {color: isSelected ? colors.primaryText : colors.mutedText},
                ]}>
                {tab === 'week'
                  ? t('weekTabLabel')
                  : tab === 'month'
                  ? t('monthTabLabel')
                  : t('allTimeTabLabel')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'week' ? (
        <WeekInsightsView
          week={week}
          maxTrackedMs={maxTrackedMs}
          globalDailyLimit={globalDailyLimit}
          onRefresh={onRefresh}
        />
      ) : activeTab === 'month' ? (
        <MonthInsightsView
          month={month}
          onNextMonth={() => setSelectedMonthKey(addMonths(selectedMonthKey, 1))}
          onPreviousMonth={() => setSelectedMonthKey(addMonths(selectedMonthKey, -1))}
          onRefresh={onRefresh}
        />
      ) : (
        <AllTimeInsightsView allTime={allTime} onRefresh={onRefresh} />
      )}
    </ScreenScaffold>
  );
}

function WeekInsightsView({
  week,
  maxTrackedMs,
  globalDailyLimit,
  onRefresh,
}: {
  week: ReturnType<typeof buildWeekInsights>;
  maxTrackedMs: number;
  globalDailyLimit: number;
  onRefresh: () => void;
}) {
  const {colors, styles, t} = useAppTheme();

  return (
    <>
      <View style={[localStyles.summaryRow]}>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {formatDuration(week.totalTrackedMs)}
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('weekTotalLabel')}
          </Text>
        </View>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {week.daysUnderLimit}/7
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('daysUnderLimitLabel')}
          </Text>
        </View>
      </View>

      <View style={[styles.usageCard, localStyles.chartCard]}>
        <View style={localStyles.chartHeader}>
          <Text style={styles.sectionTitle}>{t('insights')}</Text>
          <Pressable accessibilityRole="button" onPress={onRefresh}>
            <Text style={styles.linkText}>{t('refresh')}</Text>
          </Pressable>
        </View>

        {week.hasAnyData ? (
          <>
            <View style={localStyles.limitLegend}>
              <View style={[localStyles.limitLineSample, {backgroundColor: colors.primary}]} />
              <Text style={[localStyles.limitLegendText, {color: colors.subtleText}]}>
                {t('dailyLimitLineLabel')}: {globalDailyLimit}m
              </Text>
            </View>

            <View style={localStyles.barChart}>
              {week.days.map(day => {
                const barHeight = Math.max(
                  day.totalTrackedMs > 0 ? 8 : 2,
                  (day.totalTrackedMs / maxTrackedMs) * 150,
                );
                const limitOffset = Math.min(
                  150,
                  (day.dailyLimitMinutes * 60000 / maxTrackedMs) * 150,
                );

                return (
                  <View key={day.dateKey} style={localStyles.dayColumn}>
                    <View style={localStyles.barTrack}>
                      <View
                        style={[
                          localStyles.limitMarker,
                          {
                            backgroundColor: colors.primary,
                            bottom: limitOffset,
                          },
                        ]}
                      />
                      <View
                        style={[
                          localStyles.usageBar,
                          {
                            backgroundColor: day.stayedUnderLimit
                              ? colors.success
                              : colors.noticeTitle,
                            height: barHeight,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[localStyles.dayLabel, {color: colors.subtleText}]}>
                      {day.dayLabel}
                    </Text>
                    <Text style={[localStyles.dayUsage, {color: colors.mutedText}]}>
                      {formatDuration(day.totalTrackedMs)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={[localStyles.emptyBox, {backgroundColor: colors.surfaceAlt}]}>
            <Text style={[localStyles.emptyText, {color: colors.mutedText}]}>
              {t('noInsightsYetLabel')}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function MonthInsightsView({
  month,
  onNextMonth,
  onPreviousMonth,
  onRefresh,
}: {
  month: ReturnType<typeof buildMonthInsights>;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRefresh: () => void;
}) {
  const {colors, styles, t} = useAppTheme();
  const [selectedDay, setSelectedDay] = useState<MonthDayInsight | null>(null);

  return (
    <>
      <View style={localStyles.summaryRow}>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {formatDuration(month.totalTrackedMs)}
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('monthTotalLabel')}
          </Text>
        </View>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {month.daysUnderLimit}/{month.daysTracked}
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('daysUnderLimitLabel')}
          </Text>
        </View>
      </View>

      <View style={[styles.usageCard, localStyles.chartCard]}>
        <View style={localStyles.chartHeader}>
          <View style={localStyles.monthNav}>
            <Pressable
              accessibilityRole="button"
              onPress={onPreviousMonth}
              style={[localStyles.monthNavButton, {backgroundColor: colors.surfaceAlt}]}>
              <Text style={[localStyles.monthNavText, {color: colors.text}]}>
                {'<'}
              </Text>
            </Pressable>
            <Text style={[styles.sectionTitle, localStyles.monthTitle]}>
              {month.monthLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={month.isCurrentMonth}
              onPress={onNextMonth}
              style={[
                localStyles.monthNavButton,
                {
                  backgroundColor: colors.surfaceAlt,
                  opacity: month.isCurrentMonth ? 0.35 : 1,
                },
              ]}>
              <Text style={[localStyles.monthNavText, {color: colors.text}]}>
                {'>'}
              </Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={onRefresh}>
            <Text style={styles.linkText}>{t('refresh')}</Text>
          </Pressable>
        </View>

        {month.isSummaryOnly ? (
          <View style={[localStyles.emptyBox, {backgroundColor: colors.surfaceAlt}]}>
            <Text style={[localStyles.emptyText, {color: colors.mutedText}]}>
              {t('summaryOnlyMonthLabel')}
            </Text>
          </View>
        ) : (
          <View style={localStyles.calendarGrid}>
            {month.days.map(day => (
              <Pressable
                key={day.dateKey}
                accessibilityRole="button"
                onPress={() => setSelectedDay(day)}
                style={[
                  localStyles.calendarCell,
                  {
                    backgroundColor:
                      day.totalTrackedMs === null
                        ? colors.surfaceAlt
                        : day.stayedUnderLimit
                        ? colors.success
                        : colors.noticeTitle,
                  },
                ]}>
                <Text
                  style={[
                    localStyles.calendarDay,
                    {
                      color:
                        day.totalTrackedMs === null
                          ? colors.subtleText
                          : colors.primaryText,
                    },
                  ]}>
                  {day.dayNumber}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[localStyles.monthFooter, {borderTopColor: colors.border}]}>
          <Text style={[localStyles.limitLegendText, {color: colors.subtleText}]}>
            {t('voiceNotesMonthLabel')}: {month.voiceNoteInterventions}
          </Text>
          {month.topInterventionApp ? (
            <Text style={[localStyles.limitLegendText, {color: colors.subtleText}]}>
              {t('topInterventionAppLabel')}: {month.topInterventionApp}
            </Text>
          ) : null}
        </View>
      </View>
      <DayDetailsSheet
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
    </>
  );
}

function DayDetailsSheet({
  day,
  onClose,
}: {
  day: MonthDayInsight | null;
  onClose: () => void;
}) {
  const {colors, styles, t} = useAppTheme();
  const appRows = day ? sortedPerAppUsage(day.perAppUsageMs) : [];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={day !== null}>
      <View style={localStyles.daySheetOverlay}>
        <Pressable style={localStyles.daySheetBackdrop} onPress={onClose} />
        <View style={[localStyles.daySheet, {backgroundColor: colors.background, borderColor: colors.border}]}>
          <View style={styles.bottomSheetHandle} />
          <View style={styles.settingsHeader}>
            <View style={localStyles.recordTextGroup}>
              <Text style={styles.settingsTitle}>{t('dayDetailsLabel')}</Text>
              {day ? (
                <Text style={[localStyles.recordMeta, {color: colors.mutedText}]}>
                  {formatFriendlyDate(day.dateKey)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </Pressable>
          </View>

          {day ? (
            <>
              <View style={localStyles.detailGrid}>
                <DetailTile
                  label={t('totalUsageLabel')}
                  value={formatDuration(day.totalTrackedMs ?? 0)}
                />
                <DetailTile
                  label={t('usageStatusLabel')}
                  value={
                    day.stayedUnderLimit
                      ? t('underLimitTodayLabel')
                      : t('overLimitTodayLabel')
                  }
                />
                <DetailTile
                  label={t('limitHitsLabel')}
                  value={String(day.limitHits)}
                />
                <DetailTile
                  label={t('voiceInterventionsLabel')}
                  value={String(day.voiceNoteInterventions)}
                />
              </View>

              {day.lastInterventionPackage ? (
                <Text style={[localStyles.detailNote, {color: colors.mutedText}]}>
                  {t('topInterventionAppLabel')}: {shortPackageName(day.lastInterventionPackage)}
                  {day.lastInterventionLevel ? ` · L${day.lastInterventionLevel}` : ''}
                </Text>
              ) : null}

              <Text style={[styles.sectionTitle, localStyles.detailsSectionTitle]}>
                {t('perAppUsageLabel')}
              </Text>
              {appRows.length > 0 ? (
                appRows.map(([packageName, usageMs]) => (
                  <View
                    key={packageName}
                    style={[localStyles.perAppRow, {backgroundColor: colors.surfaceAlt}]}>
                    <Text style={[localStyles.perAppName, {color: colors.text}]}>
                      {shortPackageName(packageName)}
                    </Text>
                    <Text style={[localStyles.perAppTime, {color: colors.mutedText}]}>
                      {formatDuration(usageMs)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[localStyles.emptyText, {color: colors.mutedText}]}>
                  {t('noUsageRecordedLabel')}
                </Text>
              )}
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DetailTile({label, value}: {label: string; value: string}) {
  const {colors} = useAppTheme();

  return (
    <View style={[localStyles.detailTile, {backgroundColor: colors.surface}]}>
      <Text style={[localStyles.detailValue, {color: colors.text}]}>
        {value}
      </Text>
      <Text style={[localStyles.detailLabel, {color: colors.subtleText}]}>
        {label}
      </Text>
    </View>
  );
}

function AllTimeInsightsView({
  allTime,
  onRefresh,
}: {
  allTime: ReturnType<typeof buildAllTimeInsights>;
  onRefresh: () => void;
}) {
  const {colors, styles, t} = useAppTheme();

  return (
    <>
      <View style={localStyles.summaryRow}>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {allTime.currentStreak}
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('currentStreakLabel')}
          </Text>
        </View>
        <View style={[localStyles.summaryTile, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[localStyles.summaryValue, {color: colors.text}]}>
            {allTime.longestStreak}
          </Text>
          <Text style={[localStyles.summaryLabel, {color: colors.subtleText}]}>
            {t('longestStreakLabel')}
          </Text>
        </View>
      </View>

      <View style={[styles.usageCard, localStyles.chartCard]}>
        <View style={localStyles.chartHeader}>
          <Text style={styles.sectionTitle}>{t('allTimeTabLabel')}</Text>
          <Pressable accessibilityRole="button" onPress={onRefresh}>
            <Text style={styles.linkText}>{t('refresh')}</Text>
          </Pressable>
        </View>

        {allTime.bestUsageDay || allTime.worstUsageDay ? (
          <>
            <UsageRecordCard
              label={t('bestUsageDayLabel')}
              record={allTime.bestUsageDay}
            />
            <UsageRecordCard
              label={t('worstUsageDayLabel')}
              record={allTime.worstUsageDay}
            />
          </>
        ) : (
          <View style={[localStyles.emptyBox, {backgroundColor: colors.surfaceAlt}]}>
            <Text style={[localStyles.emptyText, {color: colors.mutedText}]}>
              {t('noAllTimeRecordsLabel')}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function UsageRecordCard({
  label,
  record,
}: {
  label: string;
  record: UsageDaySummary | null;
}) {
  const {colors, t} = useAppTheme();

  if (!record) {
    return null;
  }

  return (
    <View style={[localStyles.recordRow, {backgroundColor: colors.surfaceAlt}]}>
      <View style={localStyles.recordTextGroup}>
        <Text style={[localStyles.recordLabel, {color: colors.subtleText}]}>
          {label}
        </Text>
        <Text style={[localStyles.recordDate, {color: colors.text}]}>
          {formatFriendlyDate(record.date)}
        </Text>
        <Text style={[localStyles.recordMeta, {color: colors.mutedText}]}>
          {t('limitWasLabel')} {record.dailyLimitMinutes}m
        </Text>
      </View>
      <Text style={[localStyles.recordUsage, {color: colors.text}]}>
        {formatDuration(record.totalTrackedMs)}
      </Text>
    </View>
  );
}

function buildWeekInsights(
  daily: Record<string, Record<string, unknown>>,
  fallbackLimitMinutes: number,
) {
  const days = lastSevenDateKeys().map(dateKey => {
    const record = daily[dateKey];
    const totalTrackedMs = numberOrZero(record?.totalTrackedMs);
    const dailyLimitMinutes =
      typeof record?.dailyLimitMinutes === 'number' && record.dailyLimitMinutes > 0
        ? record.dailyLimitMinutes
        : fallbackLimitMinutes;
    const stayedUnderLimit =
      typeof record?.stayedUnderDailyLimit === 'boolean'
        ? record.stayedUnderDailyLimit
        : totalTrackedMs < dailyLimitMinutes * 60000;

    return {
      dateKey,
      dayLabel: shortWeekday(dateKey),
      totalTrackedMs,
      dailyLimitMinutes,
      stayedUnderLimit,
    };
  });

  return {
    days,
    totalTrackedMs: days.reduce((total, day) => total + day.totalTrackedMs, 0),
    daysUnderLimit: days.filter(day => day.stayedUnderLimit).length,
    hasAnyData: days.some(day => day.totalTrackedMs > 0),
  };
}

function buildMonthInsights(
  analytics: AnalyticsSnapshot,
  fallbackLimitMinutes: number,
  monthKey: string,
) {
  const summary = analytics.monthlySummaries[monthKey];
  const monthDateKeys = dateKeysForMonth(monthKey);
  const days = monthDateKeys.map(dateKey => {
    const record = analytics.daily[dateKey];
    if (!record) {
      return {
        dateKey,
        dayNumber: Number(dateKey.slice(-2)),
        totalTrackedMs: null as number | null,
        stayedUnderLimit: true,
        dailyLimitMinutes: fallbackLimitMinutes,
        limitHits: 0,
        voiceNoteInterventions: 0,
        lastInterventionLevel: null,
        lastInterventionPackage: null,
        perAppUsageMs: {},
      };
    }

    const totalTrackedMs = numberOrZero(record.totalTrackedMs);
    const dailyLimitMinutes =
      typeof record.dailyLimitMinutes === 'number' && record.dailyLimitMinutes > 0
        ? record.dailyLimitMinutes
        : fallbackLimitMinutes;

    return {
      dateKey,
      dayNumber: Number(dateKey.slice(-2)),
      totalTrackedMs,
      dailyLimitMinutes,
      stayedUnderLimit:
        typeof record.stayedUnderDailyLimit === 'boolean'
          ? record.stayedUnderDailyLimit
          : totalTrackedMs < dailyLimitMinutes * 60000,
      limitHits: numberOrZero(record.limitHits),
      voiceNoteInterventions: numberOrZero(record.voiceNoteInterventions),
      lastInterventionLevel:
        typeof record.lastInterventionLevel === 'number'
          ? record.lastInterventionLevel
          : null,
      lastInterventionPackage:
        typeof record.lastInterventionPackage === 'string'
          ? record.lastInterventionPackage
          : null,
      perAppUsageMs: parseCountMap(record.perAppUsageMs),
    };
  });
  const hasDetailedData = days.some(day => day.totalTrackedMs !== null);
  const currentDateKey = formatDateKey(new Date());
  const trackedCalendarDays = days.filter(day =>
    monthKey === currentMonthKey()
      ? day.dateKey <= currentDateKey
      : day.dateKey <= lastDateKeyForMonth(monthKey),
  );

  return {
    monthLabel: monthLabel(monthKey),
    days,
    isCurrentMonth: monthKey === currentMonthKey(),
    isSummaryOnly: !hasDetailedData && !!summary,
    totalTrackedMs: hasDetailedData
      ? days.reduce((total, day) => total + (day.totalTrackedMs ?? 0), 0)
      : numberOrZero(summary?.totalTrackedMs),
    daysTracked: hasDetailedData
      ? trackedCalendarDays.length
      : numberOrZero(summary?.daysTracked),
    daysUnderLimit: hasDetailedData
      ? trackedCalendarDays.filter(day => day.stayedUnderLimit).length
      : numberOrZero(summary?.daysUnderLimit),
    voiceNoteInterventions: hasDetailedData
      ? monthDateKeys.reduce(
          (total, dateKey) =>
            total + numberOrZero(analytics.daily[dateKey]?.voiceNoteInterventions),
          0,
        )
      : numberOrZero(summary?.voiceNoteInterventions),
    topInterventionApp: topInterventionAppForMonth(analytics, monthDateKeys, summary),
  };
}

function buildAllTimeInsights(analytics: AnalyticsSnapshot) {
  return {
    currentStreak: analytics.currentStreak,
    longestStreak: analytics.longestStreak,
    bestUsageDay: analytics.bestUsageDay,
    worstUsageDay: analytics.worstUsageDay,
  };
}

function parseAnalytics(dailyAnalytics: string): AnalyticsSnapshot {
  try {
    const parsed = JSON.parse(dailyAnalytics || '{}') as {
      daily?: Record<string, Record<string, unknown>>;
      monthlySummaries?: Record<string, Record<string, unknown>>;
      currentStreak?: unknown;
      longestStreak?: unknown;
      bestUsageDay?: Record<string, unknown>;
      worstUsageDay?: Record<string, unknown>;
    };
    return {
      daily: parsed.daily ?? {},
      monthlySummaries: parsed.monthlySummaries ?? {},
      currentStreak: numberOrZero(parsed.currentStreak),
      longestStreak: numberOrZero(parsed.longestStreak),
      bestUsageDay: parseUsageDaySummary(parsed.bestUsageDay),
      worstUsageDay: parseUsageDaySummary(parsed.worstUsageDay),
    };
  } catch {
    return {
      daily: {},
      monthlySummaries: {},
      currentStreak: 0,
      longestStreak: 0,
      bestUsageDay: null,
      worstUsageDay: null,
    };
  }
}

function parseUsageDaySummary(
  value: Record<string, unknown> | undefined,
): UsageDaySummary | null {
  if (!value || typeof value.date !== 'string') {
    return null;
  }

  return {
    date: value.date,
    totalTrackedMs: numberOrZero(value.totalTrackedMs),
    dailyLimitMinutes: numberOrZero(value.dailyLimitMinutes),
  };
}

function lastSevenDateKeys() {
  return Array.from({length: 7}, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return formatDateKey(date);
  });
}

function formatDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateKeysForMonth(monthKey: string) {
  const [year, monthNumber] = monthKey.split('-').map(Number);
  const month = monthNumber - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({length: daysInMonth}, (_, index) =>
    formatDateKey(new Date(year, month, index + 1)),
  );
}

function lastDateKeyForMonth(monthKey: string) {
  const monthKeys = dateKeysForMonth(monthKey);
  return monthKeys[monthKeys.length - 1] ?? monthKey;
}

function currentMonthKey() {
  const now = new Date();
  return formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7);
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number);
  return formatDateKey(new Date(year, month - 1 + delta, 1)).slice(0, 7);
}

function topInterventionAppForMonth(
  analytics: AnalyticsSnapshot,
  monthDateKeys: string[],
  summary: Record<string, unknown> | undefined,
) {
  const summaryCounts = parseCountMap(summary?.perAppInterventionCounts);
  const detailedCounts = monthDateKeys.reduce<Record<string, number>>((counts, dateKey) => {
    const day = analytics.daily[dateKey];
    const packageName =
      typeof day?.lastInterventionPackage === 'string'
        ? day.lastInterventionPackage
        : '';
    const interventions = numberOrZero(day?.voiceNoteInterventions);
    if (packageName && interventions > 0) {
      counts[packageName] = (counts[packageName] ?? 0) + interventions;
    }
    return counts;
  }, {});
  const counts = Object.keys(detailedCounts).length > 0 ? detailedCounts : summaryCounts;
  const topEntry = Object.entries(counts).sort((first, second) => second[1] - first[1])[0];

  return topEntry ? `${shortPackageName(topEntry[0])} (${topEntry[1]})` : null;
}

function parseCountMap(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>(
    (counts, [key, count]) => {
      counts[key] = numberOrZero(count);
      return counts;
    },
    {},
  );
}

function sortedPerAppUsage(perAppUsageMs: Record<string, number>) {
  return Object.entries(perAppUsageMs)
    .filter(([, usageMs]) => usageMs > 0)
    .sort((first, second) => second[1] - first[1]);
}

function shortPackageName(packageName: string) {
  return packageName
    .split('.')
    .filter(Boolean)
    .slice(-1)[0] ?? packageName;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatFriendlyDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function shortWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {weekday: 'short'});
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' ? value : 0;
}

const localStyles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  segmentedControl: {
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 18,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    paddingVertical: 10,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryTile: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  chartCard: {
    padding: 18,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  limitLegend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  limitLineSample: {
    borderRadius: 2,
    height: 3,
    width: 24,
  },
  limitLegendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  barChart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 210,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 158,
    justifyContent: 'flex-end',
    position: 'relative',
    width: '100%',
  },
  usageBar: {
    borderRadius: 7,
    minHeight: 2,
    width: '100%',
  },
  limitMarker: {
    borderRadius: 2,
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
  },
  dayUsage: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyBox: {
    borderRadius: 14,
    padding: 18,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    width: '12.4%',
  },
  calendarDay: {
    fontSize: 12,
    fontWeight: '900',
  },
  monthFooter: {
    borderTopWidth: 1,
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
  },
  monthNav: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 12,
  },
  monthNavButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  monthNavText: {
    fontSize: 18,
    fontWeight: '900',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
  },
  recordRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 14,
  },
  recordTextGroup: {
    flex: 1,
  },
  recordLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  recordMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  recordUsage: {
    fontSize: 18,
    fontWeight: '900',
  },
  daySheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  daySheetBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  daySheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 36,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  detailTile: {
    borderRadius: 14,
    padding: 12,
    width: '48%',
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailNote: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 18,
  },
  detailsSectionTitle: {
    marginBottom: 12,
  },
  perAppRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
  },
  perAppName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 10,
  },
  perAppTime: {
    fontSize: 13,
    fontWeight: '800',
  },
});
