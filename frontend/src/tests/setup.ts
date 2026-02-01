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
  FlatList: ({ data, renderItem, ...props }: any) => (
    <div {...props}>
      {data?.map((item: any, idx: number) => (
        <div key={idx}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
  TouchableOpacity: ({ children, onPress, ...props }: any) => (
    <button {...props} onClick={onPress}>{children}</button>
  ),
  TextInput: (props: any) => <input {...props} />,
  StyleSheet: { create: (styles: any) => styles },
}));

// Global test utilities
global.fetch = vi.fn();
