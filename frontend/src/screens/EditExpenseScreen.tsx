/**
 * Edit Expense Screen
 * 
 * Form to edit an existing expense within a group.
 * Pre-fills all fields from the existing expense.
 * All fields are editable: title, amount, category, date, payer, split, notes.
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
import type { EditExpenseScreenProps } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { useAuth } from '../context/AuthContext';
import { getCategories, type Category } from '../services/categoryService';
import { getExpenseById, updateExpense, type Expense } from '../services/expenseService';
import { getGroup } from '../services/groupService';
import type { SplitType } from '../types/common';

interface GroupMember {
  id: number;
  name: string;
  email: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
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
  updateButton: {
    backgroundColor: '#0066cc',
  },
  deleteButton: {
    backgroundColor: '#ff4444',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  calendarContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  calendarButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0066cc',
    borderRadius: 4,
  },
  calendarButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 6,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 12,
    color: '#666',
  },
  calendarDayDisabled: {
    opacity: 0.4,
  },
  calendarDaySelected: {
    backgroundColor: '#0066cc',
  },
  calendarDaySelectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarDayToday: {
    backgroundColor: '#e6f0ff',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
});

/**
 * Simple Calendar Component
 * Shows current month with day selection
 * Date format: YYYY-MM-DD
 */
function SimpleCalendar({ 
  selectedDate, 
  onSelectDate 
}: { 
  selectedDate: string; 
  onSelectDate: (date: string) => void 
}) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate || new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Create array of days for calendar grid
  const days = [];
  
  // Days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, currentMonth: false });
  }
  
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, currentMonth: true });
  }
  
  // Days from next month
  const remainingDays = 42 - days.length; // 6 rows × 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  // Parse selected date safely (handle YYYY-MM-DD format)
  const parseDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  };

  const selected = parseDate(selectedDate);
  const todayDate = new Date();
  
  const isToday = (day: number) => 
    day === todayDate.getDate() && 
    month === todayDate.getMonth() && 
    year === todayDate.getFullYear();

  const isSelected = (day: number) =>
    day === selected.day &&
    month === selected.month &&
    year === selected.year;

  const handleSelectDay = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    
    // Prevent future dates
    const selectedDateObj = new Date(year, month, day);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    
    if (selectedDateObj > todayObj) {
      console.log('❌ Future date not allowed:', selectedDateObj);
      return;
    }
    
    // Construct date string directly (YYYY-MM-DD) to avoid timezone issues
    const yearStr = String(year).padStart(4, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    console.log('📅 Day selected:', day, 'formatted date:', dateStr);
    onSelectDate(dateStr);
  };

  // Check if date is in the future
  const isFutureDate = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateToCheck > today;
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.calendarButton}>
          <Text style={styles.calendarButtonText}>← Prev</Text>
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{monthNames[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.calendarButton}>
          <Text style={styles.calendarButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekdays}>
        {weekdayNames.map((day) => (
          <Text key={day} style={[styles.calendarWeekday, { textAlign: 'center' }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarDays}>
        {days.map((dayObj, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.calendarDay,
              !dayObj.currentMonth && styles.calendarDayDisabled,
              isFutureDate(dayObj.day) && dayObj.currentMonth && styles.calendarDayDisabled,
              isToday(dayObj.day) && dayObj.currentMonth && styles.calendarDayToday,
              isSelected(dayObj.day) && dayObj.currentMonth && styles.calendarDaySelected,
            ]}
            onPress={() => handleSelectDay(dayObj.day, dayObj.currentMonth)}
            disabled={!dayObj.currentMonth || isFutureDate(dayObj.day)}
          >
            <Text
              style={[
                styles.calendarDayText,
                isSelected(dayObj.day) && dayObj.currentMonth && styles.calendarDaySelectedText,
              ]}
            >
              {dayObj.day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function EditExpenseScreen({
  navigation, 
  route,
}: EditExpenseScreenProps) {
  const { expenseId, groupId, groupName, groupCurrencyCode = 'GBP' } = route.params || { 
    expenseId: 0,
    groupId: 0,
    groupName: '',
    groupCurrencyCode: 'GBP'
  };
  const { user } = useAuth();

  // Debug logs
  useEffect(() => {
    logger.info('EditExpenseScreen: Mounted with params', {
      screen: 'EditExpenseScreen',
      expenseId,
      groupId,
      groupName,
      routeParams: route.params,
    });
    console.log('📍 EditExpenseScreen params:', { expenseId, groupId, groupName });
  }, []);

  // Validate required params
  if (!expenseId || expenseId === 0) {
    logger.warn('EditExpenseScreen: Missing required expenseId parameter', {
      screen: 'EditExpenseScreen',
      expenseId,
    });
  }

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [paidById, setPaidById] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [tempDate, setTempDate] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Split state
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [splitWithIds, setSplitWithIds] = useState<number[]>([]);
  const [splitAmount, setSplitAmount] = useState<Record<number, string>>({});
  const [splitPercentage, setSplitPercentage] = useState<Record<number, string>>({});

  // Data fetching state
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const currency = expense?.currency.code || groupCurrencyCode;

  /**
   * Fetch expense, categories, and group members on component mount
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        setDataError(null);
        console.log('🔄 Starting data fetch for expense:', expenseId);

        // Fetch the expense to edit
        const fetchedExpense = await getExpenseById(expenseId);
        console.log('✅ Expense loaded:', fetchedExpense.title);
        setExpense(fetchedExpense);

        // Pre-fill form fields
        setTitle(fetchedExpense.title);
        setAmount(fetchedExpense.amount.toString());
        setCategory(fetchedExpense.categoryId);
        setPaidById(fetchedExpense.paidById);
        setNotes(fetchedExpense.notes || '');
        setDate(fetchedExpense.expenseDate.split('T')[0]);
        setTempDate(fetchedExpense.expenseDate.split('T')[0]);
        setSplitType((fetchedExpense.splitType as SplitType) || 'EQUAL');

        // Set split information
        if (fetchedExpense.splitWith && fetchedExpense.splitWith.length > 0) {
          setSplitWithIds(fetchedExpense.splitWith.map(u => u.id));
          
          // Populate split amounts/percentages
          const amountMap: Record<number, string> = {};
          const percentageMap: Record<number, string> = {};
          
          // For PERCENTAGE splits: payer is at index 0, members at indices 1+
          if (fetchedExpense.splitType === 'PERCENTAGE' && fetchedExpense.splitPercentage) {
            // Load payer's percentage (index 0)
            if (fetchedExpense.splitPercentage[0]) {
              percentageMap[fetchedExpense.paidById] = fetchedExpense.splitPercentage[0].toString();
            }
            // Load members' percentages (indices 1+)
            fetchedExpense.splitWith.forEach((user, idx) => {
              if (fetchedExpense.splitPercentage?.[idx + 1]) {
                percentageMap[user.id] = fetchedExpense.splitPercentage[idx + 1].toString();
              }
            });
          } else {
            // For AMOUNT splits: members only
            fetchedExpense.splitWith.forEach((user, idx) => {
              if (fetchedExpense.splitAmount?.[idx]) {
                amountMap[user.id] = fetchedExpense.splitAmount[idx].toString();
              }
              if (fetchedExpense.splitPercentage?.[idx]) {
                percentageMap[user.id] = fetchedExpense.splitPercentage[idx].toString();
              }
            });
          }
          
          setSplitAmount(amountMap);
          setSplitPercentage(percentageMap);
        }

        // Fetch categories
        const fetchedCategories = await getCategories();
        console.log('✅ Categories loaded:', fetchedCategories.length);
        setCategories(fetchedCategories);

        // Fetch group members
        console.log('🔄 Fetching group members for groupId:', groupId);
        const group = await getGroup(groupId);
        console.log('✅ Group members loaded:', group.members.length, group.members);
        setGroupMembers(group.members);
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.error('❌❌❌ FAILED TO LOAD EXPENSE:', errorMessage, err);
        setDataError(errorMessage);
        logger.error('Failed to load expense for editing', err, {
          screen: 'EditExpenseScreen',
          action: 'fetchData',
          expenseId,
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [expenseId, groupId]);

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

    if (!paidById) {
      newErrors.paidById = 'Please select who paid';
    }

    // Validate split if members are selected
    if (splitWithIds.length > 0) {
      if (splitType === 'AMOUNT') {
        const total = Object.values(splitAmount).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
        if (Math.abs(total - parseFloat(amount)) > 0.01) {
          newErrors.split = `Split amounts must equal ${amount}`;
        }
      } else if (splitType === 'PERCENTAGE') {
        const total = Object.values(splitPercentage).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
        if (Math.abs(total - 100) > 0.01) {
          newErrors.split = 'Split percentages must sum to 100%';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, amount, category, paidById, splitType, splitWithIds, splitAmount, splitPercentage]);

  const handleUpdate = useCallback(async () => {
    if (!validateForm() || !expense || !category || !paidById) return;

    setLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        amount: parseFloat(amount),
        categoryId: category,
        paidById,
        expenseDate: date,
        notes: notes.trim() || undefined,
      };

      // Add split if members selected
      if (splitWithIds.length > 0) {
        payload.splitType = splitType;
        payload.splitWithIds = splitWithIds;
        
        if (splitType === 'AMOUNT') {
          payload.splitAmount = splitWithIds.map(id => parseFloat(splitAmount[id] || '0'));
        } else if (splitType === 'PERCENTAGE') {
          // For PERCENTAGE: include payer's % + members' %
          const allIds = [paidById, ...splitWithIds];
          payload.splitPercentage = allIds.map(id => parseFloat(splitPercentage[id] || '0'));
        }
      } else {
        payload.splitWithIds = [];
      }

      await updateExpense(expenseId, payload);

      logger.info('Expense updated successfully', {
        expenseId,
        title,
        amount,
      });

      setLoading(false);
      // Navigate back immediately (don't wait for alert)
      navigation.goBack();
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Failed to update expense', err, {
        expenseId,
        action: 'handleUpdate',
      });

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [title, amount, category, paidById, notes, date, expenseId, expense, splitType, splitWithIds, splitAmount, splitPercentage, validateForm, navigation]);

  // Loading state while fetching expense data
  if (isLoadingData || !groupMembers?.length || !categories?.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  // Error state
  if (dataError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#cc0000', fontSize: 16, marginBottom: 16 }}>
          {dataError}
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.updateButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

        {/* Payer Info - EDITABLE */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Paid By <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowPayerModal(true)}
            disabled={loading}
          >
            <Text style={{ color: paidById ? '#333' : '#999' }}>
              {paidById && groupMembers ? groupMembers.find(m => m.id === paidById)?.name || 'Unknown' : 'Select payer...'}
            </Text>
          </TouchableOpacity>
          {errors.paidById && <Text style={styles.errorText}>{errors.paidById}</Text>}
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
                <Text style={styles.pickerTitle}>Select Who Paid</Text>
                <TouchableOpacity onPress={() => setShowPayerModal(false)}>
                  <Text style={{ fontSize: 16, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {groupMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.pickerItem,
                      paidById === member.id && { backgroundColor: '#e6f0ff', borderLeftWidth: 4, borderLeftColor: '#0066cc' }
                    ]}
                    onPress={() => {
                      setPaidById(member.id);
                      setShowPayerModal(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, paidById === member.id && { color: '#0066cc', fontWeight: '600' }]}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

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
            testID="edit-expense-title-input"
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
                testID="edit-expense-amount-input"
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
                testID="edit-expense-currency-input"
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
              testID="edit-expense-date-input"
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
            testID="edit-expense-notes-input"
          />
        </View>

        {/* Split Configuration */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Split Between Members (Optional)</Text>
          
          {/* Select members to split */}
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Who should this expense be split with?</Text>
          <View style={styles.categoryContainer}>
            {groupMembers
              .filter(m => m.id !== paidById) // Don't show payer in split list
              .map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.categoryButton,
                    splitWithIds.includes(member.id) && styles.categoryButtonActive,
                  ]}
                  onPress={() => {
                    if (splitWithIds.includes(member.id)) {
                      setSplitWithIds(splitWithIds.filter(id => id !== member.id));
                      const newAmount = { ...splitAmount };
                      delete newAmount[member.id];
                      setSplitAmount(newAmount);
                      const newPercentage = { ...splitPercentage };
                      delete newPercentage[member.id];
                      setSplitPercentage(newPercentage);
                    } else {
                      setSplitWithIds([...splitWithIds, member.id]);
                    }
                  }}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      splitWithIds.includes(member.id) && styles.categoryTextActive,
                    ]}
                  >
                    {member.name}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* Split type selector */}
          {splitWithIds.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>How to split?</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.categoryButton,
                      splitType === type && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSplitType(type)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        splitType === type && styles.categoryTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Split amount/percentage inputs */}
              {splitType !== 'EQUAL' && (
                <View>
                  {/* For PERCENTAGE: include payer + splitWithIds. For AMOUNT: only splitWithIds */}
                  {(splitType === 'PERCENTAGE' && paidById ? [paidById, ...splitWithIds.filter(id => id !== paidById)] : splitWithIds).map((memberId) => {
                    const member = groupMembers.find(m => m.id === memberId);
                    const isAmountType = splitType === 'AMOUNT';
                    const value = isAmountType ? splitAmount[memberId] : splitPercentage[memberId];
                    const setValue = isAmountType
                      ? (val: string) => setSplitAmount({ ...splitAmount, [memberId]: val })
                      : (val: string) => setSplitPercentage({ ...splitPercentage, [memberId]: val });

                    return (
                      <View key={memberId} style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                          {member?.name} {memberId === paidById ? '(Payer)' : ''} - {isAmountType ? currency : '%'}
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder={isAmountType ? '0.00' : '0'}
                          placeholderTextColor="#999"
                          value={value || ''}
                          onChangeText={setValue}
                          keyboardType="decimal-pad"
                          editable={!loading}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
              
              {errors.split && <Text style={styles.errorText}>{errors.split}</Text>}
            </View>
          )}
        </View>

        {/* Personal Share Summary */}
        {splitWithIds.length > 0 && (
          <View style={styles.formSection}>
            <Text style={styles.label}>Your Personal Share</Text>
            {splitType === 'EQUAL' && (
              <View style={{ backgroundColor: '#f0f8ff', padding: 12, borderRadius: 6 }}>
                <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>
                  {currency} {(parseFloat(amount) / (splitWithIds.length + 1)).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Split equally between {splitWithIds.length + 1} people
                </Text>
              </View>
            )}
            {splitType === 'AMOUNT' && (
              <View style={{ backgroundColor: '#f0f8ff', padding: 12, borderRadius: 6 }}>
                <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>
                  {currency} {(parseFloat(amount) - Object.values(splitAmount).reduce((sum, val) => sum + parseFloat(val || '0'), 0)).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Total - Others' Amounts
                </Text>
              </View>
            )}
            {splitType === 'PERCENTAGE' && (
              <View style={{ backgroundColor: '#f0f8ff', padding: 12, borderRadius: 6 }}>
                <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>
                  {currency} {(parseFloat(amount) * parseFloat(splitPercentage[paidById] || '0') / 100).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {parseFloat(splitPercentage[paidById] || '0').toFixed(1)}% of total
                </Text>
              </View>
            )}
          </View>
        )}

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
            style={[styles.button, styles.updateButton]}
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Update Expense'}</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal - Calendar Style */}
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
                <TouchableOpacity onPress={() => {
                  console.log('📅 Done button pressed. tempDate:', tempDate, 'setting date to:', tempDate);
                  setDate(tempDate);
                  setShowDatePicker(false);
                }}>
                  <Text style={{ fontSize: 16, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                {/* Simple month/year selector and date grid */}
                <SimpleCalendar 
                  selectedDate={tempDate} 
                  onSelectDate={setTempDate}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
