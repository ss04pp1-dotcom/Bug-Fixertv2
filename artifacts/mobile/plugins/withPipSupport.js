const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPipSupport(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const mainActivity = manifest.manifest.application[0].activity.find(
      (act) => act.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity.$['android:supportsPictureInPicture'] = 'true';
      const existingChanges = mainActivity.$['android:configChanges'] || '';
      const required = [
        'screenSize', 'smallestScreenSize', 'screenLayout',
        'orientation', 'keyboardHidden', 'keyboard', 'navigation',
      ];
      const current = existingChanges.split('|').filter(Boolean);
      required.forEach((c) => { if (!current.includes(c)) current.push(c); });
      mainActivity.$['android:configChanges'] = current.join('|');
    }
    return config;
  });
};
