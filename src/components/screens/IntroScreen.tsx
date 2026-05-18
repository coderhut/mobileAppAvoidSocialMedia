import React from 'react';
import {View} from 'react-native';
import {FeatureItem} from '../common/FeatureItem';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {SecondaryButton} from '../common/SecondaryButton';
import {useAppTheme} from '../../theme/ThemeContext';

export function IntroScreen({
  onContinue,
  onOpenSettings,
  onSkipToDashboard,
}: {
  onContinue: () => void;
  onOpenSettings: () => void;
  onSkipToDashboard: () => void;
}) {
  const {styles, t} = useAppTheme();

  return (
    <ScreenScaffold
      eyebrow={t('appName')}
      title={t('introTitle')}
      body={t('introBody')}
      onOpenSettings={onOpenSettings}>
      <View style={styles.featureList}>
        <FeatureItem title={t('trackSelectedApps')} />
        <FeatureItem title={t('keepLocal')} />
        <FeatureItem title={t('androidUsageAccess')} />
      </View>

      <View style={styles.actionGroup}>
        <PrimaryButton label={t('getStarted')} onPress={onContinue} />
        <SecondaryButton label={t('previewDashboard')} onPress={onSkipToDashboard} />
      </View>
    </ScreenScaffold>
  );
}
