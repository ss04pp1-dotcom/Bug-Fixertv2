import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCreateTicket } from '@/lib/api-hooks';

export default function SupportScreen() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const createTicket = useCreateTicket();

  const isValid = subject.trim().length > 0 && message.trim().length > 0;
  const isSubmitting = createTicket.isPending;
  const isSuccess = createTicket.isSuccess;

  const handleSubmit = () => {
    if (!isValid || isSubmitting) return;
    createTicket.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {},
      }
    );
  };

  const handleReset = () => {
    createTicket.reset();
    setSubject('');
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#F2F2F7" />
          </Pressable>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={{ width: 42 }} />
        </View>

        {isSuccess ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Ticket Submitted!</Text>
            <Text style={styles.successSubtitle}>
              We'll get back to you within 24 hours. Check your email for updates.
            </Text>
            <Pressable onPress={handleReset} style={styles.newTicketButton}>
              <LinearGradient colors={['#7C3AED', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newTicketGradient}>
                <Text style={styles.newTicketText}>Submit Another Ticket</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.formDescription}>
              Having trouble? Describe your issue and our team will help you resolve it.
            </Text>

            {/* Subject */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Brief description of your issue"
                placeholderTextColor="#6B6B80"
                value={subject}
                onChangeText={setSubject}
                returnKeyType="next"
                autoCorrect={false}
              />
            </View>

            {/* Message */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe your issue in detail..."
                placeholderTextColor="#6B6B80"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoCorrect={false}
              />
            </View>

            {createTicket.isError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorText}>Failed to submit. Please try again.</Text>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              style={[styles.submitButton, (!isValid || isSubmitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <LinearGradient
                  colors={['#7C3AED', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText}>Submit Ticket</Text>
                </LinearGradient>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F2F2F7',
    fontFamily: 'Inter',
  },
  form: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  formDescription: {
    fontSize: 14,
    color: '#6B6B80',
    fontFamily: 'Inter',
    lineHeight: 20,
    marginBottom: 28,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B3B8C8',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#121A2F',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#F2F2F7',
    fontFamily: 'Inter',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  textArea: {
    minHeight: 140,
    paddingTop: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontFamily: 'Inter',
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successIconWrapper: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F2F2F7',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B6B80',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  newTicketButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  newTicketGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 18,
  },
  newTicketText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
});