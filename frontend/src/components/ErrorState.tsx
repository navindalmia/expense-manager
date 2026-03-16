import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

/**
 * Error State Component
 * Displays error message with retry button
 */
function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <View 
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
      }}
      testID="error-state"
      accessible={true}
      accessibilityLabel={`Error: ${error}`}
    >
      <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
      <Text 
        style={{
          fontSize: 16,
          color: '#333',
          textAlign: 'center',
          marginBottom: 24,
        }}
        testID="error-message"
      >
        {error}
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#0066cc',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        onPress={onRetry}
        testID="retry-button"
        accessible={true}
        accessibilityLabel="Retry loading expenses"
        accessibilityRole="button"
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default memo(ErrorState);
