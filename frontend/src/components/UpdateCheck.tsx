/**
 * "Check for update" control (Home screen footer). Over-the-air updates otherwise download in the
 * background and apply on a later launch; this does the whole thing on demand and shows the result.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { updateText } from '../utils/updateStrings';

const styles = StyleSheet.create({
  card: { padding: 16, marginTop: 8 },
  button: { backgroundColor: '#0066cc', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { marginTop: 10, fontSize: 13, color: '#333' },
});

export async function runUpdateCheck(setStatus: (message: string) => void): Promise<void> {
  if (!Updates.isEnabled) {
    setStatus(updateText('disabled'));
    return;
  }
  try {
    setStatus(updateText('checking'));
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      setStatus(updateText('latest'));
      return;
    }
    setStatus(updateText('downloading'));
    await Updates.fetchUpdateAsync();
    setStatus(updateText('restarting'));
    await Updates.reloadAsync();
  } catch (error) {
    setStatus(`${updateText('failed')}: ${error instanceof Error ? error.message : String(error)}`);
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
        accessibilityLabel={updateText('button')}
        testID="update-check-button"
      >
        <Text style={styles.buttonText}>{busy ? updateText('working') : updateText('button')}</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.status} testID="update-check-status">{status}</Text> : null}
    </View>
  );
}
