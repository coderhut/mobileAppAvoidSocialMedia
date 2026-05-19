import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';

export function AppHeader({
  title,
  onOpenSettings,
}: {
  title: string;
  onOpenSettings: () => void;
}) {
  const {styles} = useAppTheme();

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={styles.hamburgerButton}>
        <View style={styles.hamburgerIcon}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </View>
      </Pressable>
    </View>
  );
}
