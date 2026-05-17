/**
 * Check Email Screen
 * 
 * Shown after user signs up.
 * Instructs user to check their email and verify their account.
 * User clicks link in email → VerifyEmailScreen → back to Login.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import type { CheckEmailScreenProps } from '../types/navigation';
import { resendVerificationEmail } from '../services/emailVerificationService';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

type Props = CheckEmailScreenProps;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#f0f5ff',
    borderRadius: 6,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#333',
  },
  resendContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  resendLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  resendInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#c62828',
  },
  errorText: {
    color: '#c62828',
    fontSize: 13,
    lineHeight: 20,
  },
  successMessage: {
    color: '#27ae60',
    fontWeight: '600',
    marginTop: 12,
  },
});

interface CheckEmailState {
  isResending: boolean;
  message: string;
  showError: boolean;
  resendingEmail: string;
}

export default function CheckEmailScreen({ navigation, route }: Props) {
  const email = route.params?.email || '';
  
  const [state, setState] = useState<CheckEmailState>({
    isResending: false,
    message: '',
    showError: false,
    resendingEmail: email,
  });

  /**
   * Handle resend verification email
   */
  const handleResend = useCallback(async () => {
    const resendEmail = state.resendingEmail.trim();

    if (!resendEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isResending: true,
        showError: false,
        message: '',
      }));

      await resendVerificationEmail(resendEmail);

      setState((prev) => ({
        ...prev,
        isResending: false,
        message: '✓ Verification email sent! Check your inbox.',
        showError: false,
      }));

      logger.info('Verification email resent', { email: resendEmail });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      setState((prev) => ({
        ...prev,
        isResending: false,
        message: errorMsg || 'Failed to resend verification email. Please try again.',
        showError: true,
      }));
      logger.error('Resend verification failed', error);
    }
  }, [state.resendingEmail]);

  /**
   * Handle back to login
   */
  const handleBackToLogin = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.icon}>📧</Text>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitle}>
              We've sent a verification link to your email address.
            </Text>
          </View>

          {/* Email Display */}
          <Text style={styles.emailDisplay}>{email}</Text>

          {/* Instructions */}
          <Text style={styles.message}>
            Click the link in your email to verify your account. The link expires in 24 hours.
          </Text>

          {/* Error Message */}
          {state.showError && state.message && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{state.message}</Text>
            </View>
          )}

          {/* Success Message */}
          {!state.showError && state.message && (
            <Text style={[styles.message, styles.successMessage]}>{state.message}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleBackToLogin}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>

          {/* Resend Email Form */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendLabel}>
              Didn't receive the email? Request a new verification link:
            </Text>
            <TextInput
              style={styles.resendInput}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={state.resendingEmail}
              onChangeText={(text) =>
                setState((prev) => ({
                  ...prev,
                  resendingEmail: text,
                }))
              }
              editable={!state.isResending}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, state.isResending && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={state.isResending || !state.resendingEmail.trim()}
            >
              {state.isResending ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                </>
              ) : (
                <Text style={styles.buttonText}>Resend Verification Email</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
