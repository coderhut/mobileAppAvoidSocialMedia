import React from 'react';
import {FlatList, Pressable, Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import type {TrackableApp} from '../../types';

export function AppSelectionScreen({
  availableApps,
  isLoadingApps,
  onOpenSettings,
  onContinue,
}: {
  availableApps: TrackableApp[];
  isLoadingApps: boolean;
  onOpenSettings: () => void;
  onContinue: () => void;
}) {
  const {styles, t} = useAppTheme();
  const {selectedPackageNames, toggleApp} = useSettings();
  const selectedPackageSet = React.useMemo(
    () => new Set(selectedPackageNames),
    [selectedPackageNames],
  );

  const renderAppRow = React.useCallback(
    ({item: app}: {item: TrackableApp}) => {
      const isSelected = selectedPackageSet.has(app.packageName);

      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: isSelected}}
          onPress={() => onToggleApp(app.packageName)}
          style={[styles.appRow, isSelected && styles.appRowSelected]}>
          <View style={[styles.appIcon, {backgroundColor: app.accent}]}>
            <Text style={styles.appIconText}>{app.name.charAt(0)}</Text>
          </View>
          <View style={styles.appTextGroup}>
            <Text style={styles.appName}>{app.name}</Text>
            <Text style={styles.appCategory}>{app.category}</Text>
          </View>
          <Text style={styles.checkmark}>
            {isSelected ? t('selectedLabel') : t('addLabel')}
          </Text>
        </Pressable>
      );
    },
    [onToggleApp, selectedPackageSet, styles, t],
  );

  return (
    <FlatList
      contentContainerStyle={styles.scrollContent}
      data={availableApps}
      initialNumToRender={20}
      ItemSeparatorComponent={AppListSeparator}
      keyExtractor={app => app.packageName}
      ListFooterComponent={
        <PrimaryButton
          disabled={selectedPackageNames.length === 0}
          label={`${t('continueWith')} ${selectedPackageNames.length} ${
            selectedPackageNames.length === 1 ? t('appSingular') : t('appPlural')
          }`}
          onPress={onContinue}
        />
      }
      ListHeaderComponent={
        <>
          <View style={styles.topBar}>
            <Text style={styles.eyebrow}>{t('stepTwo')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSettings}
              style={styles.themeToggle}>
              <Text style={styles.themeToggleText}>{t('settings')}</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{t('appSelectionTitle')}</Text>
          <Text style={styles.body}>{t('appSelectionBody')}</Text>
          {isLoadingApps ? (
            <Text style={styles.helperText}>Loading installed apps...</Text>
          ) : null}
        </>
      }
      maxToRenderPerBatch={20}
      renderItem={renderAppRow}
      showsVerticalScrollIndicator={false}
      windowSize={9}
    />
  );
}

function AppListSeparator() {
  const {styles} = useAppTheme();

  return <View style={styles.appListSeparator} />;
}
