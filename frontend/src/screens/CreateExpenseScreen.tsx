/**
 * Create Expense Screen
 * 
 * Form to create a new expense within a group.
 * Includes title, amount, category, date picker (for past dates), and optional notes.
 * Currency is fixed from the group and not editable.
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  Modal,
  ActivityIndicator,
} from 'react-native';
import type { CreateExpenseScreenProps } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { getCategories, type Category } from '../services/categoryService';

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
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  pickerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  readonlyInput: {
    backgroundColor: '#f5f5f5',
  },
});

export default function CreateExpenseScreen({ 
  navigation, 
  route,
}: CreateExpenseScreenProps) {
  const { groupId, groupName, groupCurrencyCode = 'GBP' } = route.params || { 
    groupId: 0, 
    groupName: '', 
    groupCurrencyCode: 'GBP' 
  };
  const { user } = useAuth();

  // Validate required params
  if (!groupId || groupId === 0) {
    logger.warn('CreateExpenseScreen: Missing required groupId parameter', {
      screen: 'CreateExpenseScreen',
      groupId,
    });
  }

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  // Currency is fixed from group - NOT editable
  const currency = groupCurrencyCode;
  // Date is editable - user can select past dates
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tempDate, setTempDate] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data fetching state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /**
   * Fetch categories from backend on component mount.
   * Currency comes from group and is not editable.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        setDataError(null);

        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setDataError(errorMessage);
        logger.error('Failed to load form data', err, {
          screen: 'CreateExpenseScreen',
          action: 'fetchData',
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

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

      // Show success alert
      Alert.alert('Success', 'Expense created successfully', [
        {
          text: 'OK',
          // When user taps OK, navigate back to ExpenseListScreen
          // useFocusEffect will trigger and reload the expenses
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
                onChangeText={val => {
                  // Reject negative amounts
                  if (val.startsWith('-')) {
                    return;
                  }
                  setAmount(val);
                }}
                keyboardType="decimal-pad"
                editable={!loading}
                testID="expense-amount-input"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Currency</Text>
              <TextInput
                style={[styles.input, styles.readonlyInput]}
                value={currency}
                editable={false}
                pointerEvents="none"
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
            {isLoadingData ? (
              <ActivityIndicator size="small" color="#0066cc" />
            ) : (
              categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                  disabled={loading || isLoadingData}
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
              ))
            )}
          </View>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        </View>

        {/* Date - Editable with date picker for past dates */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            onPress={() => {
              setTempDate(date);
              setShowDatePicker(true);
            }}
            disabled={loading}
          >
            <TextInput
              style={[styles.input, styles.readonlyInput]}
              value={date}
              editable={false}
              pointerEvents="none"
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              testID="expense-date-input"
            />
          </TouchableOpacity>
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

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ fontSize: 16, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                  value={tempDate}
                  onChangeText={setTempDate}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                  Format: YYYY-MM-DD (e.g., 2026-04-12)
                </Text>
                <TouchableOpacity
                  style={[styles.button, styles.createButton, { marginTop: 16 }]}
                  onPress={() => {
                    setDate(tempDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.buttonText}>Apply Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
