// app.config.js — dynamic Expo config.
// Ad monetization is handled via lightweight WebView (Adsterra/Monetag banners)
// and expo-web-browser Smartlinks. No native ad SDK plugins are required.

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
    },
  },
};
