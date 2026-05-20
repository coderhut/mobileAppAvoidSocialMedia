import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';
import type {LanguageCode} from '../../types';

export function LanguageSelectionScreen({
  onSelect,
}: {
  onSelect: (language: LanguageCode) => void;
}) {
  const {colors, styles} = useAppTheme();

  return (
    <View style={[styles.safeArea, localStyles.container]}>
      <View style={localStyles.content}>
        <Text style={[styles.title, localStyles.title]}>Choose your language</Text>
        <Text style={[styles.body, localStyles.subtitle]}>
          اپنی زبان منتخب کریں۔
        </Text>

        <View style={localStyles.grid}>
          <LanguageCard
            label="English"
            onPress={() => onSelect('en')}
            colors={colors}
          />
          <LanguageCard
            label="اردو"
            onPress={() => onSelect('ur')}
            colors={colors}
          />
        </View>
      </View>
    </View>
  );
}

function LanguageCard({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        localStyles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={[localStyles.cardLabel, {color: colors.text}]}>{label}</Text>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 48,
  },
  grid: {
    width: '100%',
    gap: 16,
  },
  card: {
    width: '100%',
    paddingVertical: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 24,
    fontWeight: '800',
  },
});
