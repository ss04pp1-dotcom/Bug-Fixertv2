import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionPlans, useMySubscription } from '@/lib/api-hooks';
import apiClient from '@/lib/api';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
  gold: '#F5C518',
};


export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [loading, setLoading] = useState(false);
  const { data: plansData, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: currentSub } = useMySubscription();

  const plans = (plansData && Array.isArray(plansData))
    ? plansData.map((p: any, i: number) => ({
        id: p.id || p.name?.toLowerCase() || String(i),
        name: p.name || `Plan ${i + 1}`,
        price: p.price || p.amount || 0,
        period: p.description || p.period || '1 Month',
        features: p.features || [],
        popular: p.popular || i === 1,
        theme: i === 2 ? 'gradient' : (i === 1 ? 'border' : 'dark'),
      }))
    : [];

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await apiClient.post('/subscriptions/subscribe', { planId: selectedPlan });
      Alert.alert('Success', 'Subscription activated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        {/* Title */}
        <View style={s.titleArea}>
          <Text style={s.mainTitle}>Choose Your Plan</Text>
          <Text style={s.mainSubtitle}>Upgrade to enjoy unlimited entertainment</Text>
        </View>

        {plansLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={s.plansContainer}>
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              
              const isGradient = plan.theme === 'gradient';
              const isBorder = plan.theme === 'border';
              
              const CardContent = () => (
                <>
                  <View style={s.planTop}>
                    <View>
                      <Text style={[s.planName, isGradient && {color: '#fff'}]}>{plan.name}</Text>
                      <Text style={[s.planPeriod, isGradient && {color: 'rgba(255,255,255,0.8)'}]}>{plan.period}</Text>
                    </View>
                    <View style={s.planPriceArea}>
                      <Text style={[s.planCurrency, isGradient && {color: '#fff'}]}>₹</Text>
                      <Text style={[s.planPrice, isGradient && {color: '#fff'}]}>{plan.price}</Text>
                    </View>
                  </View>
                  
                  <View style={s.featuresArea}>
                    {plan.features.map((f: string, i: number) => (
                      <View key={i} style={s.featureRow}>
                        <Ionicons name="checkmark-circle" size={18} color={isGradient ? '#fff' : C.primary} />
                        <Text style={[s.featureTxt, isGradient && {color: '#fff'}]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={[s.selectRow, isGradient && { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                    <View style={[s.radioOuter, isSelected && s.radioOuterSelected, isGradient && { borderColor: 'rgba(255,255,255,0.5)' }, isGradient && isSelected && { borderColor: '#fff' }]}>
                      {isSelected && <View style={[s.radioInner, isGradient && { backgroundColor: '#fff' }]} />}
                    </View>
                    <Text style={[s.selectTxt, isGradient && {color: '#fff'}]}>
                      {currentSub?.plan?.id === plan.id ? 'Current Plan' : (isSelected ? 'Selected' : 'Select Plan')}
                    </Text>
                  </View>
                </>
              );

              return (
                <Pressable key={plan.id} onPress={() => setSelectedPlan(plan.id)} style={s.planWrapper}>
                  {plan.popular && (
                    <View style={s.popularBadge}>
                      <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.popularGrad}>
                        <Text style={s.popularTxt}>POPULAR</Text>
                      </LinearGradient>
                    </View>
                  )}
                  
                  {isGradient ? (
                     <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.planCardBase, s.planCardGradient]}>
                        <CardContent />
                     </LinearGradient>
                  ) : (
                     <View style={[s.planCardBase, isBorder ? s.planCardBorder : s.planCardDark, isSelected && !isGradient && s.planCardSelected]}>
                        <CardContent />
                     </View>
                  )}
                  {currentSub?.plan?.id === plan.id && (
                     <View style={{ position: 'absolute', top: 20, right: 20 }}>
                        <Ionicons name="checkmark-circle" size={24} color={C.success} />
                     </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Continue Button */}
        <Pressable onPress={handleSubscribe} disabled={loading} style={s.continueBtn}>
          <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.continueBtnGrad}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.continueBtnTxt}>Continue</Text>}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  titleArea: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  mainTitle: { fontSize: 26, fontWeight: '900', color: C.text, fontFamily: 'Outfit', marginBottom: 8, textAlign: 'center' },
  mainSubtitle: { fontSize: 14, color: C.textSec, fontFamily: 'Inter', textAlign: 'center' },
  plansContainer: { paddingHorizontal: 16, gap: 16 },
  planWrapper: { position: 'relative' },
  popularBadge: { position: 'absolute', top: -12, right: 20, zIndex: 10, borderRadius: 12, overflow: 'hidden' },
  popularGrad: { paddingHorizontal: 12, paddingVertical: 4 },
  popularTxt: { fontSize: 10, fontWeight: '800', color: '#fff', fontFamily: 'Inter', letterSpacing: 1 },
  
  planCardBase: { borderRadius: 24, padding: 24 },
  planCardDark: { backgroundColor: C.card, borderWidth: 2, borderColor: 'rgba(255,255,255,0.05)' },
  planCardBorder: { backgroundColor: '#13131C', borderWidth: 2, borderColor: 'rgba(139,92,246,0.3)' },
  planCardGradient: { },
  planCardSelected: { borderColor: C.primary },
  
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  planName: { fontSize: 22, fontWeight: '800', color: C.text, fontFamily: 'Outfit', marginBottom: 4 },
  planPeriod: { fontSize: 13, color: C.textSec, fontFamily: 'Inter' },
  planPriceArea: { flexDirection: 'row', alignItems: 'flex-start' },
  planCurrency: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Inter', marginTop: 4 },
  planPrice: { fontSize: 40, fontWeight: '900', color: C.text, fontFamily: 'Outfit' },
  featuresArea: { gap: 12, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureTxt: { fontSize: 14, color: C.textSec, fontFamily: 'Inter' },
  
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: C.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  selectTxt: { fontSize: 14, fontWeight: '600', color: C.textSec, fontFamily: 'Inter' },
  continueBtn: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  continueBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  continueBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
});
