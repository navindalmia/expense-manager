/**
 * Verify Email Screen
 * 
 * Allows users to verify their email address after signup.
 * Called when user clicks the verification link from their email.
 * Extracts token from URL params and verifies with backend.
 */

import React, { useState, useEffect } from 'react';
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
import type { VerifyEmailScreenProps } from '../types/navigation';
import { verifyEmailToken, resendVerificationEmail } from '../services/emailVerificationService';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

type Props = VerifyEmailScreenProps;

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
  successMessage: {
    color: '#27ae60',
    fontWeight: '600',
  },
  errorMessage: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  warningMessage: {
    color: '#f39c12',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  spinner: {
    marginBottom: 12,
  },
  spinnerText: {
    fontSize: 14,
    color: '#666',
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
  tokenDisplay: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
});

interface VerifyEmailState {
  status: 'loading' | 'verifying' | 'success' | 'error' | 'idle';
  message: string;
  token: string | null;
  email: string | null;
  resendingEmail: string;
  isResending: boolean;
}

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [state, setState] = useState<VerifyEmailState>({
    status: 'loading',
    message: 'Checking your verification link...',
    token: null,
    email: null,
    resendingEmail: '',
    isResending: false,
  });

  /**
   * Extract token from route params on component mount
   * Automatically start verification process
   */
  useEffect(() => {
    const extractAndVerify = async () => {
      try {
        // Get token from route params (from deep link or navigation)
        // Deep link: expensemanager://verify-email/vrf_xxx → route.params?.token
        // Or manually passed: route.params?.token
        const token = route.params?.token;

        if (!token) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            message: 'No verification token found. Please check your email link.',
          }));
          logger.warn('VerifyEmailScreen: No token in params');
          return;
        }

        setState((prev) => ({
          ...prev,
          status: 'verifying',
          message: 'Verifying your email...',
          token,
        }));

        // Call backend to verify token
        const response = await verifyEmailToken(token);

        if (response.success) {
          setState((prev) => ({
            ...prev,
            status: 'success',
            message: '✓ Email verified successfully!',
            email: response.data.user.email,
          }));
          logger.info('Email verified', { userId: response.data.user.id });

          // Auto-redirect to login after 2 seconds
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'Login',
                },
              ],
            });
          }, 2000);
        }
      } catch (error) {
        const errorMsg = getErrorMessage(error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          message:
            errorMsg ||
            'Invalid or expired verification token. Please request a new one.',
        }));
        logger.error('Email verification failed', error);
      }
    };

    extractAndVerify();
  }, [route.params?.token, navigation]);

  /**
   * Handle resend verification email
   */
  const handleResend = async () => {
    const email = state.resendingEmail.trim();

    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isResending: true,
      }));

      await resendVerificationEmail(email);

      setState((prev) => ({
        ...prev,
        isResending: false,
        message: '✓ Verification email sent! Check your inbox.',
        status: 'idle',
      }));

      logger.info('Verification email resent', { email });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      setState((prev) => ({
        ...prev,
        isResending: false,
        message:
          errorMsg ||
          'Failed to resend verification email. Please try again.',
        status: 'error',
      }));
      logger.error('Resend verification failed', error);
    }
  };

  /**
   * Handle back to login button
   */
  const handleBackToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            {state.status === 'success' ? (
              <>
                <Text style={styles.icon}>✅</Text>
                <Text style={styles.title}>Email Verified!</Text>
              </>
            ) : state.status === 'error' ? (
              <>
                <Text style={styles.icon}>❌</Text>
                <Text style={styles.title}>Verification Failed</Text>
              </>
            ) : (
              <>
                <Text style={styles.icon}>📧</Text>
                <Text style={styles.title}>Verify Your Email</Text>
              </>
            )}
            <Text style={styles.subtitle}>
              {state.status === 'success'
                ? 'Your email has been verified successfully.'
                : 'Please verify your email address to complete your account setup.'}
            </Text>
          </View>

          {/* Status Message */}
          {state.status === 'loading' || state.status === 'verifying' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#0066cc"
                style={styles.spinner}
              />
              <Text style={styles.spinnerText}>{state.message}</Text>
            </View>
          ) : (
            <>
              <Text
                style={[
                  styles.message,
                  state.status === 'success' && styles.successMessage,
                  state.status === 'error' && styles.errorMessage,
                  state.status === 'idle' && styles.warningMessage,
                ]}
              >
                {state.message}
              </Text>

              {/* Token display for debugging */}
              {state.token && __DEV__ && (
                <View style={styles.tokenDisplay}>
                  <Text style={styles.tokenLabel}>Token (Debug)</Text>
                  <Text style={styles.tokenText}>{state.token}</Text>
                </View>
              )}
            </>
          )}

          {/* Action Buttons */}
          {state.status === 'success' && (
            <View style={styles.buttonContainer}>
              <Text style={[styles.message, { fontSize: 13, color: '#666' }]}>
                Redirecting to login in a moment...
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleBackToLogin}>
                <Text style={styles.buttonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Resend Email Form */}
          {(state.status === 'error' || state.status === 'idle') && (
            <>
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={handleBackToLogin}>
                  <Text style={styles.buttonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.resendContainer}>
                <Text style={styles.resendLabel}>
                  {state.token
                    ? 'Token expired? Request a new verification link:'
                    : 'Request a new verification email:'}
                </Text>

                <TextInput
                  style={[
                    styles.resendInput,
                  ]}
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
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

