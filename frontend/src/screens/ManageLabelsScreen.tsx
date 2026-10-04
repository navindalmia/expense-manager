/**
 * Manage Labels Screen
 *
 * Shows per-label spend totals and lets the user rename, disable or re-enable a label (R4, R5, R6).
 * Disabled rows stay in the list (dimmed, tagged) with an Enable button.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ManageLabelsScreenProps } from '../types/navigation';
import { getLabelTotals, disableLabel, enableLabel, renameLabel, type LabelTotal } from '../services/labelService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import RenameModal from '../components/RenameModal';

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
  actions: { flexDirection: 'row', gap: 8 },
  editButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e6f0ff' },
  editButtonText: { fontSize: 13, color: '#0066cc', fontWeight: '600' },
  disableButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fdecea' },
  enableButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e6f6ea' },
  enableButtonText: { fontSize: 13, color: '#1a7f37', fontWeight: '600' },
  nameDisabled: { color: '#999' },
  disabledTag: { fontSize: 11, color: '#888', marginTop: 2, fontStyle: 'italic' },
  disableButtonText: { fontSize: 13, color: '#cc0000', fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
});

export default function ManageLabelsScreen({ navigation }: ManageLabelsScreenProps) {
  const [labels, setLabels] = useState<LabelTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<LabelTotal | null>(null);

  const loadLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const totals = await getLabelTotals({ includeDisabled: true });
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

  const setActive = useCallback((id: number, isActive: boolean) => {
    setLabels((prev) => prev.map((row) => (row.id === id ? { ...row, isActive } : row)));
  }, []);

  const handleDisable = useCallback(
    async (label: LabelTotal) => {
      try {
        await disableLabel(label.id);
        setActive(label.id, false);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
        logger.error('Failed to disable label', err, { screen: 'ManageLabelsScreen', labelId: label.id });
      }
    },
    [setActive]
  );

  const handleEnable = useCallback(
    async (label: LabelTotal) => {
      try {
        await enableLabel(label.id);
        setActive(label.id, true);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
        logger.error('Failed to enable label', err, { screen: 'ManageLabelsScreen', labelId: label.id });
      }
    },
    [setActive]
  );

  const handleRenameSave = useCallback(
    async (name: string) => {
      if (!editingLabel) {
        return;
      }
      // Rejections (e.g. a name collision with another label) propagate to
      // RenameModal, which shows them inline and stays open.
      const updated = await renameLabel(editingLabel.id, name);
      setLabels((prev) => prev.map((l) => (l.id === updated.id ? { ...l, name: updated.name } : l)));
      setEditingLabel(null);
    },
    [editingLabel]
  );

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
                <Text style={[styles.name, !item.isActive && styles.nameDisabled]}>{item.name}</Text>
                {!item.isActive && (
                  <Text style={styles.disabledTag} testID={`manage-labels-disabled-tag-${item.id}`}>Disabled</Text>
                )}
                <Text style={styles.total}>{item.total.toFixed(2)}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditingLabel(item)}
                  testID={`manage-labels-edit-${item.id}`}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                {item.isActive ? (
                  <TouchableOpacity
                    style={styles.disableButton}
                    onPress={() => handleDisable(item)}
                    testID={`manage-labels-disable-${item.id}`}
                  >
                    <Text style={styles.disableButtonText}>Disable</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.enableButton}
                    onPress={() => handleEnable(item)}
                    testID={`manage-labels-enable-${item.id}`}
                  >
                    <Text style={styles.enableButtonText}>Enable</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
      <RenameModal
        visible={editingLabel !== null}
        title="Rename Label"
        initialName={editingLabel?.name ?? ''}
        onSave={handleRenameSave}
        onCancel={() => setEditingLabel(null)}
        testIDPrefix="manage-labels-rename"
      />
    </SafeAreaView>
  );
}
