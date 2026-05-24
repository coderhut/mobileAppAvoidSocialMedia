import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { useAppTheme } from '../../theme/ThemeContext';

type PermissionKey = 'usage' | 'overlay' | 'microphone' | 'notification';

export function SetupPermissionsScreen({
  hasUsageAccess,
  hasOverlayAccess,
  hasNotificationAccess,
  hasMicrophoneAccess,
  onOpenUsageSettings,
  onOpenOverlaySettings,
  requestMicrophone,
  requestNotifications,
  onBack,
  onContinue,
  onOpenSettingsMenu,
  hideHeader = false,
}: {
  hasUsageAccess: boolean;
  hasOverlayAccess: boolean;
  hasNotificationAccess: boolean;
  hasMicrophoneAccess: boolean;
  onOpenUsageSettings: () => void | Promise<void>;
  onOpenOverlaySettings: () => void | Promise<void>;
  requestMicrophone: () => void | Promise<void>;
  requestNotifications: () => void | Promise<void>;
  onBack: () => void;
  onContinue: () => void;
  onOpenSettingsMenu?: () => void;
  hideHeader?: boolean;
}) {
  const { colors, styles, t } = useAppTheme();
  const [pendingPermission, setPendingPermission] =
    React.useState<PermissionKey | null>(null);

  const canContinue =
    hasUsageAccess &&
    hasOverlayAccess &&
    hasMicrophoneAccess &&
    hasNotificationAccess;

  const handleGrant = async (
    permission: PermissionKey,
    onPress: () => void | Promise<void>,
  ) => {
    if (pendingPermission) return;

    setPendingPermission(permission);
    try {
      await Promise.all([
        onPress(),
        new Promise<void>(resolve => setTimeout(() => resolve(), 900)),
      ]);
    } finally {
      setPendingPermission(null);
    }
  };

  const renderPermissionItem = (
    permission: PermissionKey,
    label: string,
    desc: string,
    isGranted: boolean,
    onPress: () => void | Promise<void>,
  ) => {
    const isPending = pendingPermission === permission;

    return (
      <View
        style={[
          localStyles.itemContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={localStyles.itemInfo}>
          <Text style={[localStyles.itemLabel, { color: colors.text }]}>
            {label}
          </Text>
          <Text style={[localStyles.itemDesc, { color: colors.mutedText }]}>
            {desc}
          </Text>
        </View>
        <View style={localStyles.itemAction}>
          {isGranted ? (
            <View
              style={[
                localStyles.checkCircle,
                { backgroundColor: colors.success + '20' },
              ]}
            >
              <Text style={[localStyles.checkMark, { color: colors.success }]}>
                ✓
              </Text>
            </View>
          ) : (
            <Pressable
              disabled={!!pendingPermission}
              onPress={() => handleGrant(permission, onPress)}
              style={[
                localStyles.grantButton,
                { backgroundColor: colors.primary },
                !!pendingPermission && !isPending && localStyles.disabledButton,
              ]}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={localStyles.grantButtonText}>
                  {t('grantLabel')}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {!hideHeader && (
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>{t('stepOne')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettingsMenu}
            style={styles.themeToggle}
          >
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
          'usage',
          t('usageAccessLabel'),
          t('usageAccessDesc'),
          hasUsageAccess,
          onOpenUsageSettings,
        )}

        {renderPermissionItem(
          'overlay',
          t('overlayLabel'),
          t('overlayDesc'),
          hasOverlayAccess,
          onOpenOverlaySettings,
        )}

        {renderPermissionItem(
          'microphone',
          t('microphoneLabel'),
          t('microphoneDesc'),
          hasMicrophoneAccess,
          requestMicrophone,
        )}

        {renderPermissionItem(
          'notification',
          t('notificationLabel'),
          t('notificationDesc'),
          hasNotificationAccess,
          requestNotifications,
        )}
      </View>

      <View style={localStyles.footer}>
        <View style={localStyles.buttonRow}>
          <View style={localStyles.buttonCell}>
            <SecondaryButton label="Go Back" onPress={onBack} />
          </View>
          <View style={localStyles.buttonCell}>
            <PrimaryButton
              disabled={!canContinue}
              label={t('continueLabel')}
              onPress={onContinue}
            />
          </View>
        </View>
      </View>
    </ScrollView>
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
    minWidth: 70,
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  footer: {
    marginTop: 32,
    marginBottom: 24,
    paddingBottom: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonCell: {
    flex: 1,
  },
});
