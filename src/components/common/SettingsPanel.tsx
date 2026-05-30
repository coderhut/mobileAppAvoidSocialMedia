import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

const { width } = Dimensions.get('window');

export function SettingsPanel({
  isVisible,
  onClose,
  onEditRecordings,
  onOpenInsights,
  onManagePermissions,
  onOpenWatchdogDebug,
  onResetWatchdogTime,
  onSeedAnalyticsTestData,
}: {
  isVisible: boolean;
  onClose: () => void;
  onEditRecordings?: () => void;
  onOpenInsights?: () => void;
  onManagePermissions?: () => void;
  onOpenWatchdogDebug?: () => void;
  onResetWatchdogTime?: () => void;
  onSeedAnalyticsTestData?: () => void;
}) {
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const {
    language,
    setLanguage,
    setThemePreference,
    styles,
    t,
    themePreference,
  } = useAppTheme();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const currentThemeLabel =
    themePreference === 'system'
      ? t('useDeviceSetting')
      : themePreference === 'light'
      ? t('light')
      : t('dark');
  const currentLanguageLabel = language === 'en' ? t('english') : t('urdu');

  useEffect(() => {
    if (isVisible) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleClose = () => {
    setIsThemeSheetOpen(false);
    setIsLanguageSheetOpen(false);
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <Animated.View
          style={[
            styles.settingsPanel,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>{t('settings')}</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </Pressable>
          </View>

          <View style={styles.optionList}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsLanguageSheetOpen(true)}
              style={styles.optionRow}
            >
              <Text style={styles.optionLabel}>{t('language')}</Text>
              <Text style={styles.optionSelected}>{currentLanguageLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsThemeSheetOpen(true)}
              style={styles.optionRow}
            >
              <Text style={styles.optionLabel}>{t('theme')}</Text>
              <Text style={styles.optionSelected}>{currentThemeLabel}</Text>
            </Pressable>

            {onEditRecordings && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onEditRecordings();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>
                  {t('manageVoiceNotesLabel')}
                </Text>
              </Pressable>
            )}

            {onOpenInsights && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onOpenInsights();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>{t('insights')}</Text>
              </Pressable>
            )}

            {onManagePermissions && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onManagePermissions();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>
                  {t('managePermissionsLabel')}
                </Text>
              </Pressable>
            )}

            {onOpenWatchdogDebug && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onOpenWatchdogDebug();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>Debug WatchDog</Text>
              </Pressable>
            )}

            {onResetWatchdogTime && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onResetWatchdogTime();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>Reset Compound Time</Text>
              </Pressable>
            )}

            {onSeedAnalyticsTestData && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleClose();
                  onSeedAnalyticsTestData();
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>Seed Analytics Test Data</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.privacyBox}>
            <Text style={styles.noticeTitle}>{t('privacyNoteTitle')}</Text>
            <Text style={styles.noticeText}>{t('privacyNoteBody')}</Text>
          </View>
        </Animated.View>
      </View>
      <ThemeBottomSheet
        isVisible={isThemeSheetOpen}
        onClose={() => setIsThemeSheetOpen(false)}
        onSelectTheme={preference => {
          setThemePreference(preference);
          setIsThemeSheetOpen(false);
        }}
        selectedTheme={themePreference}
      />
      <LanguageBottomSheet
        isVisible={isLanguageSheetOpen}
        onClose={() => setIsLanguageSheetOpen(false)}
        onSelectLanguage={nextLanguage => {
          setLanguage(nextLanguage);
          setIsLanguageSheetOpen(false);
        }}
        selectedLanguage={language}
      />
    </Modal>
  );
}

function ThemeBottomSheet({
  isVisible,
  onClose,
  onSelectTheme,
  selectedTheme,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelectTheme: (preference: 'system' | 'light' | 'dark') => void;
  selectedTheme: 'system' | 'light' | 'dark';
}) {
  const { styles, t } = useAppTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.bottomSheetOverlay}>
      <Pressable style={styles.bottomSheetBackdrop} onPress={onClose} />
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>{t('theme')}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('close')}</Text>
          </Pressable>
        </View>
        <View style={styles.optionList}>
          <SettingsOption
            isSelected={selectedTheme === 'system'}
            label={t('useDeviceSetting')}
            onPress={() => onSelectTheme('system')}
          />
          <SettingsOption
            isSelected={selectedTheme === 'light'}
            label={t('light')}
            onPress={() => onSelectTheme('light')}
          />
          <SettingsOption
            isSelected={selectedTheme === 'dark'}
            label={t('dark')}
            onPress={() => onSelectTheme('dark')}
          />
        </View>
      </View>
    </View>
  );
}

function LanguageBottomSheet({
  isVisible,
  onClose,
  onSelectLanguage,
  selectedLanguage,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelectLanguage: (language: 'en' | 'ur') => void;
  selectedLanguage: 'en' | 'ur';
}) {
  const { styles, t } = useAppTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.bottomSheetOverlay}>
      <Pressable style={styles.bottomSheetBackdrop} onPress={onClose} />
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>{t('language')}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('close')}</Text>
          </Pressable>
        </View>
        <View style={styles.optionList}>
          <SettingsOption
            isSelected={selectedLanguage === 'en'}
            label={t('english')}
            onPress={() => onSelectLanguage('en')}
          />
          <SettingsOption
            isSelected={selectedLanguage === 'ur'}
            label={t('urdu')}
            onPress={() => onSelectLanguage('ur')}
          />
        </View>
      </View>
    </View>
  );
}

function SettingsOption({
  isSelected,
  label,
  onPress,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  const { styles, t } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={[styles.optionRow, isSelected && styles.optionRowSelected]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      {isSelected ? (
        <Text style={styles.optionSelected}>{t('selected')}</Text>
      ) : null}
    </Pressable>
  );
}
