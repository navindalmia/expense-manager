/**
 * Create Group Screen
 * 
 * Form to create a new expense group.
 * Includes name, description, and currency selection.
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { http } from '../api/http';
import AddMemberModal from '../components/AddMemberModal';
import type { Group } from '../services/groupService';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#cc0000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  currencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  currencyButtonActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e6f0ff',
  },
  currencyText: {
    fontSize: 14,
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
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    backgroundColor: '#0066cc',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
});

const CURRENCIES = ['GBP', 'USD', 'EUR', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

/**
 * Create Group Form Screen
 */
function CreateGroupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  /**
   * Validate form inputs
   */
  const validateForm = useCallback((): boolean => {
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
  }, [name, description]);

  /**
   * Handle create group
   */
  const handleCreate = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await http.post('/groups', {
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });

      const group = response.data.data as Group;
      logger.info('Group created successfully', {
        name,
        currency,
        groupId: group.id,
      });

      // Store group and show member modal
      setCreatedGroup(group);
      setShowMemberModal(true);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      Alert.alert('Error', errorMessage);
      logger.error('Failed to create group', error, {
        screen: 'CreateGroupScreen',
      });
    } finally {
      setLoading(false);
    }
  }, [name, description, currency, validateForm, navigation]);

  const handleMemberAdded = useCallback(() => {
    setShowMemberModal(false);
    setCreatedGroup(null);
    Alert.alert('Success', 'Group created! Members invited.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [navigation]);

  const handleCloseMemberModal = useCallback(() => {
    setShowMemberModal(false);
    setCreatedGroup(null);
    Alert.alert('Success', 'Group created!', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Group Name */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Group Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., March 2024, Paris Trip"
            value={name}
            onChangeText={setName}
            maxLength={100}
            testID="group-name-input"
            accessibilityLabel="Group name"
            editable={!loading}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Description */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="What is this group for?"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={4}
            testID="group-description-input"
            accessibilityLabel="Group description"
            editable={!loading}
          />
          <Text style={{ fontSize: 12, color: '#999', textAlign: 'right' }}>
            {description.length}/500
          </Text>
          {errors.description && (
            <Text style={styles.errorText}>{errors.description}</Text>
          )}
        </View>

        {/* Currency Selection */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Default Currency</Text>
          <View style={styles.currencyContainer}>
            {CURRENCIES.map((curr) => (
              <TouchableOpacity
                key={curr}
                style={[
                  styles.currencyButton,
                  currency === curr && styles.currencyButtonActive,
                ]}
                onPress={() => setCurrency(curr)}
                testID={`currency-${curr}`}
                accessible={true}
                accessibilityLabel={`Select ${curr}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: currency === curr }}
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
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            testID="cancel-button"
            accessible={true}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreate}
            testID="create-button"
            accessible={true}
            accessibilityLabel="Create group"
            accessibilityRole="button"
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Member Modal */}
      <AddMemberModal
        visible={showMemberModal}
        group={createdGroup}
        onClose={handleCloseMemberModal}
        onMemberAdded={handleMemberAdded}
      />
    </KeyboardAvoidingView>
  );
}

export default memo(CreateGroupScreen);
