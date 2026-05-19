import React from 'react';
import {Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';

export function OverlayPermissionScreen({
  hasOverlayAccess,
  isCheckingAccess,
  onOpenSettings,
  onOpenSettingsMenu,
}: {
  hasOverlayAccess: boolean;
  isCheckingAccess: boolean;
  onOpenSettings: () => void;
  onOpenSettingsMenu: () => void;
}) {
  const {styles, t} = useAppTheme();

  return (
    <ScreenScaffold
      eyebrow={t('stepOne')}
      title={t('overlayPermissionTitle')}
      body={t('overlayPermissionBody')}
      onOpenSettings={onOpenSettingsMenu}>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>{t('whatThisEnables')}</Text>
        <Text style={styles.noticeText}>{t('whatThisEnablesBody')}</Text>
      </View>

      <Text style={styles.helperText}>
        {hasOverlayAccess ? t('overlayAccessDetected') : t('returnAfterEnabling')}
      </Text>

      <View style={styles.actionGroup}>
        <PrimaryButton label={t('openOverlaySettings')} onPress={onOpenSettings} />
        {isCheckingAccess ? (
          <Text style={styles.helperText}>{t('checkingAccess')}</Text>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}
