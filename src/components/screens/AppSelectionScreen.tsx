import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';
import {useAppTheme} from '../../theme/ThemeContext';
import type {TrackableApp} from '../../types';

export function AppSelectionScreen({
  availableApps,
  isLoadingApps,
  onOpenSettings,
  onToggleApp,
  onContinue,
  selectedPackageNames,
}: {
  availableApps: TrackableApp[];
  isLoadingApps: boolean;
  onOpenSettings: () => void;
  onToggleApp: (packageName: string) => void;
  onContinue: () => void;
  selectedPackageNames: string[];
}) {
  const {styles, t} = useAppTheme();

  return (
    <ScreenScaffold
      eyebrow={t('stepTwo')}
      title={t('appSelectionTitle')}
      body={t('appSelectionBody')}
      onOpenSettings={onOpenSettings}>
      {isLoadingApps ? (
        <Text style={styles.helperText}>Loading installed apps...</Text>
      ) : null}
      <View style={styles.appList}>
        {availableApps.map(app => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: selectedPackageNames.includes(app.packageName),
            }}
            key={app.packageName}
            onPress={() => onToggleApp(app.packageName)}
            style={[
              styles.appRow,
              selectedPackageNames.includes(app.packageName) && styles.appRowSelected,
            ]}>
            <View style={[styles.appIcon, {backgroundColor: app.accent}]}>
              <Text style={styles.appIconText}>{app.name.charAt(0)}</Text>
            </View>
            <View style={styles.appTextGroup}>
              <Text style={styles.appName}>{app.name}</Text>
              <Text style={styles.appCategory}>{app.category}</Text>
            </View>
            <Text style={styles.checkmark}>
              {selectedPackageNames.includes(app.packageName)
                ? t('selectedLabel')
                : t('addLabel')}
            </Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        disabled={selectedPackageNames.length === 0}
        label={`${t('continueWith')} ${selectedPackageNames.length} ${
          selectedPackageNames.length === 1 ? t('appSingular') : t('appPlural')
        }`}
        onPress={onContinue}
      />
    </ScreenScaffold>
  );
}
