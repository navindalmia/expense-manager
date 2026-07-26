/**
 * Cross-Platform Alert Utility
 *
 * React Native's Alert.alert has no web implementation, so on web it is a
 * silent no-op — any onPress callback passed to it (e.g. navigation) never
 * fires. This wraps a single-button confirmation so it works on both.
 */

import { Alert, Platform } from 'react-native';

export function alertThenContinue(title: string, message: string, onContinue: () => void): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onContinue();
    return;
  }

  Alert.alert(title, message, [{ text: 'OK', onPress: onContinue }]);
}

export function confirmThenProceed(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm, style: 'destructive' },
  ]);
}
