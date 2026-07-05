/**
 * Real Google & Facebook sign-in for the mobile app.
 *
 * Both providers use the OAuth authorization-code + PKCE flow (no client
 * secret ever lives on-device):
 *   - Google:   PKCE code exchanged directly against Google's token endpoint
 *               (public client — no secret exists for Google in Settings,
 *               confirming this is the intended flow).
 *   - Facebook: the authorization `code` is sent to our backend
 *               (`POST /auth/social`), which exchanges it server-side using
 *               the private `facebook_client_token` setting. The mobile app
 *               never sees that token.
 *
 * NOTE: this requires a native dev build (EAS build / expo prebuild) — the
 * OAuth redirect via the app's custom scheme (`sol-tv://`) does not work
 * inside Expo Go.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

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

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const FACEBOOK_DISCOVERY = {
  authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
};

export interface GoogleClientIds {
  web?: string;
  android?: string;
  ios?: string;
}

function pickGoogleClientId(ids: GoogleClientIds): string | undefined {
  // Expo dev-client / EAS builds all use the same package/bundle id per
  // platform — pick the platform-specific client id when present, else fall
  // back to the Web client id (works fine for the Expo AuthSession proxy-less
  // native flow since Google matches on redirect URI, not just client type).
  const Platform = require('react-native').Platform;
  if (Platform.OS === 'android' && ids.android) return ids.android;
  if (Platform.OS === 'ios' && ids.ios) return ids.ios;
  return ids.web || ids.android || ids.ios;
}

/**
 * Runs the Google sign-in flow and returns a verified OAuth access token
 * ready to send to `POST /auth/social`.
 */
export async function signInWithGoogle(ids: GoogleClientIds): Promise<SocialAuthResult | null> {
  const clientId = pickGoogleClientId(ids);
  if (!clientId) throw new Error('Google Client ID is not configured');

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'sol-tv', path: 'redirect' });

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success' || !result.params.code) {
    if (result.type === 'error') throw new Error(result.params?.error_description || 'Google sign-in failed');
    return null;
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    GOOGLE_DISCOVERY,
  );

  if (!tokenResult.accessToken) throw new Error('Google did not return an access token');

  let email: string | undefined;
  let name: string | undefined;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });
    if (res.ok) {
      const info = (await res.json()) as { email?: string; name?: string };
      email = info.email;
      name = info.name;
    }
  } catch {
    // Non-fatal — the backend independently re-verifies via tokeninfo.
  }

  return { provider: 'google', accessToken: tokenResult.accessToken, email, name };
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
