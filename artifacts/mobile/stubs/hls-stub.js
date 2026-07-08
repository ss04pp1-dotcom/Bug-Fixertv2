/**
 * hls-stub.js — empty stub for hls.js on native platforms (iOS/Android).
 *
 * hls.js is a browser-only HLS player. On React Native, HLS playback is
 * handled natively by AVPlayer (iOS) / ExoPlayer (Android) via react-native-video.
 * This stub prevents hls.js from being bundled into the native build.
 *
 * If code imports hls.js on native, it gets this stub and should guard with:
 *   if (Platform.OS === 'web') { const Hls = await import('hls.js'); ... }
 */
function Hls() {}
Hls.isSupported = function () { return false; };
Hls.Events = {};
module.exports = Hls;
module.exports.default = Hls;
