import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

export function ScreenScaffold({
  eyebrow,
  headerTitle,
  title,
  body,
  children,
  onOpenSettings,
  hideHeader = false,
  scrollRef,
}: {
  eyebrow: string;
  headerTitle?: string;
  title: string;
  body: string;
  children: React.ReactNode;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const { styles } = useAppTheme();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {!hideHeader && (
        <View style={styles.topBar}>
          <Text style={headerTitle ? styles.sectionTitle : styles.eyebrow}>
            {headerTitle ?? eyebrow}
          </Text>
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
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children}
    </ScrollView>
  );
}
