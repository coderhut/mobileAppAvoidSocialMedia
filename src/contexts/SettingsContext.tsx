import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import RNFS from 'react-native-fs';
import { AppPreferencesModule } from '../native/modules';
import type {
  DailyLimitSetting,
  DailyLimitSettings,
  LanguageCode,
  ThemePreference,
} from '../types';
import {
  normalizeDailyLimitSetting,
  parseDailyLimitSettings,
} from '../utils/dailyLimits';

type SettingsContextType = {
  selectedPackageNames: string[];
  toggleApp: (packageName: string) => void;
  setSelectedPackageNames: (packageNames: string[]) => void;
  dailyLimitSettings: DailyLimitSettings;
  updateDailyLimitSetting: (
    packageName: string,
    setting: DailyLimitSetting,
  ) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  isLoadingPreferences: boolean;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;
  voiceNotes: Record<number, Record<number, string>>;
  saveVoiceNote: (level: number, index: number, filePath: string) => void;
  deleteVoiceNote: (level: number, index: number) => void;
  globalDailyLimit: number;
  setGlobalDailyLimit: (limit: number) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [selectedPackageNames, setSelectedPackageNamesState] = useState<
    string[]
  >(['com.instagram.android', 'com.google.android.youtube']);
  const [dailyLimitSettings, setDailyLimitSettings] =
    useState<DailyLimitSettings>({});
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>('system');
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [isLoadingPreferences, setIsLoadingPreferences] =
    useState<boolean>(true);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] =
    useState<boolean>(false);
  const [voiceNotes, setVoiceNotesState] = useState<
    Record<number, Record<number, string>>
  >({
    1: {},
    2: {},
    3: {},
  });
  const voiceNotesRef = useRef(voiceNotes);
  const [globalDailyLimit, setGlobalDailyLimitState] = useState<number>(30); // Default 30 mins

  useEffect(() => {
    if (!AppPreferencesModule) {
      setIsLoadingPreferences(false);
      return;
    }

    AppPreferencesModule.getPreferences()
      .then(preferences => {
        if (Array.isArray(preferences.selectedPackageNames)) {
          setSelectedPackageNamesState(preferences.selectedPackageNames);
        }

        if (isThemePreference(preferences.themePreference)) {
          setThemePreferenceState(
            preferences.themePreference as ThemePreference,
          );
        }

        if (isLanguageCode(preferences.language)) {
          setLanguageState(preferences.language as LanguageCode);
        }

        if (preferences.hasCompletedOnboarding === true) {
          setHasCompletedOnboardingState(true);
        }

        if (
          preferences.globalDailyLimit !== undefined &&
          preferences.globalDailyLimit > 0
        ) {
          setGlobalDailyLimitState(preferences.globalDailyLimit);
        }

        if (preferences.voiceNotes) {
          try {
            const parsed = JSON.parse(preferences.voiceNotes);
            const normalized = normalizeVoiceNotes(parsed);
            voiceNotesRef.current = normalized;
            setVoiceNotesState(normalized);
          } catch (e) {
            console.error('Failed to parse voice notes', e);
          }
        }

        setDailyLimitSettings(
          parseDailyLimitSettings(preferences.dailyLimitSettings),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        setIsLoadingPreferences(false);
      });
  }, []);

  useEffect(() => {
    voiceNotesRef.current = voiceNotes;
  }, [voiceNotes]);

  const setSelectedPackageNames = useCallback((nextPackageNames: string[]) => {
    setSelectedPackageNamesState(nextPackageNames);
    AppPreferencesModule?.setSelectedPackageNames(nextPackageNames).catch(
      () => undefined,
    );
  }, []);

  const toggleApp = useCallback((packageName: string) => {
    setSelectedPackageNamesState(current => {
      const nextPackageNames = current.includes(packageName)
        ? current.filter(
            selectedPackageName => selectedPackageName !== packageName,
          )
        : [...current, packageName];

      AppPreferencesModule?.setSelectedPackageNames(nextPackageNames).catch(
        () => undefined,
      );
      return nextPackageNames;
    });
  }, []);

  const updateDailyLimitSetting = useCallback(
    (packageName: string, setting: DailyLimitSetting) => {
      setDailyLimitSettings(current => {
        const nextSettings = {
          ...current,
          [packageName]: normalizeDailyLimitSetting(setting),
        };

        AppPreferencesModule?.setDailyLimitSettings(
          JSON.stringify(nextSettings),
        ).catch(() => undefined);
        return nextSettings;
      });
    },
    [],
  );

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    AppPreferencesModule?.setThemePreference(preference).catch(() => undefined);
  }, []);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    AppPreferencesModule?.setLanguage(nextLanguage).catch(() => undefined);
  }, []);

  const setHasCompletedOnboarding = useCallback((completed: boolean) => {
    setHasCompletedOnboardingState(completed);
    AppPreferencesModule?.setHasCompletedOnboarding(completed).catch(
      () => undefined,
    );
  }, []);

  const saveVoiceNote = useCallback(
    (level: number, index: number, filePath: string) => {
      setVoiceNotesState(current => {
        const levelNotes = { ...(current[level] || {}) };
        levelNotes[index] = filePath;
        const nextNotes = {
          ...current,
          [level]: levelNotes,
        };
        AppPreferencesModule?.setVoiceNotes(JSON.stringify(nextNotes)).catch(
          () => undefined,
        );
        voiceNotesRef.current = nextNotes;
        return nextNotes;
      });
    },
    [],
  );

  const deleteVoiceNote = useCallback(async (level: number, index: number) => {
    const filePathToDelete = voiceNotesRef.current[level]?.[index] ?? null;

    setVoiceNotesState(current => {
      const levelNotes = { ...(current[level] || {}) };
      delete levelNotes[index];

      const nextNotes = {
        ...current,
        [level]: levelNotes,
      };
      AppPreferencesModule?.setVoiceNotes(JSON.stringify(nextNotes)).catch(
        () => undefined,
      );
      voiceNotesRef.current = nextNotes;
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
    isLoadingPreferences,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    voiceNotes,
    saveVoiceNote,
    deleteVoiceNote,
    globalDailyLimit,
    setGlobalDailyLimit,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function normalizeVoiceNotes(
  value: unknown,
): Record<number, Record<number, string>> {
  const normalized: Record<number, Record<number, string>> = {
    1: {},
    2: {},
    3: {},
  };

  if (!value || typeof value !== 'object') {
    return normalized;
  }

  [1, 2, 3].forEach(level => {
    const levelValue =
      (value as Record<string, unknown>)[String(level)] ??
      (value as Record<number, unknown>)[level];

    if (Array.isArray(levelValue)) {
      levelValue.forEach((filePath, index) => {
        if (typeof filePath === 'string' && filePath.length > 0) {
          normalized[level][index] = filePath;
        }
      });
      return;
    }

    if (levelValue && typeof levelValue === 'object') {
      Object.entries(levelValue as Record<string, unknown>).forEach(
        ([index, filePath]) => {
          const numericIndex = Number(index);
          if (
            Number.isInteger(numericIndex) &&
            typeof filePath === 'string' &&
            filePath.length > 0
          ) {
            normalized[level][numericIndex] = filePath;
          }
        },
      );
    }
  });

  return normalized;
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
