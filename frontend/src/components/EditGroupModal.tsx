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
import { updateGroup, Group } from '../services/groupService';
import AddMemberModal from './AddMemberModal';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

interface EditGroupModalProps {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onSuccess: (updatedGroup: Group) => void;
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  currencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  currencyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  currencyButtonActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e6f0ff',
  },
  currencyText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  currencyTextActive: {
    color: '#0066cc',
    fontWeight: '600',
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
});

const CURRENCIES = ['GBP', 'USD', 'EUR', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

export default function EditGroupModal({
  visible,
  group,
  onClose,
  onSuccess,
}: EditGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Initialize form with group data when modal opens
  useEffect(() => {
    if (group && visible) {
      setName(group.name);
      setDescription(group.description || '');
      setCurrency(group.currency);
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

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Edit Group</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              value={name}
              onChangeText={setName}
              maxLength={100}
              editable={!loading}
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
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}

            {/* Currency */}
            <Text style={styles.label}>Currency</Text>
            <View style={styles.currencyContainer}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.currencyButton,
                    currency === curr && styles.currencyButtonActive,
                  ]}
                  onPress={() => setCurrency(curr)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      currency === curr && styles.currencyTextActive,
                    ]}
                  >
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
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

          {/* Manage Members Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#27ae60', marginTop: 12 }]}
            onPress={() => setShowMemberModal(true)}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.saveButtonText]}>
              👥 Manage Members
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Member Modal */}
      <AddMemberModal
        visible={showMemberModal}
        group={group}
        onClose={() => setShowMemberModal(false)}
        onMemberAdded={handleMemberAdded}
      />
    </Modal>
  );
}
