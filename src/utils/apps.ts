import type {InstalledApp, TrackableApp} from '../types';

export const FALLBACK_TRACKABLE_APPS: TrackableApp[] = [
  {
    name: 'Instagram',
    packageName: 'com.instagram.android',
    category: 'Social',
    accent: '#F56040',
  },
  {
    name: 'TikTok',
    packageName: 'com.zhiliaoapp.musically',
    category: 'Short videos',
    accent: '#111827',
  },
  {
    name: 'YouTube',
    packageName: 'com.google.android.youtube',
    category: 'Video',
    accent: '#FF0033',
  },
  {
    name: 'Facebook',
    packageName: 'com.facebook.katana',
    category: 'Social',
    accent: '#1877F2',
  },
  {
    name: 'Snapchat',
    packageName: 'com.snapchat.android',
    category: 'Messaging',
    accent: '#FFDD00',
  },
  {
    name: 'X',
    packageName: 'com.twitter.android',
    category: 'Social',
    accent: '#0F172A',
  },
  {
    name: 'Reddit',
    packageName: 'com.reddit.frontpage',
    category: 'Community',
    accent: '#FF4500',
  },
];

export function toTrackableApp(app: InstalledApp): TrackableApp {
  return {
    name: app.appName,
    packageName: app.packageName,
    category: app.isSystemApp ? 'System app' : 'Installed app',
    accent: colorFromPackageName(app.packageName),
    isSystemApp: app.isSystemApp,
  };
}

function colorFromPackageName(packageName: string) {
  const colors = [
    '#2563EB',
    '#7C3AED',
    '#DB2777',
    '#EA580C',
    '#16A34A',
    '#0891B2',
    '#4F46E5',
    '#BE123C',
  ];
  const hash = packageName.split('').reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);

  return colors[hash % colors.length];
}
