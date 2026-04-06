/**
 * Login Screen
 * 
 * Allows users to:
 * - Login with email/password
 * - Signup for new account
 * - Navigate between login and signup modes
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputFocused: {
    borderColor: '#0066cc',
  },
  nameInput: {
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
  },
  toggleLink: {
    color: '#0066cc',
    fontWeight: '600',
    marginLeft: 4,
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
});

export default function LoginScreen({ navigation }: Props) {
  // Auth state
  const { login, signup, isLoading, error, clearError } = useAuth();

  // Form state
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /**
   * Validate form inputs
   */
  const validateForm = useCallback((): boolean => {
    if (!email.trim()) {
      Alert.alert('Validation', 'Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Validation', 'Please enter a valid email');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Validation', 'Password is required');
      return false;
    }

    if (isSignupMode) {
      if (!name.trim()) {
        Alert.alert('Validation', 'Name is required');
        return false;
      }

      if (password.length < 8) {
        Alert.alert(
          'Validation',
          'Password must be at least 8 characters'
        );
        return false;
      }

      if (!/[A-Z]/.test(password)) {
        Alert.alert(
          'Validation',
          'Password must contain uppercase letter'
        );
        return false;
      }

      // if (!/[a-z]/.test(password)) {
      //   Alert.alert(
      //     'Validation',
      //     'Password must contain lowercase letter'
      //   );
      //   return false;
      // }

      if (!/[0-9]/.test(password)) {
        Alert.alert('Validation', 'Password must contain a number');
        return false;
      }

      if (!/[!@#$%^&*]/.test(password)) {
        Alert.alert(
          'Validation',
          'Password must contain special character (!@#$%^&*)'
        );
        return false;
      }
    }

    return true;
  }, [email, password, name, isSignupMode]);

  /**
   * Handle login
   */
  const handleLogin = useCallback(async () => {
    if (!validateForm()) return;

    try {
      clearError();
      await login(email.trim(), password);
      logger.info('Login successful', { email });
      // Navigation handled by navigation state
    } catch (err) {
      logger.error('Login failed', err);
      // Error is displayed via error state
    }
  }, [email, password, login, validateForm, clearError]);

  /**
   * Handle signup
   */
  const handleSignup = useCallback(async () => {
    if (!validateForm()) return;

    try {
      clearError();
      await signup(email.trim(), password, name.trim());
      logger.info('Signup successful', { email });
      // Navigation handled by navigation state
    } catch (err) {
      logger.error('Signup failed', err);
      // Error is displayed via error state
    }
  }, [email, password, name, signup, validateForm, clearError]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Expense Manager</Text>
        <Text style={styles.subtitle}>
          {isSignupMode ? 'Create Account' : 'Welcome Back'}
        </Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
        {/* Name input (Signup only) */}
        {isSignupMode && (
          <View style={[styles.inputContainer, styles.nameInput]}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'name' && styles.inputFocused,
              ]}
              placeholder="John Doe"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              editable={!isLoading}
            />
          </View>
        )}

        {/* Email input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'email' && styles.inputFocused,
            ]}
            placeholder="john@example.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        {/* Password input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'password' && styles.inputFocused,
            ]}
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry
            editable={!isLoading}
          />
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={isSignupMode ? handleSignup : handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignupMode ? 'Create Account' : 'Login'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Toggle signup/login */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleText}>
          {isSignupMode ? 'Already have account?' : "Don't have account?"}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setIsSignupMode(!isSignupMode);
            clearError();
            setEmail('');
            setPassword('');
            setName('');
          }}
          disabled={isLoading}
        >
          <Text style={styles.toggleLink}>
            {isSignupMode ? 'Login' : 'Signup'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
