import React from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';

export function ScreenScaffold({
  eyebrow,
  title,
  body,
  children,
  onOpenSettings,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
  onOpenSettings: () => void;
}) {
  const {styles, t} = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={styles.themeToggle}>
          <Text style={styles.themeToggleText}>{t('settings')}</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </ScrollView>
  );
}
