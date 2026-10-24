/**
 * "Check for update" (staging builds only, on the About screen).
 *
 * Over-the-air updates normally download in the background and apply on a later launch, which
 * looks like "updates never arrive". This button does the whole thing on demand and shows the real
 * result or error, so a tester can see why a phone is not updating.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginTop: 16 },
  button: { backgroundColor: '#0066cc', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { marginTop: 10, fontSize: 13, color: '#333' },
});

export async function runUpdateCheck(setStatus: (message: string) => void): Promise<void> {
  if (!Updates.isEnabled) {
    setStatus('Updates are not enabled in this build.');
    return;
  }
  try {
    setStatus('Checking for an update...');
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      setStatus('You already have the latest update.');
      return;
    }
    setStatus('Downloading the update...');
    await Updates.fetchUpdateAsync();
    setStatus('Restarting to apply the update...');
    await Updates.reloadAsync();
  } catch (error) {
    setStatus(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default function UpdateCheck(): React.JSX.Element {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const onPress = async (): Promise<void> => {
    setBusy(true);
    await runUpdateCheck(setStatus);
    setBusy(false);
  };

  return (
    <View style={styles.card} testID="update-check">
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Check for update"
        testID="update-check-button"
      >
        <Text style={styles.buttonText}>{busy ? 'Working...' : 'Check for update'}</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.status} testID="update-check-status">{status}</Text> : null}
    </View>
  );
}
