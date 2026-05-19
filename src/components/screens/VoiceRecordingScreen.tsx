import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import {useAppTheme} from '../../theme/ThemeContext';
import {useSettings} from '../../contexts/SettingsContext';
import {AudioModule} from '../../native/modules';
import {PrimaryButton} from '../common/PrimaryButton';
import {ScreenScaffold} from '../common/ScreenScaffold';

const MAX_DURATION_SEC = 15;
const MIN_DURATION_MS = 1000;

export function VoiceRecordingScreen({
  onContinue,
  onOpenSettings,
}: {
  onContinue: () => void;
  onOpenSettings: () => void;
}) {
  const {colors, styles, t} = useAppTheme();
  const {voiceNotes, saveVoiceNote, deleteVoiceNote} = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [activeSlot, setActiveSlot] = useState<{level: number; index: number} | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      AudioModule?.stopPlayer().catch(() => undefined);
      AudioModule?.stopRecording().catch(() => undefined);
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const onStartRecord = async (level: number, index: number) => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs access to your microphone to record your voice notes.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone access is required to record voice notes.');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }

    setActiveSlot({level, index});
    setIsRecording(true);
    setRecordTime('00:00');
    startTimeRef.current = Date.now();

    const path = `${RNFS.DocumentDirectoryPath}/voice_level${level}_${index}.mp4`;

    try {
      // Ensure the directory exists (though DocumentDirectory usually does)
      const folderPath = RNFS.DocumentDirectoryPath;
      const exists = await RNFS.exists(folderPath);
      if (!exists) {
        await RNFS.mkdir(folderPath);
      }

      await AudioModule?.startRecording(path);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setRecordTime(formatTime(elapsed));

        if (elapsed >= MAX_DURATION_SEC * 1000) {
          onStopRecord();
        }
      }, 100);
    } catch (err) {
      console.error('Failed to start recorder', err);
      setIsRecording(false);
      setActiveSlot(null);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const onStopRecord = async () => {
    if (!isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await AudioModule?.stopRecording();
      setIsRecording(false);

      const slot = activeSlot;
      const path = `${RNFS.DocumentDirectoryPath}/voice_level${slot?.level}_${slot?.index}.mp4`;
      setActiveSlot(null);
      setRecordTime('00:00');

      if (slot) {
        saveVoiceNote(slot.level, path);
      }
    } catch (err) {
      console.error('Failed to stop recorder', err);
      setIsRecording(false);
    }
  };

  const onPlayBack = async (path: string) => {
    try {
      await AudioModule?.startPlayer(path);
    } catch (err) {
      console.error('Failed to play', err);
    }
  };

  const isLevelComplete = (level: number) => {
    return (voiceNotes[level] || []).length > 0;
  };

  const canContinue = isLevelComplete(1) && isLevelComplete(2) && isLevelComplete(3);

  const handleContinue = () => {
    if (canContinue) {
      onContinue();
    } else {
      Alert.alert(t('appName'), t('minRecordingsAlert'));
    }
  };

  const renderSlot = (level: number, index: number) => {
    const notes = voiceNotes[level] || [];
    const isRecorded = notes.length > index;
    const isActive = activeSlot?.level === level && activeSlot?.index === index;
    const isRequired = index === 0;

    return (
      <View key={`${level}-${index}`} style={localStyles.slotContainer}>
        <View style={localStyles.slotInfo}>
          <Text style={[styles.appName, {color: isRecorded ? colors.success : colors.text}]}>
            {isRequired ? t('required') : t('optional')} {index + 1}
          </Text>
          {isRecorded && (
            <Pressable onPress={() => onPlayBack(notes[index])}>
              <Text style={[styles.linkText, {fontSize: 14}]}>▶ Play</Text>
            </Pressable>
          )}
        </View>

        <View style={localStyles.slotActions}>
          {isRecorded ? (
            <Pressable onPress={() => deleteVoiceNote(level, index)}>
              <Text style={{color: '#EF4444', fontWeight: '800'}}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable
              onPressIn={() => onStartRecord(level, index)}
              onPressOut={onStopRecord}
              style={[
                localStyles.recordButton,
                {backgroundColor: isActive ? '#EF4444' : colors.primary},
              ]}>
              <Text style={localStyles.recordButtonText}>
                {isActive ? t('releaseToStop') : t('holdToRecord')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenScaffold
      eyebrow={t('stepThree')}
      title={t('recordingsTitle')}
      body={t('recordingsBody')}
      onOpenSettings={onOpenSettings}>

      <View style={localStyles.levelSection}>
        <Text style={styles.sectionTitle}>{t('level1Title')}</Text>
        <Text style={styles.appCategory}>{t('level1Desc')}</Text>
        <View style={localStyles.slotsList}>
          {[0, 1, 2].map((i) => renderSlot(1, i))}
        </View>
      </View>

      <View style={localStyles.levelSection}>
        <Text style={styles.sectionTitle}>{t('level2Title')}</Text>
        <Text style={styles.appCategory}>{t('level2Desc')}</Text>
        <View style={localStyles.slotsList}>
          {[0, 1, 2].map((i) => renderSlot(2, i))}
        </View>
      </View>

      <View style={localStyles.levelSection}>
        <Text style={styles.sectionTitle}>{t('level3Title')}</Text>
        <Text style={styles.appCategory}>{t('level3Desc')}</Text>
        <View style={localStyles.slotsList}>
          {[0, 1, 2].map((i) => renderSlot(3, i))}
        </View>
      </View>

      {isRecording && (
        <View style={[localStyles.recordingOverlay, {backgroundColor: colors.surface}]}>
          <ActivityIndicator color="#EF4444" size="large" />
          <Text style={[styles.title, {marginTop: 20, color: '#EF4444'}]}>{recordTime}</Text>
          <Text style={styles.body}>{t('releaseToStop')}</Text>
        </View>
      )}

      <PrimaryButton
        disabled={!canContinue}
        label={t('finishSetup')}
        onPress={handleContinue}
      />
    </ScreenScaffold>
  );
}

const localStyles = StyleSheet.create({
  levelSection: {
    marginBottom: 32,
  },
  slotsList: {
    marginTop: 16,
    gap: 12,
  },
  slotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotActions: {
    marginLeft: 16,
  },
  recordButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});
