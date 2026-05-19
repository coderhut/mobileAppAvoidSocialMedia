import React from 'react';
import {PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';
import {UsageStatsModule} from '../../native/modules';

export function SetupPermissionsScreen({
  hasUsageAccess,
  hasOverlayAccess,
  hasNotificationAccess,
  hasMicrophoneAccess,
  onOpenUsageSettings,
  onOpenOverlaySettings,
  requestMicrophone,
  requestNotifications,
  onContinue,
  onOpenSettingsMenu,
}: {
  hasUsageAccess: boolean;
  hasOverlayAccess: boolean;
  hasNotificationAccess: boolean;
  hasMicrophoneAccess: boolean;
  onOpenUsageSettings: () => void;
  onOpenOverlaySettings: () => void;
  requestMicrophone: () => void;
  requestNotifications: () => void;
  onContinue: () => void;
  onOpenSettingsMenu: () => void;
}) {
  const {colors, styles, t} = useAppTheme();

  const canContinue = hasUsageAccess && hasOverlayAccess;

  const renderPermissionItem = (
    label: string,
    desc: string,
    isGranted: boolean,
    onPress: () => void
  ) => {
    return (
      <View style={[localStyles.itemContainer, {borderColor: colors.border}]}>
        <View style={localStyles.itemInfo}>
          <Text style={[styles.appName, {color: colors.text}]}>{label}</Text>
          <Text style={[styles.body, {fontSize: 12, marginTop: 2}]}>{desc}</Text>
        </View>
        <View style={localStyles.itemAction}>
          {isGranted ? (
            <View style={[localStyles.checkCircle, {backgroundColor: colors.success}]}>
              <Text style={localStyles.checkMark}>✓</Text>
            </View>
          ) : (
            <Pressable
              onPress={onPress}
              style={[localStyles.grantButton, {backgroundColor: colors.primary}]}>
              <Text style={localStyles.grantButtonText}>{t('grantLabel')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenScaffold
      eyebrow={t('stepOne')}
      title={t('setupPermissionsTitle')}
      body={t('setupPermissionsBody')}
      onOpenSettings={onOpenSettingsMenu}>

      <View style={localStyles.list}>
        {renderPermissionItem(
          t('usageAccessLabel'),
          t('usageAccessDesc'),
          hasUsageAccess,
          onOpenUsageSettings
        )}

        {renderPermissionItem(
          t('overlayLabel'),
          t('overlayDesc'),
          hasOverlayAccess,
          onOpenOverlaySettings
        )}

        {renderPermissionItem(
          t('microphoneLabel'),
          t('microphoneDesc'),
          hasMicrophoneAccess,
          requestMicrophone
        )}

        {renderPermissionItem(
          t('notificationLabel'),
          t('notificationDesc'),
          hasNotificationAccess,
          requestNotifications
        )}
      </View>

      <View style={{marginTop: 32}}>
        <PrimaryButton
          disabled={!canContinue}
          label={canContinue ? t('getStarted') : t('returnAfterEnabling')}
          onPress={onContinue}
        />
      </View>
    </ScreenScaffold>
  );
}

const localStyles = StyleSheet.create({
  list: {
    gap: 16,
    marginTop: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemAction: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  grantButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
