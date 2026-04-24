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
import { useSplitCalculator, SplitMembersInput, DatePickerModal } from './EditExpenseScreen/index';

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
  const [paidBy, setPaidBy] = useState<number | null>(user?.id || null);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitTypeModal, setShowSplitTypeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data fetching state
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupMembers, setGroupMembers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Split calculator - same as EditExpenseScreen
  const { splitState, addMember, removeMember, updateAmount: updateSplitAmount, updatePercentage, setSplitType, getValidationError, getSplitPayload } = useSplitCalculator(amount, paidBy || 0, groupMembers, null);

  /**
   * Fetch categories and group members from backend on component mount.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        setDataError(null);

        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);

        // Fetch group members for payer selection
        const groupResponse = await http.get<{ data: any }>(`/groups/${groupId}`);
        if (groupResponse.data.data && groupResponse.data.data.members) {
          setGroupMembers(groupResponse.data.data.members);
        }
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
  }, [groupId]);

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

    if (!paidBy) {
      newErrors.paidBy = 'Please select who paid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, amount, category, paidBy]);

  const handleCreate = useCallback(async () => {
    if (!validateForm() || !user || !paidBy) return;

    setLoading(true);
    try {
      const splitPayload = getSplitPayload();
      const payload = {
        groupId,
        title: title.trim(),
        amount: parseFloat(amount),
        currency,
        categoryId: category,
        paidById: paidBy,
        expenseDate: date,
        notes: notes.trim() || undefined,
        ...splitPayload, // Includes splitWithIds, splitType, splitPercentage, splitAmount
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
  }, [title, amount, category, notes, currency, date, groupId, user, paidBy, validateForm, getSplitPayload, navigation]);

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
          <TouchableOpacity 
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowCategoryModal(true)}
            disabled={loading || isLoadingData}
          >
            <Text style={{ color: category ? '#333' : '#999', fontSize: 14 }}>
              {categories.find(c => c.id === category)?.label || 'Select...'}
            </Text>
          </TouchableOpacity>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        </View>

        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                  <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.pickerItem, category === cat.id && { backgroundColor: '#e6f0ff' }]}
                    onPress={() => {
                      setCategory(cat.id);
                      setShowCategoryModal(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, category === cat.id && { color: '#0066cc', fontWeight: '600' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Split Type - EQUAL / PERCENTAGE / AMOUNT */}
        <View style={styles.formSection}>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Split Type</Text>
              <TouchableOpacity 
                style={[styles.input, { justifyContent: 'center' }]} 
                onPress={() => setShowSplitTypeModal(true)}
                disabled={loading}
              >
                <Text style={{ color: '#333' }}>
                  {splitState.splitType === 'EQUAL' ? 'Equal' : splitState.splitType === 'AMOUNT' ? 'Amount' : 'Percentage'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Split Type Modal */}
        <Modal
          visible={showSplitTypeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSplitTypeModal(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Split Type</Text>
                <TouchableOpacity onPress={() => setShowSplitTypeModal(false)}>
                  <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {[
                  { value: 'EQUAL', label: 'Equal - Divide equally' },
                  { value: 'AMOUNT', label: 'Amount - Each person\'s share' },
                  { value: 'PERCENTAGE', label: 'Percentage - By percentage' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pickerItem, splitState.splitType === option.value && { backgroundColor: '#e6f0ff' }]}
                    onPress={() => {
                      setSplitType(option.value as 'EQUAL' | 'AMOUNT' | 'PERCENTAGE');
                      setShowSplitTypeModal(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, splitState.splitType === option.value && { color: '#0066cc', fontWeight: '600' }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Split Members */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Split (Optional)</Text>
          <SplitMembersInput
            members={groupMembers}
            paidById={paidBy || 0}
            splitWithIds={splitState.splitWithIds}
            splitAmount={splitState.splitAmount}
            splitPercentage={splitState.splitPercentage}
            splitType={splitState.splitType}
            totalAmount={amount}
            currency={currency}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            onUpdateAmount={updateSplitAmount}
            onUpdatePercentage={updatePercentage}
            errors={errors}
          />
        </View>

        {/* Paid By - Who paid for this expense */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Paid By <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowPayerModal(true)}
            disabled={loading || isLoadingData}
          >
            <Text style={{ color: paidBy ? '#333' : '#999', fontSize: 14 }}>
              {groupMembers.find(m => m.id === paidBy)?.name || 'Select who paid...'}
            </Text>
          </TouchableOpacity>
          {errors.paidBy && <Text style={styles.errorText}>{errors.paidBy}</Text>}
        </View>

        {/* Payer Modal */}
        <Modal
          visible={showPayerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPayerModal(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Who Paid?</Text>
                <TouchableOpacity onPress={() => setShowPayerModal(false)}>
                  <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {groupMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.pickerItem,
                      paidBy === member.id && { backgroundColor: '#e6f0ff' },
                    ]}
                    onPress={() => {
                      setPaidBy(member.id);
                      setShowPayerModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        paidBy === member.id && { color: '#0066cc', fontWeight: '600' },
                      ]}
                    >
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

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
