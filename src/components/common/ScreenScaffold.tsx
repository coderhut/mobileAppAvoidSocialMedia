import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

export function ScreenScaffold({
  eyebrow,
  title,
  body,
  children,
  onOpenSettings,
  hideHeader = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
}) {
  const { styles } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {!hideHeader && (
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={styles.themeToggle}
          >
            <View style={styles.menuIcon}>
              <View style={styles.menuBar} />
              <View style={styles.menuBar} />
              <View style={styles.menuBar} />
            </View>
          </Pressable>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </ScrollView>
  );
}
