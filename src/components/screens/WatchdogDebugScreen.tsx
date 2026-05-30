import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenScaffold } from '../common/ScreenScaffold';
import { UsageStatsModule } from '../../native/modules';
import { useAppTheme } from '../../theme/ThemeContext';
import type { WatchdogDebugInfo } from '../../types';
import { formatDuration } from '../../utils/duration';

export function WatchdogDebugScreen({
  onBack,
  onOpenSettings,
}: {
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const [debugInfo, setDebugInfo] = React.useState<WatchdogDebugInfo | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const refreshDebugInfo = React.useCallback(async () => {
    try {
      const raw = await UsageStatsModule?.getWatchdogDebugInfo();
      if (!raw) {
        setDebugInfo(null);
        setError('No watchdog debug data yet.');
        return;
      }

      setDebugInfo(JSON.parse(raw) as WatchdogDebugInfo);
      setError(null);
    } catch {
      setDebugInfo(null);
      setError('Unable to read watchdog debug data.');
    }
  }, []);

  React.useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 5000);
    return () => clearInterval(interval);
  }, [refreshDebugInfo]);

  const updatedAtLabel = debugInfo?.updatedAt
    ? new Date(debugInfo.updatedAt).toLocaleTimeString()
    : 'N/A';

  return (
    <ScreenScaffold
      eyebrow="Debug"
      title="Debug WatchDog"
      body="Next expected interventions from the native watchdog service."
      onGoHome={onBack}
      onOpenSettings={onOpenSettings}
      fixedHeader
    >
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Scenario</Text>
        <Text style={styles.noticeText}>{debugInfo?.scenario ?? 'N/A'}</Text>
        <Text style={styles.noticeText}>
          Active app: {debugInfo?.activePackage ?? 'N/A'}
        </Text>
        <Text style={styles.noticeText}>Updated: {updatedAtLabel}</Text>
      </View>

      {error ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Waiting for watchdog</Text>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {debugInfo ? (
        <>
          <View style={localStyles.summaryGrid}>
            <DebugMetric
              label="Tracked today"
              value={formatDuration(debugInfo.totalUsageMs)}
            />
            <DebugMetric
              label="Session"
              value={formatDuration(debugInfo.sessionElapsedMs)}
            />
            <DebugMetric
              label="Level"
              value={`L${debugInfo.currentEscalationLevel}`}
            />
          </View>

          <View
            style={[
              styles.usageCard,
              localStyles.table,
              { borderColor: colors.border },
            ]}
          >
            <View style={[localStyles.tableRow, localStyles.tableHeader]}>
              <Text style={[localStyles.headerCell, { color: colors.text }]}>
                Level
              </Text>
              <Text style={[localStyles.headerCell, { color: colors.text }]}>
                Fires At
              </Text>
              <Text style={[localStyles.headerCell, { color: colors.text }]}>
                Remaining
              </Text>
            </View>
            {debugInfo.rows.map(row => (
              <View key={row.level} style={localStyles.tableRow}>
                <Text style={[localStyles.cell, { color: colors.text }]}>
                  {row.level}
                </Text>
                <Text style={[localStyles.cell, { color: colors.mutedText }]}>
                  {row.firesAt}
                </Text>
                <View style={localStyles.cell}>
                  <Text
                    style={[
                      localStyles.remainingText,
                      { color: colors.primary },
                    ]}
                  >
                    {row.timeRemaining}
                  </Text>
                  <Text
                    style={[
                      localStyles.statusText,
                      { color: colors.subtleText },
                    ]}
                  >
                    {row.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable
          accessibilityRole="button"
          onPress={refreshDebugInfo}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Refresh</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}

function DebugMetric({ label, value }: { label: string; value: string }) {
  const { colors, styles } = useAppTheme();

  return (
    <View style={[styles.usageCard, localStyles.metricCard]}>
      <Text style={[localStyles.metricValue, { color: colors.text }]}>
        {value}
      </Text>
      <Text style={[localStyles.metricLabel, { color: colors.subtleText }]}>
        {label}
      </Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    marginBottom: 0,
    padding: 14,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  table: {
    borderWidth: 1,
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tableHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
