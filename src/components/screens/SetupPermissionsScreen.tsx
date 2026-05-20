import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {useAppTheme} from '../../theme/ThemeContext';

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
  hideHeader = false,
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
  onOpenSettingsMenu?: () => void;
  hideHeader?: boolean;
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
      <View style={[localStyles.itemContainer, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={localStyles.itemInfo}>
          <Text style={[localStyles.itemLabel, {color: colors.text}]}>{label}</Text>
          <Text style={[localStyles.itemDesc, {color: colors.mutedText}]}>{desc}</Text>
        </View>
        <View style={localStyles.itemAction}>
          {isGranted ? (
            <View style={[localStyles.checkCircle, {backgroundColor: colors.success + '20'}]}>
              <Text style={[localStyles.checkMark, {color: colors.success}]}>✓</Text>
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
    <View style={styles.scrollContent}>
      {!hideHeader && (
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>{t('stepThree')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettingsMenu}
            style={styles.themeToggle}>
            <View style={styles.menuIcon}>
              <View style={styles.menuBar} />
              <View style={styles.menuBar} />
              <View style={styles.menuBar} />
            </View>
          </Pressable>
        </View>
      )}

      <Text style={styles.title}>{t('setupPermissionsTitle')}</Text>
      <Text style={styles.body}>{t('setupPermissionsBody')}</Text>

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

      <View style={localStyles.footer}>
        <PrimaryButton
          disabled={!canContinue}
          label={canContinue ? t('allSetLabel') : t('returnAfterEnabling')}
          onPress={onContinue}
        />
      </View>
    </View>
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
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemLabel: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  itemAction: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontWeight: '900',
    fontSize: 18,
  },
  grantButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  footer: {
    marginTop: 48,
    marginBottom: 20,
  }
});
