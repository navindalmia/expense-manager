/**
 * Type-Ahead Dropdown
 *
 * Shared "Add new + type-ahead" dropdown component (R7) replacing the
 * inline Modal-picker pattern for Theme/Category/Label selection.
 * Platform-agnostic: works identically for Theme on the group screen and
 * Category/Label on the expense screen (U8/U9 both consume this).
 *
 * First row is always "Add new" (opens an inline text input to
 * create-then-select), followed by the filtered existing-items list,
 * narrowing as the user types.
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getErrorMessage } from '../utils/errorHandler';

export interface TypeAheadItem {
  id: number;
  name: string;
}

interface TypeAheadDropdownProps {
  visible: boolean;
  title: string;
  items: TypeAheadItem[];
  onSelect: (item: TypeAheadItem) => void;
  onCreateNew: (name: string) => Promise<TypeAheadItem>;
  onClose: () => void;
  placeholder?: string;
  testIDPrefix?: string;
}

const styles = StyleSheet.create({
  pickerModal: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 12, paddingBottom: 20, maxHeight: '80%' },
  pickerHeader: { paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  doneText: { fontSize: 14, color: '#0066cc', fontWeight: '600' },
  filterInput: { marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#333' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerItemText: { fontSize: 15, color: '#333' },
  addNewItem: { flexDirection: 'row', alignItems: 'center' },
  addNewText: { fontSize: 15, color: '#0066cc', fontWeight: '600' },
  createRow: { paddingHorizontal: 12, paddingVertical: 10 },
  createHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { fontSize: 14, color: '#0066cc', marginRight: 8 },
  createInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#333' },
  createButton: { marginTop: 10, backgroundColor: '#0066cc', borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  createButtonDisabled: { backgroundColor: '#99c2ff' },
  createButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  errorText: { color: '#cc0000', fontSize: 12, marginTop: 6 },
});

/**
 * @param visible - Whether the modal is shown
 * @param title - Modal header title (e.g. "Select Category")
 * @param items - Existing items to filter/select from
 * @param onSelect - Called with the selected item
 * @param onCreateNew - Called with the typed name when "Add new" is submitted; must resolve to the created item
 * @param onClose - Called when the modal is dismissed
 * @param placeholder - Filter input placeholder text
 * @param testIDPrefix - Prefix for testIDs, e.g. "expense-category" -> "expense-category-add-new-button"
 */
export default function TypeAheadDropdown({
  visible,
  title,
  items,
  onSelect,
  onCreateNew,
  onClose,
  placeholder = 'Search...',
  testIDPrefix = 'typeahead',
}: TypeAheadDropdownProps) {
  const [filterText, setFilterText] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const resetAndClose = () => {
    setFilterText('');
    setCreating(false);
    setNewName('');
    setCreateError(null);
    onClose();
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewName('');
    setCreateError(null);
  };

  const submitCreate = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      return;
    }

    setSubmitting(true);
    setCreateError(null);

    try {
      const created = await onCreateNew(trimmedName);
      onSelect(created);
      resetAndClose();
    } catch (error) {
      // Keep the text input open with the typed name intact, surface the
      // error inline -- never silently discard what the user typed.
      setCreateError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.pickerModal}>
        <View style={styles.pickerContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={resetAndClose} testID={`${testIDPrefix}-modal-close-button`}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {creating ? (
            <View style={styles.createRow}>
              <View style={styles.createHeader}>
                <TouchableOpacity onPress={cancelCreate} testID={`${testIDPrefix}-create-back-button`}>
                  <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.createInput}
                value={newName}
                onChangeText={(text) => {
                  setNewName(text);
                  setCreateError(null);
                }}
                placeholder="Enter a name..."
                editable={!submitting}
                autoFocus
                testID={`${testIDPrefix}-create-input`}
              />
              {createError && <Text style={styles.errorText}>{createError}</Text>}
              <TouchableOpacity
                style={[styles.createButton, (submitting || !newName.trim()) && styles.createButtonDisabled]}
                onPress={submitCreate}
                disabled={submitting || !newName.trim()}
                testID={`${testIDPrefix}-create-submit-button`}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.filterInput}
                value={filterText}
                onChangeText={setFilterText}
                placeholder={placeholder}
                testID={`${testIDPrefix}-filter-input`}
              />
              <ScrollView>
                <TouchableOpacity
                  style={[styles.pickerItem, styles.addNewItem]}
                  onPress={() => setCreating(true)}
                  testID={`${testIDPrefix}-add-new-button`}
                >
                  <Text style={styles.addNewText}>+ Add new</Text>
                </TouchableOpacity>
                {filteredItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      onSelect(item);
                      resetAndClose();
                    }}
                    testID={`${testIDPrefix}-option-${item.id}`}
                  >
                    <Text style={styles.pickerItemText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
