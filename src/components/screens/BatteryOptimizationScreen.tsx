import React from 'react';
import {Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';

export function BatteryOptimizationScreen({
  isIgnoringBatteryOptimizations,
  isCheckingAccess,
  onOpenSettings,
  onOpenSettingsMenu,
}: {
  isIgnoringBatteryOptimizations: boolean;
  isCheckingAccess: boolean;
  onOpenSettings: () => void;
  onOpenSettingsMenu: () => void;
}) {
  const {styles, t} = useAppTheme();

  return (
    <ScreenScaffold
      eyebrow={t('stepOne')}
      title={t('batteryOptimizationTitle')}
      body={t('batteryOptimizationBody')}
      onOpenSettings={onOpenSettingsMenu}>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>{t('whatThisEnables')}</Text>
        <Text style={styles.noticeText}>{t('whatThisEnablesBody')}</Text>
      </View>

      <Text style={styles.helperText}>
        {isIgnoringBatteryOptimizations ? t('batteryAccessDetected') : t('returnAfterEnabling')}
      </Text>

      <View style={styles.actionGroup}>
        <PrimaryButton label={t('openBatterySettings')} onPress={onOpenSettings} />
        {isCheckingAccess ? (
          <Text style={styles.helperText}>{t('checkingAccess')}</Text>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}
