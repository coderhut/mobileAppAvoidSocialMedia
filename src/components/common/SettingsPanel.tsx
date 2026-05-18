import React from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';

export function SettingsPanel({
  isVisible,
  onClose,
}: {
  isVisible: boolean;
  onClose: () => void;
}) {
  const {
    language,
    setLanguage,
    setThemePreference,
    styles,
    t,
    themePreference,
  } = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={isVisible}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>{t('settings')}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </Pressable>
          </View>

          <Text style={styles.settingsSectionTitle}>{t('theme')}</Text>
          <View style={styles.optionList}>
            <SettingsOption
              isSelected={themePreference === 'system'}
              label={t('useDeviceSetting')}
              onPress={() => setThemePreference('system')}
            />
            <SettingsOption
              isSelected={themePreference === 'light'}
              label={t('light')}
              onPress={() => setThemePreference('light')}
            />
            <SettingsOption
              isSelected={themePreference === 'dark'}
              label={t('dark')}
              onPress={() => setThemePreference('dark')}
            />
          </View>

          <Text style={styles.settingsSectionTitle}>{t('language')}</Text>
          <View style={styles.optionList}>
            <SettingsOption
              isSelected={language === 'en'}
              label={t('english')}
              onPress={() => setLanguage('en')}
            />
            <SettingsOption
              isSelected={language === 'ur'}
              label={t('urdu')}
              onPress={() => setLanguage('ur')}
            />
          </View>

          <View style={styles.privacyBox}>
            <Text style={styles.noticeTitle}>{t('privacyNoteTitle')}</Text>
            <Text style={styles.noticeText}>{t('privacyNoteBody')}</Text>
          </View>
        </View>
      </View>
    </Modal>
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
  const {styles, t} = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{checked: isSelected}}
      onPress={onPress}
      style={[styles.optionRow, isSelected && styles.optionRowSelected]}>
      <Text style={styles.optionLabel}>{label}</Text>
      {isSelected ? <Text style={styles.optionSelected}>{t('selected')}</Text> : null}
    </Pressable>
  );
}
