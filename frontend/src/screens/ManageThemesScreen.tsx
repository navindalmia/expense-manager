/**
 * Manage Themes Screen
 *
 * Lists the user's active themes with how many groups/expenses use each,
 * and lets the user rename, disable or re-enable one (R4). Mirrors ManageLabelsScreen.
 * Disabled rows stay in the list (dimmed, tagged) with an Enable button.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ManageThemesScreenProps } from '../types/navigation';
import { getThemeUsage, disableTheme, enableTheme, renameTheme, type ThemeUsage } from '../services/themeService';
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
  usage: { fontSize: 13, color: '#666', marginTop: 2 },
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

function describeUsage(theme: ThemeUsage): string {
  const groups = `${theme.groupCount} ${theme.groupCount === 1 ? 'group' : 'groups'}`;
  const expenses = `${theme.expenseCount} ${theme.expenseCount === 1 ? 'expense' : 'expenses'}`;
  return `${groups}, ${expenses}`;
}

export default function ManageThemesScreen(_props: ManageThemesScreenProps) {
  const [themes, setThemes] = useState<ThemeUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTheme, setEditingTheme] = useState<ThemeUsage | null>(null);

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setThemes(await getThemeUsage({ includeDisabled: true }));
    } catch (err) {
      setError(getErrorMessage(err));
      logger.error('Failed to load theme usage', err, { screen: 'ManageThemesScreen' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const setActive = useCallback((id: number, isActive: boolean) => {
    setThemes((prev) => prev.map((row) => (row.id === id ? { ...row, isActive } : row)));
  }, []);

  const handleDisable = useCallback(
    async (theme: ThemeUsage) => {
      try {
        await disableTheme(theme.id);
        setActive(theme.id, false);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
        logger.error('Failed to disable theme', err, { screen: 'ManageThemesScreen', themeId: theme.id });
      }
    },
    [setActive]
  );

  const handleEnable = useCallback(
    async (theme: ThemeUsage) => {
      try {
        await enableTheme(theme.id);
        setActive(theme.id, true);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
        logger.error('Failed to enable theme', err, { screen: 'ManageThemesScreen', themeId: theme.id });
      }
    },
    [setActive]
  );

  const handleRenameSave = useCallback(
    async (name: string) => {
      if (!editingTheme) {
        return;
      }
      const updated = await renameTheme(editingTheme.id, name);
      setThemes((prev) => prev.map((t) => (t.id === updated.id ? { ...t, name: updated.name } : t)));
      setEditingTheme(null);
    },
    [editingTheme]
  );

  if (loading) {
    return <LoadingState message="Loading themes..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadThemes} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {themes.length === 0 ? (
        <View style={styles.emptyState} testID="manage-themes-empty-state">
          <Text style={styles.emptyText}>No themes yet. Themes are created from the group or expense screen.</Text>
        </View>
      ) : (
        <FlatList
          data={themes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          testID="manage-themes-list"
          renderItem={({ item }) => (
            <View style={styles.row} testID={`manage-themes-row-${item.id}`}>
              <View>
                <Text style={[styles.name, !item.isActive && styles.nameDisabled]}>{item.name}</Text>
                {!item.isActive && (
                  <Text style={styles.disabledTag} testID={`manage-themes-disabled-tag-${item.id}`}>Disabled</Text>
                )}
                <Text style={styles.usage}>{describeUsage(item)}</Text>
              </View>
              {/* System themes (no owner) cannot be renamed or disabled by a user. */}
              {item.userId !== null && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingTheme(item)}
                    testID={`manage-themes-edit-${item.id}`}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  {item.isActive ? (
                    <TouchableOpacity
                      style={styles.disableButton}
                      onPress={() => handleDisable(item)}
                      testID={`manage-themes-disable-${item.id}`}
                    >
                      <Text style={styles.disableButtonText}>Disable</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.enableButton}
                      onPress={() => handleEnable(item)}
                      testID={`manage-themes-enable-${item.id}`}
                    >
                      <Text style={styles.enableButtonText}>Enable</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
      <RenameModal
        visible={editingTheme !== null}
        title="Rename Theme"
        initialName={editingTheme?.name ?? ''}
        onSave={handleRenameSave}
        onCancel={() => setEditingTheme(null)}
        testIDPrefix="manage-themes-rename"
      />
    </SafeAreaView>
  );
}
