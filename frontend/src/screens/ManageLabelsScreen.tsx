/**
 * Manage Labels Screen
 *
 * Shows per-label spend totals and lets the user disable a label (R4, R6).
 * Disabling has no undo path in this UI, so it requires confirmation first.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ManageLabelsScreenProps } from '../types/navigation';
import { getLabelTotals, disableLabel, type LabelTotal } from '../services/labelService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { confirmThenProceed } from '../utils/crossPlatformAlert';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '600', color: '#333' },
  total: { fontSize: 13, color: '#666', marginTop: 2 },
  disableButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fdecea' },
  disableButtonText: { fontSize: 13, color: '#cc0000', fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
});

export default function ManageLabelsScreen({ navigation }: ManageLabelsScreenProps) {
  const [labels, setLabels] = useState<LabelTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const totals = await getLabelTotals();
      setLabels(totals);
    } catch (err) {
      setError(getErrorMessage(err));
      logger.error('Failed to load label totals', err, { screen: 'ManageLabelsScreen' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const handleDisable = useCallback((label: LabelTotal) => {
    confirmThenProceed(
      'Disable Label',
      `Disable "${label.name}"? It will no longer be available to select on new expenses. This can't be undone from here.`,
      'Disable',
      async () => {
        try {
          await disableLabel(label.id);
          setLabels((prev) => prev.filter((l) => l.id !== label.id));
        } catch (err) {
          logger.error('Failed to disable label', err, { screen: 'ManageLabelsScreen', labelId: label.id });
        }
      }
    );
  }, []);

  if (loading) {
    return <LoadingState message="Loading labels..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadLabels} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {labels.length === 0 ? (
        <View style={styles.emptyState} testID="manage-labels-empty-state">
          <Text style={styles.emptyText}>No labels yet. Labels are created from the expense-editing screen.</Text>
        </View>
      ) : (
        <FlatList
          data={labels}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          testID="manage-labels-list"
          renderItem={({ item }) => (
            <View style={styles.row} testID={`manage-labels-row-${item.id}`}>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.total}>{item.total.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={styles.disableButton}
                onPress={() => handleDisable(item)}
                testID={`manage-labels-disable-${item.id}`}
              >
                <Text style={styles.disableButtonText}>Disable</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
