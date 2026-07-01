import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useParentalControl,
  useUpdateParentalControl,
  useVerifyParentalPin,
} from '@/lib/api-hooks';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: 'rgba(255,255,255,0.06)',
};

export default function ParentalControlScreen() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [kidsProfile, setKidsProfile] = useState(true);
  const [teenProfile, setTeenProfile] = useState(false);
  const [adultProfile, setAdultProfile] = useState(false);
  
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);

  const { data: parentalData, isLoading, refetch } = useParentalControl();
  const updateMut = useUpdateParentalControl();
  const verifyPinMut = useVerifyParentalPin();

  useEffect(() => {
    if (parentalData) {
      setEnabled(parentalData.enabled ?? parentalData.isEnabled ?? false);
      const rating = parentalData.maxAgeRating || 'PG-13';
      if (rating === 'G' || rating === 'PG') { setKidsProfile(true); setTeenProfile(false); setAdultProfile(false); }
      else if (rating === 'PG-13') { setKidsProfile(false); setTeenProfile(true); setAdultProfile(false); }
      else { setKidsProfile(false); setTeenProfile(false); setAdultProfile(true); }
    }
  }, [parentalData]);

  const handleToggleEnable = (val: boolean) => {
    setEnabled(val);
    if (!val) {
      updateMut.mutate({ isEnabled: false });
    }
  };

  const handleSave = () => {
    const rating = kidsProfile ? 'PG' : teenProfile ? 'PG-13' : 'R';
    const pin = pinDigits.join('');
    
    if (enabled && pin.length < 4) {
      Alert.alert('PIN Required', 'Please set a 4-digit PIN to enable Parental Control.');
      return;
    }

    updateMut.mutate({
      isEnabled: enabled,
      maxAgeRating: rating,
      pin: pin.length === 4 ? pin : undefined
    }, {
      onSuccess: () => {
        Alert.alert('Success', 'Parental control settings saved.');
        refetch();
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
        <Text style={s.headerTitle}>Parental Control</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          
          {/* Enable Toggle */}
          <View style={[s.card, enabled && s.cardActive]}>
            <View style={s.row}>
              <View style={s.iconWrap}>
                <Ionicons name="shield-checkmark" size={24} color={enabled ? C.success : C.textSec} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Enable PIN</Text>
                <Text style={s.cardSubtitle}>Require PIN to change settings</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={handleToggleEnable}
                trackColor={{ false: '#2A2A3A', true: C.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {enabled && (
            <>
              {/* Set PIN */}
              <Text style={s.sectionTitle}>Set PIN</Text>
              <View style={s.pinContainer}>
                {pinDigits.map((digit, i) => (
                  <View key={i} style={s.pinBox}>
                    <TextInput
                      style={s.pinInput}
                      keyboardType="numeric"
                      maxLength={1}
                      value={digit}
                      secureTextEntry
                      onChangeText={(val) => {
                        const newDigits = [...pinDigits];
                        newDigits[i] = val.replace(/[^0-9]/g, '');
                        setPinDigits(newDigits);
                      }}
                    />
                  </View>
                ))}
              </View>

              {/* Mode Cards */}
              <Text style={s.sectionTitle}>Profile Mode</Text>
              <View style={s.modesContainer}>
                
                {/* Kids Mode */}
                <TouchableOpacity 
                  style={[s.modeCard, kidsProfile && { borderColor: C.success, backgroundColor: 'rgba(34,197,94,0.05)' }]}
                  onPress={() => { setKidsProfile(true); setTeenProfile(false); setAdultProfile(false); }}
                >
                  <View style={[s.modeIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Ionicons name="happy" size={24} color={C.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeTitle}>Kids Profile</Text>
                    <Text style={s.modeSubtitle}>Rated G & PG content only</Text>
                  </View>
                  <Switch value={kidsProfile} onValueChange={() => { setKidsProfile(true); setTeenProfile(false); setAdultProfile(false); }} trackColor={{ true: C.success }} />
                </TouchableOpacity>

                {/* Teen Mode */}
                <TouchableOpacity 
                  style={[s.modeCard, teenProfile && { borderColor: C.warning, backgroundColor: 'rgba(245,158,11,0.05)' }]}
                  onPress={() => { setKidsProfile(false); setTeenProfile(true); setAdultProfile(false); }}
                >
                  <View style={[s.modeIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Ionicons name="game-controller" size={24} color={C.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeTitle}>Teen Profile</Text>
                    <Text style={s.modeSubtitle}>Up to PG-13 content</Text>
                  </View>
                  <Switch value={teenProfile} onValueChange={() => { setKidsProfile(false); setTeenProfile(true); setAdultProfile(false); }} trackColor={{ true: C.warning }} />
                </TouchableOpacity>

                {/* Adult Mode */}
                <TouchableOpacity 
                  style={[s.modeCard, adultProfile && { borderColor: C.danger, backgroundColor: 'rgba(239,68,68,0.05)' }]}
                  onPress={() => { setKidsProfile(false); setTeenProfile(false); setAdultProfile(true); }}
                >
                  <View style={[s.modeIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Ionicons name="flame" size={24} color={C.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeTitle}>Adult Profile</Text>
                    <Text style={s.modeSubtitle}>All content accessible</Text>
                  </View>
                  <Switch value={adultProfile} onValueChange={() => { setKidsProfile(false); setTeenProfile(false); setAdultProfile(true); }} trackColor={{ true: C.danger }} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Save Button */}
          <TouchableOpacity onPress={handleSave} style={s.saveBtn}>
            <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.saveBtnGrad}>
              {updateMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Settings</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  cardActive: { borderColor: C.primary, backgroundColor: 'rgba(139,92,246,0.05)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.text, fontFamily: 'Inter' },
  cardSubtitle: { fontSize: 13, color: C.textSec, fontFamily: 'Inter', marginTop: 2 },
  
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.textSec, fontFamily: 'Inter', marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  
  pinContainer: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 8 },
  pinBox: { width: 60, height: 70, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  pinInput: { width: '100%', height: '100%', textAlign: 'center', fontSize: 24, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  
  modesContainer: { gap: 12 },
  modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
  modeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 16, fontWeight: '600', color: C.text, fontFamily: 'Inter' },
  modeSubtitle: { fontSize: 13, color: C.textSec, fontFamily: 'Inter', marginTop: 2 },
  
  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
});
