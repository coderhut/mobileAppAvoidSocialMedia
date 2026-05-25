import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppTheme } from '../../theme/ThemeContext';
import type { ThemeColors, ThemeMode, TranslationKey } from '../../types';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { ScreenScaffold } from '../common/ScreenScaffold';
import { WaveformVisualizer } from '../common/WaveformVisualizer';

const MAX_DURATION_SEC = 30;
const WAVEFORM_BARS = [
  8, 16, 11, 24, 18, 30, 20, 34, 15, 26, 32, 18, 28, 12, 20, 26, 16, 22, 12, 18,
  10, 14, 12, 16,
];

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
  const { colors, mode, t } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const {
    voiceNotes,
    voiceNoteDurations,
    saveVoiceNote,
    saveVoiceNoteDuration,
    deleteVoiceNote,
  } = useSettings();
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
  const [playbackProgress, setPlaybackProgress] = useState<{
    currentMs: number;
    durationMs: number;
    level: number;
    index: number;
  } | null>(null);
  const [recordingDurations, setRecordingDurations] = useState<
    Record<string, number>
  >({});
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const activeSlotRef = useRef<{ level: number; index: number } | null>(null);
  const recordDurationMsRef = useRef(0);
  const isStoppingRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const requiredLevelYPositions = useRef<Record<number, number>>({});
  const requiredSlotYPositions = useRef<Record<number, number>>({});
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const [highlightedSlotKey, setHighlightedSlotKey] = useState<string | null>(
    null,
  );
  const [requiredMessageSlotKey, setRequiredMessageSlotKey] = useState<
    string | null
  >(null);

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

    setRequiredMessageSlotKey(null);
    setHighlightedSlotKey(null);
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
      recordDurationMsRef.current = 0;

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
        recordDurationMsRef.current = e.currentPosition;
        setRecordTime(formatPlaybackTime(e.currentPosition));

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
      const recordedDurationMs = recordDurationMsRef.current;
      activeSlotRef.current = null;
      setActiveSlot(null);
      setRecordTime('00:00');
      recordDurationMsRef.current = 0;

      if (slot) {
        setRecordingDurations(current => ({
          ...current,
          [getSlotKey(slot.level, slot.index)]: recordedDurationMs,
        }));
        saveVoiceNote(slot.level, slot.index, result, recordedDurationMs);
      }
    } catch (err) {
      console.error('Failed to stop recorder', err);
      setIsRecording(false);
      setIsPaused(false);
      isRecordingRef.current = false;
      activeSlotRef.current = null;
      setActiveSlot(null);
      setRecordTime('00:00');
      recordDurationMsRef.current = 0;
    } finally {
      isStoppingRef.current = false;
    }
  };

  const onPlayBack = async (path: string, level: number, index: number) => {
    const slotKey = getSlotKey(level, index);
    let hasSavedDuration = Boolean(
      recordingDurations[slotKey] || voiceNoteDurations[level]?.[index],
    );

    try {
      audioRecorderPlayer.removePlayBackListener();
      await audioRecorderPlayer.stopPlayer().catch(() => undefined);
      await audioRecorderPlayer.startPlayer(path);
      setPlayingSlot({ level, index });
      setPlaybackProgress({ currentMs: 0, durationMs: 0, level, index });
      setIsPlaybackPaused(false);
      audioRecorderPlayer.addPlayBackListener(e => {
        setPlaybackProgress({
          currentMs: e.currentPosition,
          durationMs: e.duration,
          level,
          index,
        });

        if (e.duration > 0) {
          setRecordingDurations(current => ({
            ...current,
            [slotKey]: e.duration,
          }));
          if (!hasSavedDuration) {
            saveVoiceNoteDuration(level, index, e.duration);
            hasSavedDuration = true;
          }
        }

        if (e.duration > 0 && e.currentPosition >= e.duration) {
          audioRecorderPlayer.removePlayBackListener();
          audioRecorderPlayer.stopPlayer();
          setPlayingSlot(null);
          setIsPlaybackPaused(false);
          setPlaybackProgress({
            currentMs: 0,
            durationMs: e.duration,
            level,
            index,
          });
        }
      });
    } catch (err) {
      setPlayingSlot(null);
      setPlaybackProgress(null);
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
      setPlaybackProgress(null);
      setIsPlaybackPaused(false);
    }
  };

  const isLevelComplete = (level: number) => {
    const notes = voiceNotes[level] || {};
    return Object.keys(notes).length > 0;
  };

  const canContinue =
    isLevelComplete(1) && isLevelComplete(2) && isLevelComplete(3);

  const findMissingRequiredLevel = () => {
    return [1, 2, 3].find(level => !voiceNotes[level]?.[0]) ?? null;
  };

  const showRequiredVoiceNoteMessage = () => {
    return t('requiredVoiceNoteAlert');
  };

  const highlightMissingRequiredSlot = (level: number) => {
    const slotKey = getSlotKey(level, 0);
    const levelYPosition = requiredLevelYPositions.current[level] ?? 0;
    const slotYPosition = requiredSlotYPositions.current[level] ?? 0;
    const yPosition = levelYPosition + slotYPosition;
    const targetY = yPosition - windowHeight * 0.45;

    scrollRef.current?.scrollTo({
      y: Math.max(targetY, 0),
      animated: true,
    });

    setHighlightedSlotKey(slotKey);
    highlightAnim.setValue(0);
    Animated.sequence([
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => setHighlightedSlotKey(null));
  };

  const handleContinue = () => {
    if (!hideHeader) {
      const missingRequiredLevel = findMissingRequiredLevel();

      if (missingRequiredLevel) {
        setRequiredMessageSlotKey(getSlotKey(missingRequiredLevel, 0));
        highlightMissingRequiredSlot(missingRequiredLevel);
        return;
      }

      setRequiredMessageSlotKey(null);
      onContinue();
      return;
    }

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
    const slotKey = getSlotKey(level, index);
    const slotProgress =
      playbackProgress?.level === level && playbackProgress.index === index
        ? playbackProgress
        : null;
    const durationMs =
      slotProgress?.durationMs ||
      recordingDurations[slotKey] ||
      voiceNoteDurations[level]?.[index] ||
      0;
    const currentMs = slotProgress?.currentMs || 0;
    const progressRatio = durationMs > 0 ? currentMs / durationMs : 0;
    const slotStatus = isPlaying
      ? isPlaybackPaused
        ? t('pausedLabel')
        : t('playingLabel')
      : t('readyLabel');
    const slotStatusColor =
      isPlaying && !isPlaybackPaused ? colors.success : colors.subtleText;
    const isHighlighted = highlightedSlotKey === slotKey;
    const hasRequiredMessage = requiredMessageSlotKey === slotKey;
    const highlightTranslateX = highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    });

    return (
      <React.Fragment key={`${level}-${index}`}>
        <Animated.View
          onLayout={event => {
            if (index === 0) {
              requiredSlotYPositions.current[level] =
                event.nativeEvent.layout.y;
            }
          }}
          style={[
            localStyles.slotCard,
            {
              backgroundColor: colors.surface,
              borderColor:
                isHighlighted || hasRequiredMessage ? '#EF4444' : colors.border,
              shadowColor: mode === 'dark' ? '#000000' : '#0F172A',
            },
            isHighlighted && {
              transform: [{ translateX: highlightTranslateX }],
            },
          ]}
        >
          <View style={localStyles.slotHeader}>
            <View
              style={[
                localStyles.slotNumber,
                {
                  backgroundColor:
                    mode === 'dark' ? '#23324A' : colors.noticeBackground,
                },
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
                <Text style={localStyles.deleteIconText}>⌫</Text>
              </Pressable>
            )}
          </View>

          {isRecorded ? (
            <>
              <View
                style={[
                  localStyles.waveformPanel,
                  {
                    backgroundColor:
                      mode === 'dark' ? '#4B5563' : colors.surfaceAlt,
                    borderColor: mode === 'dark' ? '#7B8492' : colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={
                    isPlaying
                      ? isPlaybackPaused
                        ? onResumeBack
                        : onPauseBack
                      : () => onPlayBack(path, level, index)
                  }
                  style={[
                    localStyles.roundActionButton,
                    {
                      backgroundColor:
                        mode === 'dark' ? '#38BDF8' : colors.primary,
                    },
                  ]}
                >
                  <Text style={localStyles.roundActionText}>
                    {isPlaying && !isPlaybackPaused ? 'Ⅱ' : '▷'}
                  </Text>
                </Pressable>
                <WaveformStrip
                  colors={colors}
                  mode={mode}
                  progressRatio={progressRatio}
                />
                <View style={localStyles.timeGroup}>
                  <Text
                    style={[
                      localStyles.elapsedText,
                      { color: mode === 'dark' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {formatPlaybackTime(currentMs)}
                  </Text>
                  <Text
                    style={[
                      localStyles.totalText,
                      { color: colors.subtleText },
                    ]}
                  >
                    {formatPlaybackTime(durationMs)}
                  </Text>
                </View>
              </View>

              {/*
            <View style={localStyles.playbackControls}>
              <Pressable
                onPress={
                  isPlaying
                    ? isPlaybackPaused
                      ? onResumeBack
                      : onPauseBack
                    : () => onPlayBack(path, level, index)
                }
                style={[
                  localStyles.compactActionButton,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    localStyles.compactActionText,
                    { color: colors.text },
                  ]}
                >
                  {isPlaying
                    ? isPlaybackPaused
                      ? t('resumeLabel')
                      : t('pauseLabel')
                    : t('playLabel')}
                </Text>
              </Pressable>
              <Pressable
                disabled={!isPlaying}
                onPress={onStopBack}
                style={[
                  localStyles.compactActionButton,
                  { borderColor: colors.border },
                  !isPlaying && localStyles.disabledButton,
                ]}
              >
                <Text
                  style={[
                    localStyles.compactActionText,
                    { color: colors.mutedText },
                  ]}
                >
                  {t('stopLabel')}
                </Text>
              </Pressable>

              <View style={localStyles.statusGroup}>
                <View
                  style={[
                    localStyles.statusDot,
                    { backgroundColor: slotStatusColor },
                  ]}
                />
                <Text
                  style={[localStyles.statusText, { color: slotStatusColor }]}
                >
                  {slotStatus}
                </Text>
              </View>
            </View>
            */}
            </>
          ) : (
            <Pressable
              disabled={!!startingSlot}
              onPress={() => onStartRecord(level, index)}
              style={[
                localStyles.recordButton,
                {
                  backgroundColor: mode === 'dark' ? '#172132' : '#FFFFFF',
                  borderColor: mode === 'dark' ? '#263A57' : colors.border,
                },
                !!startingSlot && !isStarting && localStyles.disabledButton,
              ]}
            >
              {isStarting ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <>
                  <View style={localStyles.recordDot} />
                  <Text
                    style={[
                      localStyles.recordButtonText,
                      { color: colors.text },
                    ]}
                  >
                    {t('startRecordingLabel')}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>
        {requiredMessageSlotKey === slotKey && (
          <View
            style={[
              localStyles.requiredToast,
              {
                backgroundColor: mode === 'dark' ? '#3A1820' : '#FEE2E2',
                borderColor: '#EF4444',
              },
            ]}
          >
            <Text style={localStyles.requiredToastText}>
              {showRequiredVoiceNoteMessage()}
            </Text>
          </View>
        )}
      </React.Fragment>
    );
  };

  return (
    <ScreenScaffold
      eyebrow={hideHeader ? t('stepTwo') : ''}
      headerTitle={!hideHeader ? t('voiceNotesTitle') : undefined}
      title={hideHeader ? t('recordingsTitle') : ''}
      body={t('recordingsBody')}
      onGoHome={!hideHeader ? onBack : undefined}
      onOpenSettings={onOpenSettings}
      hideHeader={hideHeader}
      fixedHeader={!hideHeader}
      scrollRef={scrollRef}
    >
      <View style={[localStyles.divider, { backgroundColor: colors.border }]} />

      <LevelSection
        title={t('level1Title')}
        desc={t('level1Desc')}
        level={1}
        renderSlot={renderSlot}
        colors={colors}
        complete={isLevelComplete(1)}
        mode={mode}
        onLayout={y => {
          requiredLevelYPositions.current[1] = y;
        }}
        t={t}
      />

      <LevelSection
        title={t('level2Title')}
        desc={t('level2Desc')}
        level={2}
        renderSlot={renderSlot}
        colors={colors}
        complete={isLevelComplete(2)}
        mode={mode}
        onLayout={y => {
          requiredLevelYPositions.current[2] = y;
        }}
        t={t}
      />

      <LevelSection
        title={t('level3Title')}
        desc={t('level3Desc')}
        level={3}
        renderSlot={renderSlot}
        colors={colors}
        complete={isLevelComplete(3)}
        mode={mode}
        onLayout={y => {
          requiredLevelYPositions.current[3] = y;
        }}
        t={t}
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
                <Text style={localStyles.controlBtnText}>
                  {t('resumeLabel')}
                </Text>
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
                  {t('pauseLabel')}
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

      <View style={localStyles.footer}>
        <View style={localStyles.buttonRow}>
          {hideHeader && (
            <View style={localStyles.buttonCell}>
              <SecondaryButton label="Go Back" onPress={onBack} />
            </View>
          )}
          <View style={localStyles.buttonCell}>
            <PrimaryButton
              disabled={hideHeader && !canContinue}
              label={hideHeader ? t('continueLabel') : t('saveLabel')}
              onPress={handleContinue}
            />
          </View>
        </View>
      </View>
    </ScreenScaffold>
  );
}

function LevelSection({
  title,
  desc,
  level,
  renderSlot,
  colors,
  complete,
  mode,
  onLayout,
  t,
}: {
  title: string;
  desc: string;
  level: number;
  renderSlot: (level: number, index: number) => React.ReactNode;
  colors: ThemeColors;
  complete: boolean;
  mode: ThemeMode;
  onLayout: (y: number) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <View
      style={localStyles.levelSection}
      onLayout={event => onLayout(event.nativeEvent.layout.y)}
    >
      <View style={localStyles.levelHeader}>
        <View style={localStyles.levelTitleGroup}>
          <Text style={[localStyles.sectionTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[localStyles.sectionDesc, { color: colors.mutedText }]}>
            {desc}
          </Text>
        </View>
        <View
          style={[
            localStyles.levelStatusPill,
            {
              backgroundColor: complete
                ? mode === 'dark'
                  ? '#063E34'
                  : '#DDFBEF'
                : mode === 'dark'
                ? '#263247'
                : '#EFEFEF',
            },
          ]}
        >
          <View
            style={[
              localStyles.statusDot,
              {
                backgroundColor: complete ? colors.success : colors.subtleText,
              },
            ]}
          />
          <Text
            style={[
              localStyles.levelStatusText,
              { color: complete ? colors.success : colors.subtleText },
            ]}
          >
            {complete ? t('doneLabel') : t('pendingLabel')}
          </Text>
        </View>
      </View>
      <View style={localStyles.slotsList}>
        {[0, 1, 2].map(i => renderSlot(level, i))}
      </View>
    </View>
  );
}

function WaveformStrip({
  colors,
  mode,
  progressRatio,
}: {
  colors: ThemeColors;
  mode: ThemeMode;
  progressRatio: number;
}) {
  const activeBars = Math.round(
    Math.max(0, Math.min(1, progressRatio)) * WAVEFORM_BARS.length,
  );

  return (
    <View style={localStyles.waveform}>
      {WAVEFORM_BARS.map((height, index) => (
        <View
          key={`${height}-${index}`}
          style={[
            localStyles.waveformBar,
            {
              height,
              backgroundColor:
                index < activeBars
                  ? mode === 'dark'
                    ? '#38BDF8'
                    : colors.primary
                  : mode === 'dark'
                  ? '#24344F'
                  : '#E5E7EB',
            },
          ]}
        />
      ))}
    </View>
  );
}

function getSlotKey(level: number, index: number) {
  return `${level}-${index}`;
}

function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const localStyles = StyleSheet.create({
  divider: {
    height: 1,
    marginBottom: 36,
  },
  levelSection: {
    marginBottom: 40,
  },
  levelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  levelTitleGroup: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  levelStatusPill: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotsList: {
    gap: 12,
  },
  slotCard: {
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  requiredToast: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: -2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  requiredToastText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  slotNumber: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    marginRight: 10,
    width: 24,
  },
  slotNumberText: {
    fontSize: 13,
    fontWeight: '900',
  },
  slotLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  deleteIcon: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  deleteIconText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '900',
  },
  waveformPanel: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 12,
  },
  roundActionButton: {
    alignItems: 'center',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  roundActionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  waveform: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 42,
  },
  waveformBar: {
    borderRadius: 2,
    width: 3,
  },
  timeGroup: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  elapsedText: {
    fontSize: 14,
    fontWeight: '900',
  },
  totalText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  playbackControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  compactActionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 80,
    paddingHorizontal: 12,
  },
  compactActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginLeft: 'auto',
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  recordButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
  },
  recordDot: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  footer: {
    marginBottom: 20,
    marginTop: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonCell: {
    flex: 1,
  },
  recordingOverlay: {
    alignItems: 'center',
    bottom: 0,
    height: '100%',
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 2000,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  recordTimer: {
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    marginBottom: 40,
  },
  controlGroup: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  controlBtn: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 18,
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
