import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import RNFS from 'react-native-fs';
import {AppPreferencesModule} from '../native/modules';
import type {DailyLimitSetting, DailyLimitSettings} from '../types';
import {normalizeDailyLimitSetting, parseDailyLimitSettings} from '../utils/dailyLimits';

type SettingsContextType = {
  selectedPackageNames: string[];
  toggleApp: (packageName: string) => void;
  setSelectedPackageNames: (packageNames: string[]) => void;
  dailyLimitSettings: DailyLimitSettings;
  updateDailyLimitSetting: (packageName: string, setting: DailyLimitSetting) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  voiceNotes: Record<number, Record<number, string>>;
  saveVoiceNote: (level: number, index: number, filePath: string) => void;
  deleteVoiceNote: (level: number, index: number) => void;
  globalDailyLimit: number;
  setGlobalDailyLimit: (limit: number) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({children}: {children: React.ReactNode}) {
  const [selectedPackageNames, setSelectedPackageNamesState] = useState<string[]>([
    'com.instagram.android',
    'com.google.android.youtube',
  ]);
  const [dailyLimitSettings, setDailyLimitSettings] = useState<DailyLimitSettings>({});
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [voiceNotes, setVoiceNotesState] = useState<Record<number, Record<number, string>>>({
    1: {},
    2: {},
    3: {},
  });
  const [globalDailyLimit, setGlobalDailyLimitState] = useState<number>(30); // Default 30 mins

  useEffect(() => {
    AppPreferencesModule?.getPreferences()
      .then(preferences => {
        if (Array.isArray(preferences.selectedPackageNames)) {
          setSelectedPackageNamesState(preferences.selectedPackageNames);
        }

        if (isThemePreference(preferences.themePreference)) {
          setThemePreferenceState(preferences.themePreference);
        }

        if (isLanguageCode(preferences.language)) {
          setLanguageState(preferences.language);
        }

        if (preferences.globalDailyLimit !== undefined && preferences.globalDailyLimit > 0) {
          setGlobalDailyLimitState(preferences.globalDailyLimit);
        }

        if (preferences.voiceNotes) {
          try {
            const parsed = JSON.parse(preferences.voiceNotes);
            setVoiceNotesState(parsed);
          } catch (e) {
            console.error('Failed to parse voice notes', e);
          }
        }

        setDailyLimitSettings(
          parseDailyLimitSettings(preferences.dailyLimitSettings),
        );
      })
      .catch(() => undefined);
  }, []);

  const setSelectedPackageNames = useCallback((nextPackageNames: string[]) => {
    setSelectedPackageNamesState(nextPackageNames);
    AppPreferencesModule?.setSelectedPackageNames(nextPackageNames).catch(() => undefined);
  }, []);

  const toggleApp = useCallback((packageName: string) => {
    setSelectedPackageNamesState(current => {
      const nextPackageNames = current.includes(packageName)
        ? current.filter(selectedPackageName => selectedPackageName !== packageName)
        : [...current, packageName];

      AppPreferencesModule?.setSelectedPackageNames(nextPackageNames).catch(() => undefined);
      return nextPackageNames;
    });
  }, []);

  const updateDailyLimitSetting = useCallback((packageName: string, setting: DailyLimitSetting) => {
    setDailyLimitSettings(current => {
      const nextSettings = {
        ...current,
        [packageName]: normalizeDailyLimitSetting(setting),
      };

      AppPreferencesModule?.setDailyLimitSettings(JSON.stringify(nextSettings)).catch(() => undefined);
      return nextSettings;
    });
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    AppPreferencesModule?.setThemePreference(preference).catch(() => undefined);
  }, []);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    AppPreferencesModule?.setLanguage(nextLanguage).catch(() => undefined);
  }, []);

  const saveVoiceNote = useCallback((level: number, index: number, filePath: string) => {
    setVoiceNotesState(current => {
      const levelNotes = {...(current[level] || {})};
      levelNotes[index] = filePath;
      const nextNotes = {
        ...current,
        [level]: levelNotes,
      };
      AppPreferencesModule?.setVoiceNotes(JSON.stringify(nextNotes)).catch(() => undefined);
      return nextNotes;
    });
  }, []);

  const deleteVoiceNote = useCallback(async (level: number, index: number) => {
    let filePathToDelete: string | null = null;

    setVoiceNotesState(current => {
      const levelNotes = {...(current[level] || {})};
      filePathToDelete = levelNotes[index];
      delete levelNotes[index];

      const nextNotes = {
        ...current,
        [level]: levelNotes,
      };
      AppPreferencesModule?.setVoiceNotes(JSON.stringify(nextNotes)).catch(() => undefined);
      return nextNotes;
    });

    if (filePathToDelete) {
      try {
        const exists = await RNFS.exists(filePathToDelete);
        if (exists) {
          await RNFS.unlink(filePathToDelete);
          console.log('Deleted file:', filePathToDelete);
        }
      } catch (e) {
        console.error('Failed to delete voice note file', e);
      }
    }
  }, []);

  const setGlobalDailyLimit = useCallback((limit: number) => {
    setGlobalDailyLimitState(limit);
    AppPreferencesModule?.setGlobalDailyLimit(limit).catch(() => undefined);
  }, []);

  const value = {
    selectedPackageNames,
    toggleApp,
    setSelectedPackageNames,
    dailyLimitSettings,
    updateDailyLimitSetting,
    themePreference,
    setThemePreference,
    language,
    setLanguage,
    voiceNotes,
    saveVoiceNote,
    deleteVoiceNote,
    globalDailyLimit,
    setGlobalDailyLimit,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'en' || value === 'ur';
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
