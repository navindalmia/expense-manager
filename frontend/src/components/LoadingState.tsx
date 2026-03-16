import React, { memo } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingStateProps {
  message?: string;
  color?: string;
}

/**
 * Loading State Component
 * Displays a spinner with optional message
 */
function LoadingState({ message = 'Loading expenses...', color = '#0066cc' }: LoadingStateProps) {
  return (
    <View 
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      testID="loading-state"
      accessible={true}
      accessibilityLabel={message}
    >
      <ActivityIndicator size="large" color={color} />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
        {message}
      </Text>
    </View>
  );
}

export default memo(LoadingState);
