/**
 * withPipNative — Expo config plugin (no-op passthrough, kept for compat)
 *
 * HISTORY: this used to inject a custom onUserLeaveHint() override into
 * MainActivity that unconditionally set PictureInPictureParams with
 * setAutoEnterEnabled(false) on every Home-button press. That was a
 * workaround from before react-native-video supported scoped auto-PiP.
 *
 * That hack is now REMOVED because it actively conflicted with
 * `enterPictureInPictureOnLeave` (see NativeIPTVPlayer.tsx / GlobalVideoPlayer.tsx):
 * react-native-video's own ReactExoplayerView sets the video-scoped
 * PictureInPictureParams (with a proper source rect tied to the video view,
 * so ONLY the video shows in PiP — never the whole screen). Our override
 * ran on the SAME onUserLeaveHint lifecycle callback and stomped those
 * params back to autoEnterEnabled=false right as the OS checked for
 * auto-enter, which is what caused "the whole app goes into PiP" /
 * auto-PiP not working correctly.
 *
 * PiP is now driven entirely by:
 *   - withPipSupport.js       → AndroidManifest flags (supportsPictureInPicture, etc.)
 *   - react-native-video      → `pictureInPicture` (manual toggle) and
 *                               `enterPictureInPictureOnLeave` (auto on Home/leave,
 *                               scoped to the video surface, library-managed).
 *
 * This file is kept (as a no-op) instead of being deleted so app.config.js
 * doesn't need touching and so history/intent stays documented in-repo.
 */
module.exports = function withPipNative(config) {
  return config;
};
