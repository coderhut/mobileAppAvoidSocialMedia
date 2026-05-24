import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { useAppTheme } from '../../theme/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { ScreenScaffold } from '../common/ScreenScaffold';
import { WaveformVisualizer } from '../common/WaveformVisualizer';

const MAX_DURATION_SEC = 15;

export function VoiceRecordingScreen({
  onContinue,
  onBack,
  onOpenSettings,
  hideHeader = false,
}: {
  onContinue: () => void;
  onBack: () => void;
  onOpenSettings?: () => void;
  hideHeader?: boolean;
}) {
  const { colors, t } = useAppTheme();
  const { voiceNotes, saveVoiceNote, deleteVoiceNote } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [activeSlot, setActiveSlot] = useState<{
    level: number;
    index: number;
  } | null>(null);
  const [startingSlot, setStartingSlot] = useState<{
    level: number;
    index: number;
  } | null>(null);
  const [playingSlot, setPlayingSlot] = useState<{
    level: number;
    index: number;
  } | null>(null);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const activeSlotRef = useRef<{ level: number; index: number } | null>(null);
  const isStoppingRef = useRef(false);

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  useEffect(() => {
    return () => {
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.removePlayBackListener();
      if (isRecordingRef.current) {
        audioRecorderPlayer.stopRecorder().catch(() => undefined);
      }
      audioRecorderPlayer.stopPlayer().catch(() => undefined);
    };
  }, [audioRecorderPlayer]);

  const ensureMicrophonePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const hasPermission = await PermissionsAndroid.check(permission);

    if (hasPermission) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const onStartRecord = async (level: number, index: number) => {
    if (isStartingRef.current || isRecordingRef.current) {
      return;
    }

    isStartingRef.current = true;
    setStartingSlot({ level, index });
    try {
      const hasPermission = await ensureMicrophonePermission();

      if (!hasPermission) {
        Alert.alert(t('appName'), t('microphoneDesc'));
        return;
      }

      const slot = { level, index };
      activeSlotRef.current = slot;
      setActiveSlot(slot);
      setIsRecording(true);
      setIsPaused(false);
      setRecordTime('00:00');

      const path = Platform.select({
        android: `${RNFS.DocumentDirectoryPath}/voice_level${level}_${index}.mp4`,
        ios: `voice_level${level}_${index}.m4a`,
      });

      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
      };

      await audioRecorderPlayer.startRecorder(path, audioSet);
      isRecordingRef.current = true;
      audioRecorderPlayer.addRecordBackListener(e => {
        const seconds = Math.floor(e.currentPosition / 1000);
        const mm = Math.floor(seconds / 60)
          .toString()
          .padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        setRecordTime(`${mm}:${ss}`);

        if (e.currentPosition >= MAX_DURATION_SEC * 1000) {
          onStopRecord();
        }
      });
    } catch (err) {
      console.error('Failed to start recorder', err);
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setIsPaused(false);
      isRecordingRef.current = false;
      activeSlotRef.current = null;
      setActiveSlot(null);
    } finally {
      isStartingRef.current = false;
      setStartingSlot(null);
    }
  };

  const onPauseRecord = async () => {
    try {
      await audioRecorderPlayer.pauseRecorder();
      setIsPaused(true);
    } catch (err) {
      console.error('Failed to pause recorder', err);
    }
  };

  const onResumeRecord = async () => {
    try {
      await audioRecorderPlayer.resumeRecorder();
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to resume recorder', err);
    }
  };

  const onStopRecord = async () => {
    if (!isRecordingRef.current || isStoppingRef.current) return;

    isStoppingRef.current = true;
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setIsPaused(false);
      isRecordingRef.current = false;

      const slot = activeSlotRef.current;
      activeSlotRef.current = null;
      setActiveSlot(null);
      setRecordTime('00:00');

      if (slot) {
        saveVoiceNote(slot.level, slot.index, result);
      }
    } catch (err) {
      console.error('Failed to stop recorder', err);
      setIsRecording(false);
      setIsPaused(false);
      isRecordingRef.current = false;
      activeSlotRef.current = null;
      setActiveSlot(null);
      setRecordTime('00:00');
    } finally {
      isStoppingRef.current = false;
    }
  };

  const onPlayBack = async (path: string, level: number, index: number) => {
    try {
      audioRecorderPlayer.removePlayBackListener();
      await audioRecorderPlayer.stopPlayer().catch(() => undefined);
      await audioRecorderPlayer.startPlayer(path);
      setPlayingSlot({ level, index });
      setIsPlaybackPaused(false);
      audioRecorderPlayer.addPlayBackListener(e => {
        if (e.duration > 0 && e.currentPosition >= e.duration) {
          audioRecorderPlayer.removePlayBackListener();
          audioRecorderPlayer.stopPlayer();
          setPlayingSlot(null);
          setIsPlaybackPaused(false);
        }
      });
    } catch (err) {
      setPlayingSlot(null);
      setIsPlaybackPaused(false);
      console.error('Failed to play', err);
    }
  };

  const onPauseBack = async () => {
    try {
      await audioRecorderPlayer.pausePlayer();
    } catch (err) {
      console.error('Failed to pause playback', err);
    }
    setIsPlaybackPaused(true);
  };

  const onResumeBack = async () => {
    try {
      await audioRecorderPlayer.resumePlayer();
      setIsPlaybackPaused(false);
    } catch (err) {
      console.error('Failed to resume playback', err);
    }
  };

  const onStopBack = async () => {
    try {
      audioRecorderPlayer.removePlayBackListener();
      await audioRecorderPlayer.stopPlayer();
    } catch (err) {
      console.error('Failed to stop playback', err);
    } finally {
      setPlayingSlot(null);
      setIsPlaybackPaused(false);
    }
  };

  const isLevelComplete = (level: number) => {
    const notes = voiceNotes[level] || {};
    return Object.keys(notes).length > 0;
  };

  const canContinue =
    isLevelComplete(1) && isLevelComplete(2) && isLevelComplete(3);

  const handleContinue = () => {
    if (canContinue) {
      onContinue();
    } else {
      Alert.alert(t('appName'), t('minRecordingsAlert'));
    }
  };

  const renderSlot = (level: number, index: number) => {
    const notes = voiceNotes[level] || {};
    const path = notes[index];
    const isRecorded = !!path;
    const isStarting =
      startingSlot?.level === level && startingSlot?.index === index;
    const isPlaying =
      playingSlot?.level === level && playingSlot?.index === index;

    return (
      <View
        key={`${level}-${index}`}
        style={[
          localStyles.slotCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={localStyles.slotHeader}>
          <View
            style={[
              localStyles.slotNumber,
              { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Text
              style={[localStyles.slotNumberText, { color: colors.primary }]}
            >
              {index + 1}
            </Text>
          </View>
          <Text style={[localStyles.slotLabel, { color: colors.text }]}>
            {index === 0 ? t('required') : t('optional')}
          </Text>
          {isRecorded && (
            <Pressable
              onPress={() => deleteVoiceNote(level, index)}
              style={localStyles.deleteIcon}
            >
              <Text style={{ color: '#EF4444', fontWeight: '800' }}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={localStyles.slotActions}>
          {isRecorded ? (
            isPlaying ? (
              <View style={localStyles.playbackControls}>
                <Pressable
                  onPress={isPlaybackPaused ? onResumeBack : onPauseBack}
                  style={[
                    localStyles.playbackButton,
                    { backgroundColor: colors.primary + '15' },
                  ]}
                >
                  <Text
                    style={[
                      localStyles.playButtonText,
                      { color: colors.primary },
                    ]}
                  >
                    {isPlaybackPaused ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onStopBack}
                  style={[
                    localStyles.playbackButton,
                    { backgroundColor: '#EF444415' },
                  ]}
                >
                  <Text
                    style={[localStyles.playButtonText, { color: '#EF4444' }]}
                  >
                    Stop
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => onPlayBack(path, level, index)}
                style={[
                  localStyles.playButton,
                  { backgroundColor: colors.primary + '15' },
                ]}
              >
                <Text
                  style={[
                    localStyles.playButtonText,
                    { color: colors.primary },
                  ]}
                >
                  Play Recording
                </Text>
              </Pressable>
            )
          ) : (
            <Pressable
              disabled={!!startingSlot}
              onPress={() => onStartRecord(level, index)}
              style={[
                localStyles.recordButton,
                { backgroundColor: colors.primary },
                !!startingSlot && !isStarting && localStyles.disabledButton,
              ]}
            >
              {isStarting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={localStyles.recordButtonText}>
                  {t('startRecordingLabel')}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenScaffold
      eyebrow={hideHeader ? t('stepTwo') : ''}
      title={t('recordingsTitle')}
      body={t('recordingsBody')}
      onOpenSettings={onOpenSettings}
      hideHeader={hideHeader}
    >
      <LevelSection
        title={t('level1Title')}
        desc={t('level1Desc')}
        level={1}
        renderSlot={renderSlot}
        colors={colors}
      />

      <LevelSection
        title={t('level2Title')}
        desc={t('level2Desc')}
        level={2}
        renderSlot={renderSlot}
        colors={colors}
      />

      <LevelSection
        title={t('level3Title')}
        desc={t('level3Desc')}
        level={3}
        renderSlot={renderSlot}
        colors={colors}
      />

      <Modal visible={isRecording} transparent={false} animationType="fade">
        <View
          style={[
            localStyles.recordingOverlay,
            { backgroundColor: colors.background },
          ]}
        >
          <Text style={[localStyles.overlayTitle, { color: colors.text }]}>
            Recording Slot {(activeSlot?.index ?? 0) + 1}
          </Text>

          <WaveformVisualizer isRecording={!isPaused} colors={colors} />

          <Text style={[localStyles.recordTimer, { color: colors.text }]}>
            {recordTime}
          </Text>

          <View style={localStyles.controlGroup}>
            {isPaused ? (
              <Pressable
                onPress={onResumeRecord}
                style={[
                  localStyles.controlBtn,
                  { backgroundColor: colors.success },
                ]}
              >
                <Text style={localStyles.controlBtnText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onPauseRecord}
                style={[
                  localStyles.controlBtn,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text
                  style={[localStyles.controlBtnText, { color: colors.text }]}
                >
                  Pause
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={onStopRecord}
              style={[localStyles.controlBtn, { backgroundColor: '#EF4444' }]}
            >
              <Text style={localStyles.controlBtnText}>Stop & Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={{ marginTop: 20, marginBottom: 20 }}>
        <View style={localStyles.buttonRow}>
          <View style={localStyles.buttonCell}>
            <SecondaryButton label="Go Back" onPress={onBack} />
          </View>
          <View style={localStyles.buttonCell}>
            <PrimaryButton
              disabled={!canContinue}
              label={t('continueLabel')}
              onPress={handleContinue}
            />
          </View>
        </View>
      </View>
    </ScreenScaffold>
  );
}

function LevelSection({ title, desc, level, renderSlot, colors }: any) {
  return (
    <View style={localStyles.levelSection}>
      <Text style={[localStyles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[localStyles.sectionDesc, { color: colors.mutedText }]}>
        {desc}
      </Text>
      <View style={localStyles.slotsList}>
        {[0, 1, 2].map(i => renderSlot(level, i))}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  levelSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  slotsList: {
    gap: 12,
  },
  slotCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  slotNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  slotNumberText: {
    fontSize: 14,
    fontWeight: '800',
  },
  slotLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteIcon: {
    padding: 8,
  },
  slotActions: {
    width: '100%',
  },
  recordButton: {
    minHeight: 46,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  playButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  playbackButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonCell: {
    flex: 1,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    height: '100%',
    width: '100%',
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  recordTimer: {
    fontSize: 56,
    fontWeight: '900',
    marginBottom: 40,
    fontVariant: ['tabular-nums'],
  },
  controlGroup: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
