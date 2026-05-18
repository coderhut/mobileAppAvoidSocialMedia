import React from 'react';
import type {
  LanguageCode,
  ThemeColors,
  ThemeMode,
  ThemePreference,
  TranslationKey,
} from '../types';
import type {createThemedStyles} from './styles';

export type AppTheme = {
  colors: ThemeColors;
  language: LanguageCode;
  mode: ThemeMode;
  setLanguage: (language: LanguageCode) => void;
  setThemePreference: (preference: ThemePreference) => void;
  styles: ReturnType<typeof createThemedStyles>;
  t: (key: TranslationKey) => string;
  themePreference: ThemePreference;
};

export const AppThemeContext = React.createContext<AppTheme | null>(null);

export function useAppTheme() {
  const theme = React.useContext(AppThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used inside AppThemeContext.Provider');
  }

  return theme;
}
