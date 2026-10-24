/**
 * Device diagnostics (staging builds only, shown on the About screen).
 *
 * Layout bugs that only appear on one phone (e.g. Samsung 3-button navigation hiding bottom
 * buttons) cannot be reproduced on the CI emulator, so a tester sends a photo of this card and
 * we read what the device actually reports instead of guessing. Never shows anything private.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginTop: 16 },
  title: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 13, color: '#666' },
  value: { fontSize: 13, color: '#333', fontWeight: '600', marginLeft: 12, flexShrink: 1, textAlign: 'right' },
});

interface AndroidConstants {
  Manufacturer?: string;
  Model?: string;
  Release?: string;
  Version?: number;
}

export function describeDevice(constants: AndroidConstants | undefined, os: string): string {
  if (os !== 'android' || !constants) return os;
  const maker = [constants.Manufacturer, constants.Model].filter(Boolean).join(' ') || 'Android';
  return `${maker}, Android ${constants.Release ?? '?'} (API ${constants.Version ?? '?'})`;
}

function Row({ label, value, id }: { label: string; value: string; id: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={id}>{value}</Text>
    </View>
  );
}

export default function DeviceDiagnostics(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const window = Dimensions.get('window');
  const screen = Dimensions.get('screen');
  const constants = (Platform as { constants?: AndroidConstants }).constants;

  return (
    <View style={styles.card} testID="device-diagnostics">
      <Text style={styles.title}>Device (staging only)</Text>
      <Row id="diag-device" label="Device" value={describeDevice(constants, Platform.OS)} />
      <Row id="diag-insets" label="Insets top / bottom" value={`${insets.top} / ${insets.bottom}`} />
      <Row id="diag-window" label="Window (w x h)" value={`${Math.round(window.width)} x ${Math.round(window.height)}`} />
      <Row id="diag-screen" label="Screen (w x h)" value={`${Math.round(screen.width)} x ${Math.round(screen.height)}`} />
    </View>
  );
}
