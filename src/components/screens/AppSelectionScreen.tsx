import React from 'react';
import {Image, Pressable, SectionList, StyleSheet, Text, View} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import type {TrackableApp} from '../../types';
import {FALLBACK_TRACKABLE_APPS} from '../../utils/apps';

export function AppSelectionScreen({
  availableApps,
  isLoadingApps,
  onOpenSettings,
  onContinue,
  hideHeader = false,
}: {
  availableApps: TrackableApp[];
  isLoadingApps: boolean;
  onOpenSettings?: () => void;
  onContinue: () => void;
  hideHeader?: boolean;
}) {
  const {colors, styles, t} = useAppTheme();
  const {selectedPackageNames, toggleApp} = useSettings();
  const selectedPackageSet = React.useMemo(
    () => new Set(selectedPackageNames),
    [selectedPackageNames],
  );

  const sections = React.useMemo(() => {
    const renownedPackageNames = new Set(FALLBACK_TRACKABLE_APPS.map(a => a.packageName));

    const renowned: TrackableApp[] = [];
    const others: TrackableApp[] = [];

    availableApps.forEach(app => {
      if (renownedPackageNames.has(app.packageName)) {
        renowned.push(app);
      } else {
        others.push(app);
      }
    });

    const result = [];
    if (renowned.length > 0) {
      result.push({title: t('renownedAppsLabel'), data: renowned});
    }
    if (others.length > 0) {
      result.push({title: t('otherAppsLabel'), data: others});
    }
    return result;
  }, [availableApps, t]);

  const renderAppRow = React.useCallback(
    ({item: app}: {item: TrackableApp}) => {
      const isSelected = selectedPackageSet.has(app.packageName);

      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: isSelected}}
          onPress={() => toggleApp(app.packageName)}
          style={[styles.appRow, isSelected && styles.appRowSelected]}>
          <View style={[styles.appIcon, {backgroundColor: app.accent}]}>
            {app.icon ? (
              <Image
                source={{uri: `data:image/png;base64,${app.icon}`}}
                style={{width: '100%', height: '100%', borderRadius: 8}}
              />
            ) : (
              <Text style={styles.appIconText}>{app.name.charAt(0)}</Text>
            )}
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
    [toggleApp, selectedPackageSet, styles, t],
  );

  return (
    <View style={{flex: 1}}>
      <SectionList
        contentContainerStyle={[styles.scrollContent, {paddingBottom: 100}]}
        sections={sections}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        ItemSeparatorComponent={AppListSeparator}
        keyExtractor={app => app.packageName}
        renderSectionHeader={({section: {title}}) => (
          <Text style={[styles.sectionTitle, localStyles.sectionHeader]}>{title}</Text>
        )}
        ListHeaderComponent={
          <>
            {!hideHeader && (
              <View style={styles.topBar}>
                <Text style={styles.eyebrow}>{t('stepThree')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onOpenSettings}
                  style={styles.themeToggle}>
                  <View style={styles.menuIcon}>
                    <View style={styles.menuBar} />
                    <View style={styles.menuBar} />
                    <View style={styles.menuBar} />
                  </View>
                </Pressable>
              </View>
            )}
            <Text style={styles.title}>{t('appSelectionTitle')}</Text>
            <Text style={styles.body}>{t('appSelectionBody')}</Text>
            {isLoadingApps ? (
              <Text style={styles.helperText}>Loading installed apps...</Text>
            ) : null}
          </>
        }
        renderItem={renderAppRow}
        showsVerticalScrollIndicator={false}
      />
      <View style={[localStyles.fixedFooter, {backgroundColor: colors.background, borderTopColor: colors.border}]}>
        <PrimaryButton
          disabled={selectedPackageNames.length === 0}
          label={`${t('continueWith')} ${selectedPackageNames.length} ${
            selectedPackageNames.length === 1 ? t('appSingular') : t('appPlural')
          }`}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fixedFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
});

function AppListSeparator() {
  const {styles} = useAppTheme();

  return <View style={styles.appListSeparator} />;
}
