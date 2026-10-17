/**
 * About Screen
 *
 * Shows the app name, version, environment and build/update details so users
 * can quote them in bug reports. Read-only; never shows secrets or tokens.
 * (The app has no i18n layer yet; strings are English like the rest of the UI.)
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { getAboutInfo } from '../utils/aboutInfo';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24 },
  hero: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', borderRadius: 8, marginBottom: 16 },
  appName: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 6 },
  version: { fontSize: 16, color: '#333', marginBottom: 4 },
  environment: { fontSize: 14, fontWeight: '600', color: '#0066cc' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, color: '#333', fontWeight: '600', marginLeft: 12, flexShrink: 1, textAlign: 'right' },
});

function Row({ label, value, id }: { label: string; value: string; id: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={id}>{value}</Text>
    </View>
  );
}

export default function AboutScreen(): React.JSX.Element {
  const info = getAboutInfo();
  const envLabel = info.environment === 'staging' ? 'Staging' : 'Production';
  const updateValue = info.isEmbedded
    ? 'Embedded build'
    : `${info.updateId}${info.updateCreatedAt ? ` (${info.updateCreatedAt})` : ''}`;

  return (
    <ScreenContainer>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="about-screen">
      <View style={styles.hero} testID="about-summary">
        <Text style={styles.appName} testID="about-app-name">{info.appName}</Text>
        <Text style={styles.version} testID="about-version">{`Version ${info.version}`}</Text>
        <Text style={styles.environment} testID="about-environment">{`Environment: ${envLabel}`}</Text>
      </View>
      <View style={styles.card}>
        {info.buildNumber ? <Row id="about-build" label="Build" value={info.buildNumber} /> : null}
        <Row id="about-update" label="Update" value={updateValue} />
        <Row id="about-backend" label="Server" value={info.backendHost} />
      </View>
    </ScrollView>
    </ScreenContainer>
  );
}
