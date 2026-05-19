import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, Modal, Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';

const {width} = Dimensions.get('window');

export function SettingsPanel({
  isVisible,
  onClose,
  onEditRecordings,
}: {
  isVisible: boolean;
  onClose: () => void;
  onEditRecordings?: () => void;
}) {
  const {
    language,
    setLanguage,
    setThemePreference,
    styles,
    t,
    themePreference,
  } = useAppTheme();

  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
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
      visible={isVisible}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <Animated.View
          style={[
            styles.settingsPanel,
            {
              transform: [{translateX: slideAnim}],
            },
          ]}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>{t('settings')}</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
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

          {onEditRecordings && (
            <View style={{marginTop: 12}}>
              <Pressable
                onPress={() => {
                  handleClose();
                  onEditRecordings();
                }}
                style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{t('recordingsTitle')}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.privacyBox}>
            <Text style={styles.noticeTitle}>{t('privacyNoteTitle')}</Text>
            <Text style={styles.noticeText}>{t('privacyNoteBody')}</Text>
          </View>
        </Animated.View>
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
