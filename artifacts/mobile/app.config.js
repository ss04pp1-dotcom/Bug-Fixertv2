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
          // NSAllowsArbitraryLoads: false — do NOT re-enable; it allows HTTP for
          // all networking, not just media, which Apple flags in App Store review.
          // NSAllowsArbitraryLoadsForMedia scopes the exception to AV/media layers
          // only (AVPlayer, ExoPlayer bridge), which is the minimum needed for IPTV.
          NSAllowsArbitraryLoads: false,
          NSAllowsArbitraryLoadsForMedia: true,
          // Add your API server as an explicit HTTPS-only domain so NSAllowsArbitraryLoads=false
          // does not inadvertently block API calls on non-ATS code paths.
          NSExceptionDomains: {
            "livetv-aokw.onrender.com": {
              NSIncludesSubdomains: false,
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSRequiresCertificateTransparency: false,
            },
            // Add staging / preview domains here as needed.
          },
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
      // usesCleartextTraffic is intentionally NOT set here.
      // The ./plugins/withNetworkSecurityConfig plugin writes
      // res/xml/network_security_config.xml which is the authoritative source
      // for OkHttp / Media3 and takes precedence over the manifest flag.
      // Enabling it here would redundantly add android:usesCleartextTraffic="true"
      // to the <application> tag; the XML config already handles IPTV HTTP streams.
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
          origin: 'https://soltv.app/',
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
      '@react-native-google-signin/google-signin',
      './plugins/withPipSupport',
      './plugins/withPipNative',
      './plugins/withMedia3Gradle',
      './plugins/withMedia3ProGuard',
      './plugins/withNetworkSecurityConfig',
    ],
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/1abc2260-4d2e-4fb7-a146-65ba20b98991',
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
      apiUrl: 'https://livetv-aokw.onrender.com',
      wsUrl: 'wss://livetv-aokw.onrender.com',
      imageUrl: 'https://livetv-aokw.onrender.com',
      cdnUrl: '',
      eas: {
        projectId: '1abc2260-4d2e-4fb7-a146-65ba20b98991',
      },
      easProjectId: '1abc2260-4d2e-4fb7-a146-65ba20b98991',
      note:
        "Verify this EAS project ID matches an active project via 'eas project:info'. If placeholder, set updates.enabled=false.",
    },
  },
};
