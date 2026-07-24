/**
 * Vitest setup file for frontend tests
 * - Setup testing library
 * - Mock Axios
 * - Configure test environment
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

// Mock React Native Web
vi.mock('react-native', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  KeyboardAvoidingView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Modal: ({ children, visible }: any) => (visible ? <div>{children}</div> : null),
  FlatList: ({ data, renderItem, ...props }: any) => (
    <div {...props}>
      {data?.map((item: any, idx: number) => (
        <div key={idx}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
  TouchableOpacity: ({ children, onPress, disabled, ...props }: any) => (
    <button {...props} onClick={disabled ? undefined : onPress} disabled={disabled}>
      {children}
    </button>
  ),
  TextInput: ({ onChangeText, ...props }: any) => (
    <input {...props} onChange={(e: any) => onChangeText?.(e.target.value)} />
  ),
  ActivityIndicator: (props: any) => <div {...props}>loading</div>,
  StyleSheet: { create: (styles: any) => styles },
  Platform: { OS: 'ios' },
  Alert: { alert: vi.fn() },
  Linking: { canOpenURL: vi.fn().mockResolvedValue(false), openURL: vi.fn() },
}));

// __DEV__ is injected by the Metro/RN bundler at build time; not present
// under Vitest/jsdom, but referenced by some screens for debug-only UI.
(globalThis as any).__DEV__ = false;

// React 18 requires this flag for @testing-library/react's act() wrapping
// to work without warnings in a non-browser test environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Global test utilities
global.fetch = vi.fn();
