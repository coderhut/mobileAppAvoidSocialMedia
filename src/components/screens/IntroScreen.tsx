import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { ScreenScaffold } from '../common/ScreenScaffold';
import { useAppTheme } from '../../theme/ThemeContext';

export function IntroScreen({
  onContinue,
  onBack,
  onOpenSettings,
  hideHeader = false,
}: {
  onContinue: () => void;
  onBack: () => void;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
}) {
  const { colors, styles, t } = useAppTheme();

  return (
    <ScreenScaffold
      eyebrow={t('appName')}
      title={t('introTitle')}
      body={t('introBody')}
      onOpenSettings={onOpenSettings}
      hideHeader={hideHeader}
    >
      <View style={localStyles.roadmap}>
        <RoadmapItem
          number={1}
          title="Grant System Permissions"
          desc="Enable the system access needed to protect your attention."
          colors={colors}
        />
        <RoadmapItem
          number={2}
          title="Record Interventions"
          desc="Create voice notes to pull you out of the scroll."
          colors={colors}
        />
        <RoadmapItem
          number={3}
          title="Target Distractions"
          desc="Select the apps where you lose the most time."
          colors={colors}
        />
      </View>

      <View style={styles.actionGroup}>
        <View style={[localStyles.buttonRow, localStyles.bottomNav]}>
          <View style={localStyles.buttonCell}>
            <SecondaryButton label="Go Back" onPress={onBack} />
          </View>
          <View style={localStyles.buttonCell}>
            <PrimaryButton label={t('getStarted')} onPress={onContinue} />
          </View>
        </View>
      </View>
    </ScreenScaffold>
  );
}

function RoadmapItem({
  number,
  title,
  desc,
  colors,
}: {
  number: number;
  title: string;
  desc: string;
  colors: any;
}) {
  return (
    <View style={localStyles.item}>
      <View style={localStyles.lineAndDot}>
        <View style={[localStyles.dot, { backgroundColor: colors.primary }]}>
          <Text style={localStyles.dotText}>{number}</Text>
        </View>
        {number < 3 && (
          <View
            style={[localStyles.line, { backgroundColor: colors.border }]}
          />
        )}
      </View>
      <View style={localStyles.textContainer}>
        <Text style={[localStyles.itemTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[localStyles.itemDesc, { color: colors.mutedText }]}>
          {desc}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  roadmap: {
    marginBottom: 40,
    paddingLeft: 4,
  },
  item: {
    flexDirection: 'row',
    minHeight: 80,
  },
  lineAndDot: {
    alignItems: 'center',
    marginRight: 20,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dotText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  textContainer: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 24,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomNav: {
    paddingBottom: 20,
  },
  buttonCell: {
    flex: 1,
  },
});
