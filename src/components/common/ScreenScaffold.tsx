import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

export function ScreenScaffold({
  eyebrow,
  headerTitle,
  title,
  body,
  children,
  onOpenSettings,
  hideHeader = false,
  fixedHeader = false,
  scrollRef,
}: {
  eyebrow: string;
  headerTitle?: string;
  title: string;
  body: string;
  children: React.ReactNode;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
  fixedHeader?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const { styles } = useAppTheme();

  const header = !hideHeader ? (
    <View
      style={[styles.topBar, fixedHeader && localStyles.fixedHeaderPadding]}
    >
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
  ) : null;

  const scrollContent = (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.scrollContent,
        fixedHeader && !hideHeader && localStyles.fixedHeaderScrollContent,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {!fixedHeader && header}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children}
    </ScrollView>
  );

  if (fixedHeader && !hideHeader) {
    return (
      <View style={styles.appShell}>
        {header}
        {scrollContent}
      </View>
    );
  }

  return scrollContent;
}

const localStyles = StyleSheet.create({
  fixedHeaderPadding: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  fixedHeaderScrollContent: {
    paddingTop: 0,
  },
});
