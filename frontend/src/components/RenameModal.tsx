/**
 * Rename Modal
 *
 * Small edit modal (name field + Cancel + Save) shared by Manage Labels and
 * Manage Themes. A list row has no room for both buttons, so renaming is a
 * modal rather than inline-on-row editing. A rejected save keeps the modal
 * open with the typed name intact and shows the error inline.
 */

import React, { useEffect, useState } from 'react';
import { View, Modal, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage } from '../utils/errorHandler';

interface RenameModalProps {
  visible: boolean;
  title: string;
  initialName: string;
  /** Resolve to close the modal; reject (e.g. name collision) to show an inline error. */
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
  testIDPrefix?: string;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#333' },
  errorText: { color: '#cc0000', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, backgroundColor: '#f0f0f0' },
  cancelText: { fontSize: 14, color: '#666', fontWeight: '600' },
  saveButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, backgroundColor: '#0066cc', minWidth: 64, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#99c2ff' },
  saveText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});

export default function RenameModal({
  visible,
  title,
  initialName,
  onSave,
  onCancel,
  testIDPrefix = 'rename',
}: RenameModalProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the modal opens for a (possibly different) item.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }, [visible, initialName]);

  const trimmed = name.trim();

  const handleSave = async () => {
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSave(trimmed);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            editable={!submitting}
            autoFocus
            placeholder="Enter a name..."
            testID={`${testIDPrefix}-input`}
          />
          {error && (
            <Text style={styles.errorText} testID={`${testIDPrefix}-error`}>
              {error}
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={submitting}
              testID={`${testIDPrefix}-cancel-button`}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (submitting || !trimmed) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={submitting || !trimmed}
              testID={`${testIDPrefix}-save-button`}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
