const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPipSupport(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const mainActivity = manifest.manifest.application[0].activity.find(
      (act) => act.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      // Enable PiP support
      mainActivity.$['android:supportsPictureInPicture'] = 'true';

      // Android 12+ (API 31+): auto-enter PiP when home/recents pressed
      // This is what YouTube uses — OS handles it automatically, no JS code needed
      mainActivity.$['android:autoEnterPictureInPicture'] = 'true';

      // Required configChanges so activity doesn't restart on PiP resize
      const required = [
        'screenSize', 'smallestScreenSize', 'screenLayout',
        'orientation', 'keyboardHidden', 'keyboard', 'navigation',
      ];
      const existingChanges = mainActivity.$['android:configChanges'] || '';
      const current = existingChanges.split('|').filter(Boolean);
      required.forEach((c) => { if (!current.includes(c)) current.push(c); });
      mainActivity.$['android:configChanges'] = current.join('|');

      // Keep activity alive in PiP (don't recreate on task removal)
      mainActivity.$['android:launchMode'] =
        mainActivity.$['android:launchMode'] || 'singleTask';
    }
    return config;
  });
};
