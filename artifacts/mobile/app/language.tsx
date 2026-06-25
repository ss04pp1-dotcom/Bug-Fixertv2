import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings, useUpdateSetting } from '@/lib/api-hooks';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.06)',
};

const LANGUAGES = [
  { id: 'en', name: 'English', script: 'English' },
  { id: 'bn', name: 'বাংলা', script: 'Bangla' },
  { id: 'hi', name: 'हिन्दी', script: 'Hindi' },
  { id: 'ar', name: 'العربية', script: 'Arabic' },
  { id: 'es', name: 'Español', script: 'Spanish' },
];

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { data: settingsData, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  
  const [selectedLang, setSelectedLang] = useState('en');

  // Sync state once data loads
  React.useEffect(() => {
    if (settingsData?.language) {
      setSelectedLang(settingsData.language);
    }
  }, [settingsData]);

  const handleSave = () => {
    updateSetting.mutate({ key: 'language', value: selectedLang }, {
      onSuccess: () => {
        Alert.alert('Success', 'Language preference updated.');
        router.back();
      }
    });
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Language</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            <View style={s.listCard}>
              {LANGUAGES.map((lang, idx) => {
                const isSelected = selectedLang === lang.id;
                return (
                  <TouchableOpacity
                    key={lang.id}
                    style={[s.langRow, idx < LANGUAGES.length - 1 && s.langRowBorder]}
                    onPress={() => setSelectedLang(lang.id)}
                  >
                    <View style={s.langInfo}>
                      <Text style={s.langName}>{lang.name}</Text>
                      <Text style={s.langScript}>{lang.script}</Text>
                    </View>
                    <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
                      {isSelected && <View style={s.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity onPress={handleSave} style={s.saveBtn}>
              <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.saveBtnGrad}>
                {updateSetting.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  listCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  langRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  langInfo: { flex: 1 },
  langName: { fontSize: 16, fontWeight: '600', color: C.text, fontFamily: 'Inter', marginBottom: 2 },
  langScript: { fontSize: 13, color: C.textSec, fontFamily: 'Inter' },
  
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: C.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  
  footer: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: C.bg },
  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
});
