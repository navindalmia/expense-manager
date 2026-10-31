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
  // data-rn-safe-area-view lets regression tests assert that a given piece
  // of UI is actually wrapped in a SafeAreaView (which applies safe-area /
  // system-nav-bar insets) rather than a plain View, without depending on
  // real inset values jsdom cannot compute (see issue #45).
  SafeAreaView: ({ children, ...props }: any) => (
    <div data-rn-safe-area-view="true" {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  // contentContainerStyle is not a DOM attribute; expose its paddingBottom so tests can assert on it.
  ScrollView: ({ children, contentContainerStyle, ...props }: any) => (
    <div {...props} data-content-padding-bottom={contentContainerStyle?.paddingBottom}>{children}</div>
  ),
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
  RefreshControl: () => null,
  ActivityIndicator: (props: any) => <div {...props}>loading</div>,
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style || {}),
  },
  Platform: { OS: 'ios' },
  Dimensions: { get: () => ({ width: 360, height: 800 }) },
  Alert: { alert: vi.fn() },
  Linking: { canOpenURL: vi.fn().mockResolvedValue(false), openURL: vi.fn() },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => (
    <div data-rn-safe-area-view="true" {...props}>{children}</div>
  ),
  SafeAreaProvider: ({ children }: any) => <div>{children}</div>,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Native Expo modules crash on import under jsdom (no ExpoGlobal). The staging marker imports
// them (appVariant -> expo-constants, updateInfo -> expo-updates), so every screen test needs
// inert defaults. Tests that care mock them explicitly.
vi.mock('expo-updates', () => ({
  isEmbeddedLaunch: true, updateId: null, createdAt: null, isEnabled: true,
  checkForUpdateAsync: vi.fn().mockResolvedValue({ isAvailable: false }),
  fetchUpdateAsync: vi.fn().mockResolvedValue({ isNew: true }),
  reloadAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));

// __DEV__ is injected by the Metro/RN bundler at build time; not present
// under Vitest/jsdom, but referenced by some screens for debug-only UI.
(globalThis as any).__DEV__ = false;

// React 18 requires this flag for @testing-library/react's act() wrapping
// to work without warnings in a non-browser test environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Global test utilities
global.fetch = vi.fn();
