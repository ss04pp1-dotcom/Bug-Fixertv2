/**
 * Real Google & Facebook sign-in for the mobile app.
 *
 *   - Google:   Native Google Sign-In SDK (@react-native-google-signin) —
 *               shows Android/iOS's own account-picker bottom sheet, not a
 *               browser popup. Requires the app's SHA-1 fingerprint to be
 *               registered against the Android OAuth client in Google Cloud
 *               Console (see EAS credentials for the SHA-1 to add).
 *   - Facebook: OAuth authorization-code + PKCE flow in an in-app browser.
 *               The authorization `code` is sent to our backend
 *               (`POST /auth/social`), which exchanges it server-side using
 *               the private `facebook_client_token` setting. The mobile app
 *               never sees that token.
 *
 * NOTE: both require a native dev build (EAS build / expo prebuild) — this
 * does not work inside Expo Go.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  provider: 'google' | 'facebook';
  accessToken?: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  email?: string;
  name?: string;
}

const FACEBOOK_DISCOVERY = {
  authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
};

export interface GoogleClientIds {
  web?: string;
  android?: string;
  ios?: string;
}

let googleConfigured = false;

/**
 * Runs the native Google sign-in flow (account-picker bottom sheet) and
 * returns a verified OAuth access token ready to send to `POST /auth/social`.
 *
 * `ids.web` is REQUIRED — the native SDK uses the Web client ID to mint the
 * access/ID tokens on both Android and iOS (matches the "Web Client ID"
 * field in Admin → Settings → Authentication).
 */
export async function signInWithGoogle(ids: GoogleClientIds): Promise<SocialAuthResult | null> {
  if (!ids.web) throw new Error('Google Web Client ID is not configured');

  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: ids.web,
      ...(ids.ios ? { iosClientId: ids.ios } : {}),
      offlineAccess: false,
      scopes: ['profile', 'email'],
    });
    googleConfigured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return null; // user cancelled

    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) throw new Error('Google did not return an access token');

    return {
      provider: 'google',
      accessToken,
      email: response.data.user.email,
      name: response.data.user.name ?? undefined,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw err;
  }
}

/**
 * Runs the Facebook sign-in flow. Returns the authorization `code` +
 * `redirectUri` (+ PKCE verifier) — the actual token exchange happens
 * server-side in `POST /auth/social` since it needs the private client token.
 */
export async function signInWithFacebook(appId: string): Promise<SocialAuthResult | null> {
  if (!appId) throw new Error('Facebook App ID is not configured');

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'sol-tv', path: 'redirect' });

  const request = new AuthSession.AuthRequest({
    clientId: appId,
    redirectUri,
    scopes: ['public_profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(FACEBOOK_DISCOVERY);
  if (result.type !== 'success' || !result.params.code) {
    if (result.type === 'error') throw new Error(result.params?.error_description || 'Facebook sign-in failed');
    return null;
  }

  return {
    provider: 'facebook',
    code: result.params.code,
    redirectUri,
    codeVerifier: request.codeVerifier,
  };
}
