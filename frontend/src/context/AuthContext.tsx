/**
 * Auth Context & Provider
 * 
 * Manages JWT token and user authentication state globally.
 * - Stores token in AsyncStorage (persistent)
 * - Stores user info in state
 * - Provides login, signup, logout functions
 * - Hydrates on app startup
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { http } from '../api/http';
import { setAuthToken } from '../api/http/interceptors';
import { logger } from '../utils/logger';

export interface User {
  id: number;
  email: string;
  name: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface AuthContextType {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrating: boolean;

  // Methods
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;

  // Computed
  isAuthenticated: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_TOKEN = '@expense_manager_token';
const STORAGE_KEY_USER = '@expense_manager_user';

/**
 * Auth Provider Component
 * Wraps entire app to provide auth state globally
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Hydrate auth state from AsyncStorage on app startup
   */
  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);

        const storedToken = stored[0];
        const storedUserStr = stored[1];

        if (storedToken && storedUserStr) {
          const storedUser = JSON.parse(storedUserStr);
          setAuthToken(storedToken);
          setToken(storedToken);
          setUser(storedUser);
          logger.info('Auth hydrated from storage');
        }
      } catch (err) {
        logger.error('Failed to hydrate auth', err);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate();
  }, []);

  /**
   * Signup: Create new account
   */
  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await http.post('/auth/signup', {
          email,
          password,
          name,
        });

        const { token: newToken, user: newUser } = response.data.data;

        // Store token and user
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
          AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
        ]);

        setAuthToken(newToken);
        setToken(newToken);
        setUser(newUser);
        logger.info('Signup successful', { userId: newUser.id });
      } catch (err: any) {
        // Extract error details from normalized error
        let errorMessage = 'Signup failed';
        
        // Debug: log error structure
        console.log('Signup error:', {
          message: err.message,
          code: err.code,
          status: err.status,
          data: err.data,
        });
        
        // Check if backend returned validation details
        if (err.data?.details && Array.isArray(err.data.details)) {
          errorMessage = err.data.details
            .map((detail: any) => detail.message)
            .join('\n');
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        logger.error('Signup failed', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Login: Authenticate with email/password
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await http.post('/auth/login', {
        email,
        password,
      });

      const { token: newToken, user: newUser } = response.data.data;

      // Store token and user
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
        AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
      ]);

      setAuthToken(newToken);
      setToken(newToken);
      setUser(newUser);
      logger.info('Login successful', { userId: newUser.id });
    } catch (err: any) {
      // Extract error details from normalized error
      let errorMessage = 'Login failed';
      
      // Debug: log error structure
      console.log('Login error:', {
        message: err.message,
        code: err.code,
        status: err.status,
        data: err.data,
      });
      
      // Check if backend returned validation details
      if (err.data?.details && Array.isArray(err.data.details)) {
        errorMessage = err.data.details
          .map((detail: any) => detail.message)
          .join('\n');
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      logger.error('Login failed', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout: Clear auth state and storage
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      // Clear storage
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEY_USER),
      ]);

      // Clear auth token from interceptor
      setAuthToken(null);

      // Clear state
      setToken(null);
      setUser(null);
      setError(null);

      logger.info('Logout successful');
    } catch (err) {
      logger.error('Logout failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isHydrating,
    signup,
    login,
    logout,
    clearError,
    isAuthenticated: !!token && !!user,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth Hook
 * Use this in any component to access auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
