/**
 * Create Group Screen
 * 
 * Form to create a new expense group.
 * Includes name, description, and currency selection.
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
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
import CurrencyPicker from '../components/CurrencyPicker';
import AddMemberModal from '../components/AddMemberModal';
import type { Group } from '../services/groupService';
import { alertThenContinue } from '../utils/crossPlatformAlert';
import TypeAheadDropdown, { TypeAheadItem } from '../components/TypeAheadDropdown';
import { getThemes, createTheme, type Theme } from '../services/themeService';

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
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState<number | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    getThemes()
      .then(setThemes)
      .catch((error) => logger.error('Failed to load themes', error));
  }, []);

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
        themeId: themeId || undefined,
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
  }, [name, description, currency, themeId, validateForm, navigation]);

  const handleMemberAdded = useCallback(() => {
    setShowMemberModal(false);
    setCreatedGroup(null);
    alertThenContinue('Success', 'Group created! Members invited.', () =>
      navigation.goBack()
    );
  }, [navigation]);

  const handleCloseMemberModal = useCallback(() => {
    setShowMemberModal(false);
    setCreatedGroup(null);
    alertThenContinue('Success', 'Group created!', () => navigation.goBack());
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
          <CurrencyPicker
            value={currency}
            onChange={setCurrency}
            disabled={loading}
            testIDPrefix="currency-"
          />
        </View>

        {/* Theme Selection */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Theme (optional)</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowThemePicker(true)}
            disabled={loading}
            testID="group-theme-picker-button"
          >
            <Text style={{ color: themeId ? '#333' : '#999' }}>
              {themes.find((t) => t.id === themeId)?.name || 'Select theme...'}
            </Text>
          </TouchableOpacity>
        </View>

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
          testIDPrefix="group-theme"
          selectedId={themeId}
        />

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
