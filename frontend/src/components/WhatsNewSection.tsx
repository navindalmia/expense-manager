/**
 * What's New section of the About screen (staging builds only)
 *
 * Lets testers read the release notes inside the app. Latest release first, older ones collapsed
 * behind a "See all" toggle.
 * Release text arrives already reduced to plain strings by releaseNotesService.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { getWhatsNewStrings, type WhatsNewStrings } from '../i18n/whatsNewStrings';
import {
  fetchReleaseNotes,
  type ReleaseNote,
  type ReleaseNotesErrorKind,
  type ReleaseNotesResult,
} from '../services/releaseNotesService';

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12 },
  heading: { fontSize: 13, fontWeight: '700', color: '#0066cc', marginBottom: 4 },
  releaseDate: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  bullet: { fontSize: 15, color: '#333', paddingVertical: 3 },
  muted: { fontSize: 14, color: '#666' },
  notice: { fontSize: 13, color: '#8a6d00', marginBottom: 8 },
  error: { fontSize: 14, color: '#b00020', marginBottom: 8 },
  button: { backgroundColor: '#0066cc', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggle: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#0066cc', fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
  toggleText: { color: '#0066cc', fontSize: 15, fontWeight: '600' },
});

const ALL_RELEASES_URL = 'https://github.com/navindalmia/expense-manager/releases';

const ERROR_TEXT: Record<ReleaseNotesErrorKind, keyof WhatsNewStrings> = {
  offline: 'errorOffline',
  rate_limit: 'errorRateLimit',
  not_found: 'errorNotFound',
  http: 'errorGeneric',
  bad_response: 'errorBadResponse',
};

function ReleaseCard({ note, heading, strings, index }: {
  note: ReleaseNote; heading: string; strings: WhatsNewStrings; index: number;
}): React.JSX.Element {
  return (
    <View style={styles.card} testID={`whats-new-release-${index}`}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.releaseDate} testID={`whats-new-release-${index}-date`}>{note.date ?? note.tag}</Text>
      {note.bullets.length === 0 ? <Text style={styles.muted}>{strings.noBullets}</Text> : null}
      {note.bullets.map((bullet, i) => (
        <Text key={`${note.tag}-${i}`} style={styles.bullet}>{`• ${bullet}`}</Text>
      ))}
    </View>
  );
}

export default function WhatsNewSection(): React.JSX.Element {
  const strings = getWhatsNewStrings();
  const [result, setResult] = useState<ReleaseNotesResult | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++requestId.current;
    setResult(null);
    const next = await fetchReleaseNotes();
    if (id === requestId.current) setResult(next);
  }, []);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  const releases = result?.releases ?? [];
  const [latest, ...older] = releases;

  return (
    <View style={styles.section} testID="whats-new-section">
        <Text style={styles.title}>{strings.title}</Text>
        {result === null ? <Text style={styles.muted} testID="whats-new-loading">{strings.loading}</Text> : null}
        {result?.error ? (
          <Text style={styles.error} testID="whats-new-error">{strings[ERROR_TEXT[result.error]]}</Text>
        ) : null}
        {result?.fromCache ? <Text style={styles.notice} testID="whats-new-cached">{strings.showingSaved}</Text> : null}
        {result && !result.error && releases.length === 0 ? (
          <Text style={styles.muted} testID="whats-new-empty">{strings.empty}</Text>
        ) : null}
        {latest ? <ReleaseCard note={latest} heading={strings.latest} strings={strings} index={0} /> : null}
        {older.length > 0 ? (
          <TouchableOpacity style={styles.toggle} onPress={() => setShowOlder((v) => !v)} accessibilityRole="button" testID="whats-new-toggle-older">
            <Text style={styles.toggleText}>{showOlder ? strings.hideOlder : strings.seeAll}</Text>
          </TouchableOpacity>
        ) : null}
        {showOlder
          ? older.map((note, i) => (
              <ReleaseCard key={note.tag} note={note} heading={strings.olderReleases} strings={strings} index={i + 1} />
            ))
          : null}
        {result?.error ? (
          <TouchableOpacity style={styles.button} onPress={() => void load()} accessibilityRole="button" testID="whats-new-retry">
            <Text style={styles.buttonText}>{strings.retry}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => void Linking.openURL(ALL_RELEASES_URL)} accessibilityRole="link" testID="whats-new-all-releases-link">
          <Text style={styles.linkText}>{strings.allReleasesLink}</Text>
        </TouchableOpacity>
    </View>
  );
}
