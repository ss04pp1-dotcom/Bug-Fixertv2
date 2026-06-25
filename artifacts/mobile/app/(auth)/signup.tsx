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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { tokenStorage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    setError('');
    if (!name.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please provide email or phone number');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    try {
      const body: Record<string, string> = { name: name.trim(), password };
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();

      const { data } = await apiClient.post('/auth/register', body);
      const { accessToken, refreshToken, user } = data.data;
      if (accessToken) {
        await tokenStorage.setTokens(accessToken, refreshToken);
        // FIX 10: API user কে auth-store User type এ map করো
        setUser({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          plan: 'free', // নতুন user সবসময় free
        });
        router.replace('/(main)/' as any);
      } else {
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
          
          <View style={s.header}>
            <View style={s.logoGlow} />
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={s.logoSquare}>
              <Text style={s.logoTxt}>S</Text>
            </LinearGradient>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.subtitle}>Join StreamPro Today</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputGroup}>
              <View style={s.inputWrapper}>
                <TextInput style={s.input} placeholder="Full Name *" placeholderTextColor="#A1A1AA" value={name} onChangeText={setName} />
              </View>
              <View style={s.inputWrapper}>
                <TextInput style={s.input} placeholder="Email" placeholderTextColor="#A1A1AA" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={s.inputWrapper}>
                <TextInput style={s.input} placeholder="Phone (optional)" placeholderTextColor="#A1A1AA" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
              <View style={s.inputWrapper}>
                <TextInput style={s.input} placeholder="Password *" placeholderTextColor="#A1A1AA" value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eye}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color="#A1A1AA" />
                </TouchableOpacity>
              </View>
              <View style={s.inputWrapper}>
                <TextInput style={s.input} placeholder="Confirm Password *" placeholderTextColor="#A1A1AA" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPass} />
              </View>
            </View>

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}

            <TouchableOpacity onPress={handleSignup} disabled={isLoading} style={s.btn}>
              <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGrad}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Sign Up</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={s.bottom}>
              <Text style={s.bottomTxt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={s.bottomLink}>Login</Text>
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
  logoTxt: { fontSize: 32, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#A1A1AA', fontFamily: 'Inter' },
  form: { flex: 1 },
  inputGroup: { gap: 16, marginBottom: 24 },
  inputWrapper: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  input: { flex: 1, color: '#fff', fontSize: 16, fontFamily: 'Inter', outlineWidth: 0 } as any,
  eye: { padding: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,59,48,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  errorTxt: { color: '#FF3B30', fontSize: 14, fontFamily: 'Inter', flex: 1 },
  btn: { borderRadius: 16, overflow: 'hidden', marginBottom: 32 },
  btnGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Inter' },
  bottom: { flexDirection: 'row', justifyContent: 'center' },
  bottomTxt: { color: '#A1A1AA', fontSize: 14, fontFamily: 'Inter' },
  bottomLink: { color: '#8B5CF6', fontSize: 14, fontWeight: 'bold', fontFamily: 'Inter' },
});
