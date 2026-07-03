import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/lib/api-hooks';
import { useAuthStore } from '@/lib/auth-store';
import apiClient from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.1)',
  danger: '#FF3B30',
};

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const { data: profileData, isLoading } = useProfile();

  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate fields once profile data loads
  React.useEffect(() => {
    if (profileData) {
      setName(profileData.name  || user?.name  || '');
      setPhone(profileData.phone || '');
    } else if (user) {
      setName(user.name || '');
    }
  }, [profileData, user]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = { name: trimmedName };
      if (phone.trim()) payload.phone = phone.trim();

      await apiClient.put('/auth/profile', payload);

      // Update local auth store so the header/profile card reflects the change
      if (user) setUser({ ...user, name: trimmedName });

      // Invalidate cached profile queries
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      Alert.alert('Success', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to update profile.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = profileData?.name || user?.name || 'User';
  const initials = displayName
    .split(' ')
    .filter((p: string) => p.length > 0)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={saving} style={s.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Text style={s.saveTxt}>Save</Text>}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Avatar (display only — photo upload requires native image picker integration) */}
          <View style={s.avatarWrap}>
            {isLoading ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <LinearGradient colors={[C.primary, C.accent]} style={s.avatar}>
                <Text style={s.avatarTxt}>{initials}</Text>
              </LinearGradient>
            )}
          </View>

          {/* Fields */}
          <View style={s.formCard}>
            <Field
              label="Full Name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Your display name"
              autoCapitalize="words"
            />
            <View style={s.divider} />
            <Field
              label="Phone"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="Optional phone number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Read-only info */}
          <View style={s.formCard}>
            <ReadOnlyField
              label="Email"
              icon="mail-outline"
              value={profileData?.email || user?.email || '—'}
            />
          </View>
          <Text style={s.hint}>Email cannot be changed. Contact support if you need to update it.</Text>

          {/* Save button */}
          <Pressable onPress={handleSave} disabled={saving} style={s.saveFullBtn}>
            <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveFullGrad}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveFullTxt}>Save Changes</Text>}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, icon, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={s.fieldRow}>
      <View style={s.fieldIcon}>
        <Ionicons name={icon} size={18} color={C.primary} />
      </View>
      <View style={s.fieldContent}>
        <Text style={s.fieldLabel}>{label}</Text>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textSec}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

function ReadOnlyField({ label, icon, value }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={s.fieldRow}>
      <View style={s.fieldIcon}>
        <Ionicons name={icon} size={18} color={C.textSec} />
      </View>
      <View style={s.fieldContent}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.fieldInput, { color: C.textSec }]}>{value}</Text>
      </View>
      <Ionicons name="lock-closed-outline" size={14} color="rgba(255,255,255,0.2)" />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveTxt: { fontSize: 15, fontWeight: '600', color: C.primary },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  avatarWrap: {
    alignItems: 'center', marginVertical: 24,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 32, fontWeight: '800', color: '#fff' },

  formCard: {
    backgroundColor: C.card, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 56 },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  fieldIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, color: C.textSec, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { fontSize: 15, color: C.text, fontWeight: '500' },

  hint: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 24, marginTop: -4 },

  saveFullBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveFullGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveFullTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
