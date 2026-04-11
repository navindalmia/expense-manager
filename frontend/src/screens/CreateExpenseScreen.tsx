/**
 * Create Expense Screen
 * 
 * Form to create a new expense within a group.
 * Includes title, amount, category, date, and optional notes.
 */

import React, { useState, useCallback } from 'react';
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
import type { CreateExpenseScreenProps } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

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
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  categoryButtonActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e6f0ff',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#0066cc',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
    backgroundColor: '#f0f0f0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#666',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
});

const CATEGORIES = [
  { id: 1, label: 'Food' },
  { id: 2, label: 'Travel' },
  { id: 3, label: 'Entertainment' },
  { id: 4, label: 'Accommodation' },
  { id: 5, label: 'Shopping' },
  { id: 6, label: 'Other' },
];

export default function CreateExpenseScreen({ 
  navigation, 
  route,
}: CreateExpenseScreenProps) {
  const { groupId, groupName } = route.params || { groupId: 0, groupName: '' };
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, amount, category]);

  const handleCreate = useCallback(async () => {
    if (!validateForm() || !user) return;

    setLoading(true);
    try {
      const payload = {
        groupId,
        title: title.trim(),
        amount: parseFloat(amount),
        currency,
        categoryId: category,
        paidById: user.id,
        expenseDate: date,
        notes: notes.trim() || undefined,
      };

      await http.post('/expenses', payload);

      logger.info('Expense created successfully', {
        groupId,
        title,
        amount,
      });

      Alert.alert('Success', 'Expense created successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Failed to create expense', err, {
        groupId,
        action: 'handleCreate',
      });

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [title, amount, category, notes, currency, date, groupId, user, validateForm, navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group Info */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Group</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>
            {groupName}
          </Text>
        </View>

        {/* Title */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dinner, Coffee"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            editable={!loading}
            testID="expense-title-input"
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        {/* Amount & Currency */}
        <View style={styles.formSection}>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>
                Amount <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#999"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={!loading}
                testID="expense-amount-input"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Currency</Text>
              <TextInput
                style={styles.input}
                placeholder="GBP"
                placeholderTextColor="#999"
                value={currency}
                onChangeText={setCurrency}
                maxLength={3}
                editable={!loading}
                testID="expense-currency-input"
              />
            </View>
          </View>
        </View>

        {/* Category */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.id)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        </View>

        {/* Date */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={date}
            onChangeText={setDate}
            editable={!loading}
            testID="expense-date-input"
          />
        </View>

        {/* Notes */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add any additional details..."
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            editable={!loading}
            testID="expense-notes-input"
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Expense'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
