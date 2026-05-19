import {NativeModules} from 'react-native';
import type {AppPreferencesBridge, UsageStatsBridge} from '../types';

export const UsageStatsModule = NativeModules.UsageStatsModule as
  | UsageStatsBridge
  | undefined;

export const AppPreferencesModule = NativeModules.AppPreferencesModule as
  | AppPreferencesBridge
  | undefined;
