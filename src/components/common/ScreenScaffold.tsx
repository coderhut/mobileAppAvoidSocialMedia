import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

export function ScreenScaffold({
  eyebrow,
  headerTitle,
  title,
  body,
  children,
  onGoHome,
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
  onGoHome?: () => void;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
  fixedHeader?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const { colors, styles } = useAppTheme();

  const header = !hideHeader ? (
    <View
      style={[styles.topBar, fixedHeader && localStyles.fixedHeaderPadding]}
    >
      <Text
        style={[
          headerTitle ? styles.sectionTitle : styles.eyebrow,
          localStyles.headerTitle,
        ]}
      >
        {headerTitle ?? eyebrow}
      </Text>
      <View style={localStyles.headerActions}>
        {onGoHome && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Home"
            onPress={onGoHome}
            style={styles.themeToggle}
          >
            <View style={localStyles.homeIcon}>
              <View
                style={[localStyles.homeRoof, { borderColor: colors.primary }]}
              />
              <View
                style={[localStyles.homeBase, { borderColor: colors.primary }]}
              />
            </View>
          </Pressable>
        )}
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
  headerTitle: {
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  homeIcon: {
    height: 28,
    width: 28,
  },
  homeRoof: {
    borderLeftWidth: 2.5,
    borderTopWidth: 2.5,
    height: 15,
    left: 6,
    position: 'absolute',
    top: 3,
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  homeBase: {
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    bottom: 4,
    height: 11,
    left: 7,
    position: 'absolute',
    width: 14,
  },
  fixedHeaderPadding: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  fixedHeaderScrollContent: {
    paddingTop: 0,
  },
});
