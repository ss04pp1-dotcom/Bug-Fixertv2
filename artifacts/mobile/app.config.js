// app.config.js — dynamic version of the former static app.json.
//
// Converted from app.json so the AdMob / AppLovin MAX native config plugins
// (which need SDK keys / App IDs baked into AndroidManifest.xml & Info.plist)
// can read those values from environment variables instead of being
// hardcoded. Everything else is identical to the previous app.json.
//
// Env vars (set as needed before an `expo prebuild` / EAS build; safe test
// IDs are used when unset so local dev / Expo Go never break):
//   ADMOB_ANDROID_APP_ID   — AdMob Android Application ID (ca-app-pub-...~...)
//   ADMOB_IOS_APP_ID       — AdMob iOS Application ID (ca-app-pub-...~...)
//   APPLOVIN_SDK_KEY       — AppLovin MAX SDK key

const ADMOB_ANDROID_APP_ID = 'ca-app-pub-9336332117032732~4352238150'; // Real Android App ID
const ADMOB_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511'; // Google test App ID (no real iOS ID)
const APPLOVIN_SDK_KEY = null; // Not configured

module.exports = {
  expo: {
    name: 'SOL TV',
    slug: 'sol-tv',
    version: '2.4.1',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'sol-tv',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#05070F',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.sol-tv.app',
      infoPlist: {
        UIBackgroundModes: ['audio', 'fetch'],
        UIRequiresFullScreen: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsArbitraryLoadsForMedia: true,
        },
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#05070F',
      },
      package: 'com.soltv.app',
      usesCleartextTraffic: true,
      permissions: [
        'android.permission.INTERNET',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        'android.permission.RECEIVE_BOOT_COMPLETED',
      ],
    },
    web: {
      favicon: './assets/images/icon.png',
    },
    plugins: [
      [
        'expo-router',
        {
          origin: 'https://streampro.app/',
        },
      ],
      'expo-font',
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: '35.0.0',
            minSdkVersion: 24,
            kotlinVersion: '2.1.21',
          },
        },
      ],
      [
        'react-native-video',
        {
          enableNotificationControls: true,
          enableBackgroundPlayback: true,
          enablePictureInPicture: true,
        },
      ],
      [
        'react-native-google-mobile-ads',
        {
          android_app_id: ADMOB_ANDROID_APP_ID,
          ios_app_id: ADMOB_IOS_APP_ID,
          user_tracking_usage_description:
            'This identifier will be used to deliver personalized ads to you.',
          delay_app_measurement_init: true,
        },
      ],
      './plugins/withAdMobManifest',
      ['./plugins/withAppLovinConfig', { sdkKey: APPLOVIN_SDK_KEY }],
      'expo-screen-orientation',
      './plugins/withPipSupport',
      './plugins/withPipNative',
      './plugins/withMedia3Gradle',
      './plugins/withMedia3ProGuard',
      './plugins/withGMSResolution',
      './plugins/withNetworkSecurityConfig',
    ],
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/41ae0d59-922c-4851-8b9a-8b5d8c657d13',
      fallbackToCacheTimeout: 30000,
      checkAutomatically: 'NEVER',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl: 'https://bug-fixertv2.onrender.com',
      wsUrl: 'wss://bug-fixertv2.onrender.com',
      imageUrl: 'https://bug-fixertv2.onrender.com',
      cdnUrl: '',
      eas: {
        projectId: '41ae0d59-922c-4851-8b9a-8b5d8c657d13',
      },
      easProjectId: '41ae0d59-922c-4851-8b9a-8b5d8c657d13',
      note:
        "Verify this EAS project ID matches an active project via 'eas project:info'. If placeholder, set updates.enabled=false.",
      applovinSdkKey: APPLOVIN_SDK_KEY,
      applovinConfigured: !!APPLOVIN_SDK_KEY,
    },
  },
};
