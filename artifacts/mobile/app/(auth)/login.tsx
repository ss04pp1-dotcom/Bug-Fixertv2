import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import apiClient, { tokenStorage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { usePublicSettings } from '@/lib/api-hooks';
import { Config } from '@/constants/config';
import { signInWithGoogle, signInWithFacebook, SocialAuthResult } from '@/lib/social-auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const setUser = useAuthStore((s) => s.setUser);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: settings } = usePublicSettings();

  const appName: string = Constants.expoConfig?.name ?? 'SOL TV';
  const appLogo: string | null = settings?.['app_logo'] ?? null;
  const googleEnabled: boolean = Boolean(settings?.['google_auth_enabled']);
  const facebookEnabled: boolean = Boolean(settings?.['facebook_auth_enabled']);
  const appleEnabled: boolean = Boolean(settings?.['apple_auth_enabled']);
  const googleClientIdWeb: string = settings?.['google_client_id_web'] ?? '';
  const googleClientIdAndroid: string = settings?.['google_client_id_android'] ?? '';
  const googleClientIdIos: string = settings?.['google_client_id_ios'] ?? '';
  const facebookAppId: string = settings?.['facebook_app_id'] ?? '';
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const socialProviders = [
    { icon: 'logo-google' as const,   label: 'Google',   enabled: googleEnabled },
    { icon: 'logo-facebook' as const, label: 'Facebook', enabled: facebookEnabled },
    { icon: 'logo-apple' as const,    label: 'Apple',    enabled: appleEnabled },
  ].filter((p) => p.enabled);

  const handleLogin = async () => {
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', {
        identifier: identifier.trim(),
        password,
        platform: Platform.OS,
      });
      const { accessToken, refreshToken, user } = data.data;
      await tokenStorage.setTokens(accessToken, refreshToken);
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.subscription?.status === 'active' || user.subscription?.status === 'trial'
          ? (user.subscription?.plan?.name || 'premium')
          : 'free',
      });
      router.replace('/(main)/' as any);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const finishSocialLogin = async (result: SocialAuthResult) => {
    const { data } = await apiClient.post('/auth/social', {
      provider: result.provider,
      accessToken: result.accessToken,
      code: result.code,
      redirectUri: result.redirectUri,
      codeVerifier: result.codeVerifier,
      email: result.email,
      name: result.name,
    });
    const { accessToken, refreshToken, user } = data.data;
    await tokenStorage.setTokens(accessToken, refreshToken);
    setUser({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.subscription?.status === 'active' || user.subscription?.status === 'trial'
        ? (user.subscription?.plan?.name || 'premium')
        : 'free',
    });
    router.replace('/(main)/' as any);
  };

  const handleSocialLogin = async (label: string) => {
    if (label === 'Apple') {
      Alert.alert('Apple Sign-In', 'Apple sign-in is coming soon. Please use your email and password to log in.');
      return;
    }
    setError('');
    setSocialLoading(label);
    try {
      let result: SocialAuthResult | null = null;
      if (label === 'Google') {
        result = await signInWithGoogle({
          web: googleClientIdWeb,
          android: googleClientIdAndroid,
          ios: googleClientIdIos,
        });
      } else if (label === 'Facebook') {
        result = await signInWithFacebook(facebookAppId);
      }
      if (!result) return; // user cancelled
      await finishSocialLogin(result);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message;
      Alert.alert(`${label} Sign-In Failed`, Array.isArray(msg) ? msg.join(', ') : msg || 'Something went wrong. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  const logoUrl = appLogo ? Config.imageUrl(appLogo) : null;

  return (
    <View style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <View style={s.logoGlow} />
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={s.logoImage} resizeMode="contain" />
            ) : (
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={s.logoSquare}>
                <Text style={s.logoTxt}>{appName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <Text style={s.title}>Welcome Back!</Text>
            <Text style={s.subtitle}>Login to {appName}</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputGroup}>
              <View style={s.inputWrapper}>
                <TextInput
                  style={s.input}
                  placeholder="Email or Phone"
                  placeholderTextColor="#A1A1AA"
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={s.inputWrapper}>
                <TextInput
                  style={s.input}
                  placeholder="Password"
                  placeholderTextColor="#A1A1AA"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eye}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#A1A1AA" />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={s.forgot}>
              <Text style={s.forgotTxt}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogin} disabled={isLoading} style={s.btn}>
              <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Login</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {socialProviders.length > 0 && (
              <>
                <View style={s.divider}>
                  <View style={s.line} />
                  <Text style={s.dividerTxt}>or continue with</Text>
                  <View style={s.line} />
                </View>

                <View style={s.social}>
                  {socialProviders.map(({ icon, label }) => (
                    <TouchableOpacity
                      key={label}
                      style={s.socialBtn}
                      disabled={socialLoading !== null}
                      onPress={() => handleSocialLogin(label)}
                    >
                      {socialLoading === label ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Ionicons name={icon} size={24} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={s.bottom}>
              <Text style={s.bottomTxt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={s.bottomLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 40, position: 'relative' },
  logoGlow: { position: 'absolute', top: 0, width: 80, height: 80, backgroundColor: '#8B5CF6', borderRadius: 40, opacity: 0.3, blurRadius: 20 } as any,
  logoSquare: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoImage: { width: 64, height: 64, borderRadius: 16, marginBottom: 24 },
  logoTxt: { fontSize: 32, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#A1A1AA', fontFamily: 'Inter' },
  form: { flex: 1 },
  inputGroup: { gap: 16 },
  inputWrapper: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  input: { flex: 1, color: '#fff', fontSize: 16, fontFamily: 'Inter', outlineWidth: 0 } as any,
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,59,48,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  errorTxt: { color: '#FF3B30', fontSize: 14, fontFamily: 'Inter', flex: 1 },
  eye: { padding: 8 },
  forgot: { alignSelf: 'flex-end', marginTop: 16, marginBottom: 24 },
  forgotTxt: { color: '#EC4899', fontSize: 14, fontWeight: '600', fontFamily: 'Inter' },
  btn: { borderRadius: 16, overflow: 'hidden', marginBottom: 32 },
  btnGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Inter' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerTxt: { color: '#A1A1AA', fontSize: 14, fontFamily: 'Inter' },
  social: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 40 },
  socialBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'center' },
  bottomTxt: { color: '#A1A1AA', fontSize: 14, fontFamily: 'Inter' },
  bottomLink: { color: '#8B5CF6', fontSize: 14, fontWeight: 'bold', fontFamily: 'Inter' },
});
