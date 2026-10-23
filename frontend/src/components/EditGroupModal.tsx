/**
 * Edit Group Modal
 * 
 * Modal for editing group name, description, and currency
 * Shows existing values and allows updates
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { updateGroup, deleteGroup, Group } from '../services/groupService';
import CurrencyPicker from './CurrencyPicker';
import { getThemes, createTheme, type Theme } from '../services/themeService';
import FieldHelp from './FieldHelp';
import { KeyboardInsetView } from '../hooks/useKeyboardInset';
import AddMemberModal from './AddMemberModal';
import TypeAheadDropdown, { TypeAheadItem } from './TypeAheadDropdown';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { alertThenContinue, confirmThenProceed } from '../utils/crossPlatformAlert';

interface EditGroupModalProps {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onSuccess: (updatedGroup: Group) => void;
  onDeleted?: (deletedGroupId: number) => void;
  /** Signed-in user's id; only the group creator may delete. Undefined disables Delete. */
  currentUserId?: number;
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#0066cc',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: '#333',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  manageButton: {
    backgroundColor: '#27ae60',
    marginBottom: 12,
    paddingVertical: 14,
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#cc0000',
    paddingVertical: 14,
  },
  deleteButtonText: {
    color: '#cc0000',
  },
  membersList: {
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  memberEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

const DELETE_CREATOR_ONLY_HINT = 'Only the group creator can delete this group.';

export default function EditGroupModal({
  visible,
  group,
  onClose,
  onSuccess,
  onDeleted,
  currentUserId,
}: EditGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState<number | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Re-fetch themes each time the modal opens: HomeScreen keeps it mounted
  // (hidden), so a mount-only fetch misses themes created since.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getThemes()
      .then((fetched) => {
        if (!cancelled) setThemes(fetched);
      })
      .catch((error) => logger.error('Failed to load themes', error));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Initialize form with group data when modal opens
  useEffect(() => {
    if (group && visible) {
      setName(group.name);
      setDescription(group.description || '');
      // group.currency is now { id, code, label }
      setCurrency(group.currency?.code || 'USD');
      setThemeId(group.theme?.id ?? null);
      setErrors({});
    }
  }, [group, visible]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    }

    if (name.trim().length > 100) {
      newErrors.name = 'Group name must be less than 100 characters';
    }

    if (description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !group) {
      return;
    }

    setLoading(true);

    try {
      const updated = await updateGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
        themeId: themeId || undefined,
      });

      logger.info('Group updated successfully', {
        groupId: group.id,
        name: updated.name,
      });

      onSuccess(updated);
      onClose();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      Alert.alert('Error', errorMessage);
      logger.error('Failed to update group', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAdded = (updatedGroup: Group) => {
    // Update parent with group containing new members
    onSuccess(updatedGroup);
  };

  // Fail closed: unknown user or missing creator info keeps Delete disabled.
  const canDelete =
    currentUserId !== undefined && group?.createdBy?.id === currentUserId;

  const isDeleteDisabled = loading || deleting || confirmingDelete || !canDelete;

  const handleDelete = () => {
    if (!group || !canDelete) {
      return;
    }

    const expenseCount = group._count?.expenses ?? 0;
    const removalNotice =
      'The group will be removed for all members. Contact support if this was a mistake.';
    const message =
      expenseCount > 0
        ? `This group has ${expenseCount} expense${expenseCount === 1 ? '' : 's'}. Deleting the group will remove your access to them too. ${removalNotice} Are you sure you want to delete "${group.name}"?`
        : `Are you sure you want to delete "${group.name}"? ${removalNotice}`;

    setConfirmingDelete(true);
    confirmThenProceed(
      'Delete Group',
      message,
      'Delete',
      async () => {
        setConfirmingDelete(false);
        setDeleting(true);
        try {
          await deleteGroup(group.id);
          logger.info('Group deleted successfully', { groupId: group.id });
          onDeleted?.(group.id);
          onClose();
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          // Alert.alert is a silent no-op on web: use the cross-platform wrapper so a
          // failed delete is visible there too.
          alertThenContinue('Error', errorMessage, () => {});
          logger.error('Failed to delete group', error, { groupId: group.id });
        } finally {
          setDeleting(false);
        }
      },
      () => setConfirmingDelete(false)
    );
  };

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardInsetView style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Edit Group</Text>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Settings Section */}
            <Text style={styles.sectionLabel}>Group Settings</Text>
            
            {/* Name */}
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              value={name}
              onChangeText={setName}
              maxLength={100}
              editable={!loading}
              testID="edit-group-name-input"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Group description (optional)"
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={4}
              editable={!loading}
              testID="edit-group-description-input"
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}

            {/* Currency */}
            <Text style={styles.label}>Currency</Text>
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              disabled={loading}
              testIDPrefix="edit-group-currency-option-"
            />

            {/* Theme */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.label}>Theme (optional)</Text>
              <FieldHelp topic="Theme" testIDPrefix="edit-group-theme" />
            </View>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowThemePicker(true)}
              disabled={loading}
              testID="edit-group-theme-picker-button"
            >
              <Text style={{ color: themeId ? '#333' : '#999' }}>
                {themes.find((t) => t.id === themeId)?.name || group?.theme?.name || 'Select theme...'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* Members Section */}
            <Text style={styles.sectionLabel}>
              👥 Members {group?.members ? `(${group.members.length})` : ''}
            </Text>

            {/* Current Members List */}
            {group && group.members && group.members.length > 0 && (
              <View style={styles.membersList}>
                {group.members.map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.helpText}>
              Click the button below to invite members to this group by email
            </Text>

            {/* Manage Members Button - Prominent */}
            <TouchableOpacity
              style={[styles.button, styles.manageButton]}
              onPress={() => setShowMemberModal(true)}
              disabled={loading}
              testID="edit-group-manage-members-button"
            >
              <Text style={[styles.buttonText, styles.saveButtonText]}>
                + Add or Invite Members
              </Text>
            </TouchableOpacity>

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionLabel}>Danger Zone</Text>
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
              disabled={isDeleteDisabled}
              accessibilityState={{ disabled: isDeleteDisabled }}
              accessibilityHint={canDelete ? undefined : DELETE_CREATOR_ONLY_HINT}
              testID="edit-group-delete-button"
            >
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, styles.deleteButtonText]}>
                  Delete Group
                </Text>
              )}
            </TouchableOpacity>
            {!canDelete && (
              <Text style={styles.helpText} testID="edit-group-delete-hint">
                {DELETE_CREATOR_ONLY_HINT}
              </Text>
            )}
          </ScrollView>

          {/* Buttons - Fixed at Bottom */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
              testID="edit-group-cancel-button"
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
              testID="edit-group-save-button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, styles.saveButtonText]}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardInsetView>

      {/* Add Member Modal */}
      <AddMemberModal
        visible={showMemberModal}
        group={group}
        onClose={() => setShowMemberModal(false)}
        onMemberAdded={handleMemberAdded}
      />

      <TypeAheadDropdown
        visible={showThemePicker}
        title="Select Theme"
        items={themes.map((t): TypeAheadItem => ({ id: t.id, name: t.name }))}
        onSelect={(item) => setThemeId(item.id)}
        onCreateNew={async (themeName) => {
          const created = await createTheme(themeName);
          setThemes((prev) => [...prev, created]);
          return { id: created.id, name: created.name };
        }}
        onClose={() => setShowThemePicker(false)}
        placeholder="Search themes..."
        testIDPrefix="edit-group-theme"
        selectedId={themeId}
      />
    </Modal>
  );
}
