import React from 'react';
import {SectionList, Pressable, Text, View, Image} from 'react-native';
import {PrimaryButton} from '../common/PrimaryButton';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import type {TrackableApp} from '../../types';

const RENOWNED_APPS = [
  'com.instagram.android',
  'com.instagram.lite',
  'com.zhiliaoapp.musically',
  'com.zhiliaoapp.musically.go',
  'com.ss.android.ugc.trill',
  'com.facebook.katana',
  'com.facebook.lite',
  'com.google.android.youtube',
  'com.google.android.apps.youtube.mango',
  'com.snapchat.android',
  'com.twitter.android',
  'com.twitter.android.lite',
  'com.reddit.frontpage',
  'com.pinterest',
  'com.linkedin.android',
  'com.netflix.mediaclient',
];

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
  const {colors, styles, t} = useAppTheme();
  const {selectedPackageNames, toggleApp} = useSettings();

  const selectedPackageSet = React.useMemo(
    () => new Set(selectedPackageNames),
    [selectedPackageNames],
  );

  const sections = React.useMemo(() => {
    const renowned: TrackableApp[] = [];
    const others: TrackableApp[] = [];

    availableApps.forEach(app => {
      if (RENOWNED_APPS.includes(app.packageName)) {
        renowned.push(app);
      } else {
        others.push(app);
      }
    });

    const result = [];
    if (renowned.length > 0) {
      result.push({title: t('suggestedApps'), data: renowned});
    }
    if (others.length > 0) {
      result.push({title: t('otherApps'), data: others});
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
        initialNumToRender={20}
        ItemSeparatorComponent={AppListSeparator}
        keyExtractor={app => app.packageName}
        renderSectionHeader={({section: {title}}) => (
          <View style={{backgroundColor: colors.background, paddingVertical: 12}}>
            <Text style={[styles.sectionTitle, {color: colors.primary}]}>{title}</Text>
          </View>
        )}
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
        stickySectionHeadersEnabled={true}
        renderItem={renderAppRow}
        showsVerticalScrollIndicator={false}
        windowSize={9}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 24,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
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

function AppListSeparator() {
  const {styles} = useAppTheme();

  return <View style={styles.appListSeparator} />;
}
