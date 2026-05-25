import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  const { height: windowHeight } = useWindowDimensions();
  const [pendingPermission, setPendingPermission] =
    React.useState<PermissionKey | null>(null);
  const [highlightedPermission, setHighlightedPermission] =
    React.useState<PermissionKey | null>(null);
  const [messagePermission, setMessagePermission] =
    React.useState<PermissionKey | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const listYPosition = React.useRef(0);
  const permissionYPositions = React.useRef<
    Partial<Record<PermissionKey, number>>
  >({});
  const highlightAnim = React.useRef(new Animated.Value(0)).current;

  const canContinue = hasUsageAccess && hasOverlayAccess && hasMicrophoneAccess;

  const permissionState: Record<PermissionKey, boolean> = {
    usage: hasUsageAccess,
    overlay: hasOverlayAccess,
    microphone: hasMicrophoneAccess,
    notification: hasNotificationAccess,
  };

  const missingRequiredPermission = (): PermissionKey | null => {
    if (!hasUsageAccess) return 'usage';
    if (!hasOverlayAccess) return 'overlay';
    if (!hasMicrophoneAccess) return 'microphone';
    return null;
  };

  const getRequiredPermissionMessage = (permission: PermissionKey) => {
    switch (permission) {
      case 'usage':
        return t('usageAccessRequiredMessage');
      case 'overlay':
        return t('overlayRequiredMessage');
      case 'microphone':
        return t('microphoneRequiredMessage');
      case 'notification':
        return '';
    }
  };

  const highlightMissingPermission = (permission: PermissionKey) => {
    const yPosition =
      listYPosition.current + (permissionYPositions.current[permission] ?? 0);
    const targetY = yPosition - windowHeight * 0.45;

    scrollRef.current?.scrollTo({
      y: Math.max(targetY, 0),
      animated: true,
    });

    setHighlightedPermission(permission);
    highlightAnim.setValue(0);
    Animated.sequence([
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => setHighlightedPermission(null));
  };

  const handleContinue = () => {
    const missingPermission = missingRequiredPermission();

    if (!hideHeader && missingPermission) {
      setMessagePermission(missingPermission);
      highlightMissingPermission(missingPermission);
      return;
    }

    onContinue();
  };

  const handleGrant = async (
    permission: PermissionKey,
    onPress: () => void | Promise<void>,
  ) => {
    if (pendingPermission) return;

    setMessagePermission(null);
    setHighlightedPermission(null);
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
    const isHighlighted = highlightedPermission === permission;
    const hasValidationMessage = messagePermission === permission;
    const highlightTranslateX = highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    });

    return (
      <React.Fragment key={permission}>
        <Animated.View
          onLayout={event => {
            permissionYPositions.current[permission] =
              event.nativeEvent.layout.y;
          }}
          style={[
            localStyles.itemContainer,
            {
              backgroundColor: colors.surface,
              borderColor:
                isHighlighted || hasValidationMessage
                  ? '#EF4444'
                  : colors.border,
            },
            isHighlighted && {
              transform: [{ translateX: highlightTranslateX }],
            },
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
                <Text
                  style={[localStyles.checkMark, { color: colors.success }]}
                >
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
                  !!pendingPermission &&
                    !isPending &&
                    localStyles.disabledButton,
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
        </Animated.View>
        {hasValidationMessage && (
          <View style={localStyles.requiredMessage}>
            <Text style={localStyles.requiredMessageText}>
              {getRequiredPermissionMessage(permission)}
            </Text>
          </View>
        )}
      </React.Fragment>
    );
  };

  const header = !hideHeader ? (
    <View style={[styles.topBar, localStyles.fixedHeaderPadding]}>
      <Text style={styles.sectionTitle}>{t('setupPermissionsTitle')}</Text>
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
  ) : null;

  return (
    <View style={styles.appShell}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          !hideHeader && localStyles.fixedHeaderScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {hideHeader && (
          <Text style={styles.title}>{t('setupPermissionsTitle')}</Text>
        )}
        <Text style={styles.body}>{t('setupPermissionsBody')}</Text>

        <View
          style={localStyles.list}
          onLayout={event => {
            listYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          {renderPermissionItem(
            'usage',
            t('usageAccessLabel'),
            t('usageAccessDesc'),
            permissionState.usage,
            onOpenUsageSettings,
          )}

          {renderPermissionItem(
            'overlay',
            t('overlayLabel'),
            t('overlayDesc'),
            permissionState.overlay,
            onOpenOverlaySettings,
          )}

          {renderPermissionItem(
            'microphone',
            t('microphoneLabel'),
            t('microphoneDesc'),
            permissionState.microphone,
            requestMicrophone,
          )}

          {renderPermissionItem(
            'notification',
            t('notificationLabel'),
            t('notificationDesc'),
            permissionState.notification,
            requestNotifications,
          )}
        </View>

        <View style={localStyles.footer}>
          <View style={localStyles.buttonRow}>
            {hideHeader && (
              <View style={localStyles.buttonCell}>
                <SecondaryButton label="Go Back" onPress={onBack} />
              </View>
            )}
            <View style={localStyles.buttonCell}>
              <PrimaryButton
                disabled={hideHeader && !canContinue}
                label={
                  hideHeader
                    ? t('continueLabel')
                    : t('doneSettingPermissionsLabel')
                }
                onPress={handleContinue}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  fixedHeaderPadding: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  fixedHeaderScrollContent: {
    paddingTop: 0,
  },
  list: {
    gap: 16,
    marginTop: 8,
  },
  itemContainer: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
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
    fontWeight: '500',
    lineHeight: 18,
  },
  itemAction: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  checkCircle: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: '900',
  },
  grantButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 70,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.45,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  requiredMessage: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: -2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  requiredMessageText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  footer: {
    marginBottom: 24,
    marginTop: 32,
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
