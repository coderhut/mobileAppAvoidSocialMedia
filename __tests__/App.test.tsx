/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  exists: jest.fn(() => Promise.resolve(false)),
  unlink: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-audio-recorder-player', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addPlayBackListener: jest.fn(),
    addRecordBackListener: jest.fn(),
    pauseRecorder: jest.fn(() => Promise.resolve()),
    removePlayBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    resumeRecorder: jest.fn(() => Promise.resolve()),
    startPlayer: jest.fn(() => Promise.resolve()),
    startRecorder: jest.fn(() => Promise.resolve('/tmp/recording.mp4')),
    stopPlayer: jest.fn(() => Promise.resolve()),
    stopRecorder: jest.fn(() => Promise.resolve('/tmp/recording.mp4')),
  })),
  AudioEncoderAndroidType: { AAC: 'aac' },
  AudioSourceAndroidType: { MIC: 'mic' },
  AVEncoderAudioQualityIOSType: { high: 'high' },
  AVEncodingOption: { aac: 'aac' },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
