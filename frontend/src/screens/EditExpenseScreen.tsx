/**
 * Edit Expense Screen (REFACTORED v0.3.2)
 * 
 * Orchestrates extracted hooks and components for editing expenses.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator,
} from 'react-native';
import type { EditExpenseScreenProps } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { useAuth } from '../context/AuthContext';
import { updateExpense } from '../services/expenseService';
import { getCategories } from '../services/categoryService';
import { useExpenseData, useExpenseForm, useSplitCalculator, DatePickerModal, SplitMembersInput } from './EditExpenseScreen/index';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 16, paddingBottom: 120 },
  formSection: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  required: { color: '#cc0000' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', marginBottom: 12 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  flex1: { flex: 1 },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 2, borderColor: '#e0e0e0', backgroundColor: '#fff', marginBottom: 8 },
  categoryButtonActive: { borderColor: '#0066cc', backgroundColor: '#e6f0ff' },
  categoryText: { fontSize: 13, color: '#666', fontWeight: '500' },
  categoryTextActive: { color: '#0066cc', fontWeight: '600' },
  buttonContainer: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  updateButton: { backgroundColor: '#0066cc' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  cancelButtonText: { color: '#666' },
  errorText: { color: '#cc0000', fontSize: 12, marginTop: -8, marginBottom: 12 },
  pickerModal: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, paddingBottom: 24, maxHeight: '80%' },
  pickerHeader: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerItemText: { fontSize: 16, color: '#333' },
  readonlyInput: { backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});

export default function EditExpenseScreen({ navigation, route }: EditExpenseScreenProps) {
  const { expenseId, groupId, groupName, groupCurrencyCode = 'GBP' } = route.params || {};
  const { user } = useAuth();

  const { expense, categories, groupMembers, loading: dataLoading, error: dataError } = useExpenseData(expenseId, groupId);
  const { formState, updateField, setError, clearErrors, prefillFromExpense } = useExpenseForm(expense);
  const { splitState, addMember, removeMember, updateAmount, updatePercentage, setSplitType, getValidationError, getSplitPayload } = useSplitCalculator(formState.amount, formState.paidById);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (expense) {
      prefillFromExpense(expense);
      if (expense.splitWith?.length > 0) {
        // Deduplicate members before adding
        const uniqueMemberIds = [...new Set(expense.splitWith.map(u => u.id))];
        uniqueMemberIds.forEach(userId => addMember(userId));
        
        if (expense.splitType === 'PERCENTAGE' && expense.splitPercentage) {
          updatePercentage(expense.paidById, expense.splitPercentage[0]?.toString() || '');
          expense.splitWith.forEach((user, idx) => {
            if (expense.splitPercentage?.[idx + 1]) updatePercentage(user.id, expense.splitPercentage[idx + 1].toString());
          });
        } else if (expense.splitType === 'AMOUNT' && expense.splitAmount) {
          // Load payer amount from index 0
          updateAmount(expense.paidById, expense.splitAmount[0].toString() || '0');
          // Load member amounts from index 1+
          expense.splitWith.forEach((user, idx) => {
            if (expense.splitAmount?.[idx + 1]) updateAmount(user.id, expense.splitAmount[idx + 1].toString());
          });
        }
        setSplitType(expense.splitType as any);
      }
    }
  }, [expense]);

  const validateForm = useCallback((): boolean => {
    clearErrors();
    const newErrors: Record<string, string> = {};
    if (!formState.title.trim()) newErrors.title = 'Title is required';
    if (!formState.amount || parseFloat(formState.amount) <= 0) newErrors.amount = 'Amount must be > 0';
    if (!formState.category) newErrors.category = 'Select a category';
    if (!formState.paidById) newErrors.paidById = 'Select who paid';
    const splitError = getValidationError();
    if (splitError) newErrors.split = splitError;
    Object.entries(newErrors).forEach(([field, msg]) => setError(field, msg));
    return Object.keys(newErrors).length === 0;
  }, [formState, getValidationError, clearErrors, setError]);

  const handleUpdate = useCallback(async () => {
    // Validate form FIRST, show errors if any
    if (!validateForm()) {
      logger.warn('Form validation failed', { errors: formState.errors });
      // Check which field failed
      const firstError = Object.values(formState.errors).find(e => e);
      if (firstError) {
        Alert.alert('Validation Error', firstError);
      }
      return;
    }

    if (!expense) {
      logger.warn('Expense not loaded yet');
      return;
    }

    setSubmitting(true);
    try {
      logger.info('Attempting update', { expenseId, paidById: formState.paidById, splitType: splitState.splitType });
      const splitPayload = getSplitPayload();
      logger.info('Split payload', splitPayload);
      
      const payload: any = { 
        title: formState.title.trim(), 
        amount: parseFloat(formState.amount), 
        categoryId: formState.category, 
        paidById: formState.paidById, 
        expenseDate: formState.date, 
        notes: formState.notes.trim() || undefined, 
        ...splitPayload 
      };
      
      logger.info('Update payload', payload);
      await updateExpense(expenseId, payload);
      logger.info('Expense updated successfully', { expenseId, title: formState.title });
      Alert.alert('Success', 'Expense updated');
      navigation.goBack();
    } catch (err: any) {
      const msg = getErrorMessage(err);
      logger.error('Update failed', err, { expenseId, errorMsg: msg });
      Alert.alert('Error', msg || 'Failed to update expense');
    } finally {
      setSubmitting(false);
    }
  }, [formState, expense, validateForm, getSplitPayload, expenseId, navigation]);

  if (dataLoading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0066cc" /><Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text></View>);
  if (dataError) return (<View style={styles.loadingContainer}><Text style={{ color: '#cc0000', fontSize: 16, marginBottom: 16 }}>{dataError}</Text><TouchableOpacity style={[styles.button, styles.updateButton]} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Go Back</Text></TouchableOpacity></View>);

  const currency = expense?.currency.code || groupCurrencyCode;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formSection}><Text style={styles.label}>Group</Text><Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>{groupName}</Text></View>
        <Modal visible={showPayerModal} transparent animationType="slide" onRequestClose={() => setShowPayerModal(false)}><View style={styles.pickerModal}><View style={styles.pickerContent}><View style={styles.pickerHeader}><Text style={styles.pickerTitle}>Who Paid?</Text><TouchableOpacity onPress={() => setShowPayerModal(false)}><Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text></TouchableOpacity></View><ScrollView>{groupMembers.map(member => (<TouchableOpacity key={member.id} style={[styles.pickerItem, formState.paidById === member.id && { backgroundColor: '#e6f0ff' }]} onPress={() => { updateField('paidById', member.id); setShowPayerModal(false); }}><Text style={[styles.pickerItemText, formState.paidById === member.id && { color: '#0066cc', fontWeight: '600' }]}>{member.name}</Text></TouchableOpacity>))}</ScrollView></View></View></Modal>
        <View style={styles.formSection}><Text style={styles.label}>Paid By <Text style={styles.required}>*</Text></Text><TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPayerModal(true)}><Text style={{ color: formState.paidById ? '#333' : '#999' }}>{groupMembers.find(m => m.id === formState.paidById)?.name || 'Select payer...'}</Text></TouchableOpacity>{formState.errors.paidById && <Text style={styles.errorText}>{formState.errors.paidById}</Text>}</View>
        <View style={styles.formSection}><Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text><TextInput style={styles.input} placeholder="e.g., Dinner" value={formState.title} onChangeText={val => updateField('title', val)} editable={!submitting} />{formState.errors.title && <Text style={styles.errorText}>{formState.errors.title}</Text>}</View>
        <View style={styles.formSection}><View style={styles.row}><View style={styles.flex1}><Text style={styles.label}>Amount <Text style={styles.required}>*</Text></Text><TextInput style={styles.input} placeholder="0.00" value={formState.amount} onChangeText={val => {
              // Reject negative amounts
              if (val.startsWith('-')) {
                return;
              }
              updateField('amount', val);
            }} keyboardType="decimal-pad" editable={!submitting} />{formState.errors.amount && <Text style={styles.errorText}>{formState.errors.amount}</Text>}</View><View style={styles.flex1}><Text style={styles.label}>Currency</Text><TextInput style={[styles.input, styles.readonlyInput]} value={currency} editable={false} /></View></View></View>
        <View style={styles.formSection}><Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text><View style={styles.categoryContainer}>{categories.map(cat => (<TouchableOpacity key={cat.id} style={[styles.categoryButton, formState.category === cat.id && styles.categoryButtonActive]} onPress={() => updateField('category', cat.id)} disabled={submitting}><Text style={[styles.categoryText, formState.category === cat.id && styles.categoryTextActive]}>{cat.label}</Text></TouchableOpacity>))}</View>{formState.errors.category && <Text style={styles.errorText}>{formState.errors.category}</Text>}</View>
        <View style={styles.formSection}><Text style={styles.label}>Date</Text><TouchableOpacity onPress={() => setShowDatePicker(true)} disabled={submitting}><TextInput style={[styles.input, styles.readonlyInput]} value={formState.date} editable={false} pointerEvents="none" /></TouchableOpacity></View>
        <DatePickerModal visible={showDatePicker} selectedDate={formState.date} onSelectDate={date => updateField('date', date)} onClose={() => setShowDatePicker(false)} />
        <View style={styles.formSection}><Text style={styles.label}>Notes (Optional)</Text><TextInput style={[styles.input, styles.notesInput]} placeholder="Add details..." value={formState.notes} onChangeText={val => updateField('notes', val)} multiline editable={!submitting} /></View>
        <View style={styles.formSection}><Text style={styles.label}>Split (Optional)</Text><SplitMembersInput members={groupMembers} paidById={formState.paidById} splitWithIds={splitState.splitWithIds} splitType={splitState.splitType} splitAmount={splitState.splitAmount} splitPercentage={splitState.splitPercentage} totalAmount={formState.amount} onAddMember={addMember} onRemoveMember={removeMember} onUpdateAmount={updateAmount} onUpdatePercentage={updatePercentage} onSplitTypeChange={setSplitType} errors={formState.errors} /></View>
        <View style={styles.buttonContainer}><TouchableOpacity style={[styles.button, styles.updateButton]} onPress={handleUpdate} disabled={submitting}><Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Save'}</Text></TouchableOpacity><TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()} disabled={submitting}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
