/**
 * Edit Expense Screen (REFACTORED v0.3.2)
 * 
 * Orchestrates extracted hooks and components for editing expenses.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import type { EditExpenseScreenProps } from '../types/navigation';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { useAuth } from '../context/AuthContext';
import { updateExpense, createExpense } from '../services/expenseService';
import { getCategories } from '../services/categoryService';
import { useExpenseData, useExpenseForm, useSplitCalculator, DatePickerModal, SplitMembersInput } from './EditExpenseScreen/index';
import { AccordionSection } from '../components/AccordionSection';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 12, paddingBottom: 100 },
  stickyFooter: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 20, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 8 },
  formSection: { backgroundColor: '#fff', borderRadius: 6, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  required: { color: '#cc0000' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#333', marginBottom: 8 },
  notesInput: { height: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  flex1: { flex: 1 },
  categoryContainer: { marginBottom: 0 },
  categoryScroll: { display: 'none' },
  categoryButton: { display: 'none' },
  categoryButtonActive: { borderColor: '#0066cc', backgroundColor: '#e6f0ff' },
  categoryText: { fontSize: 12, color: '#666', fontWeight: '500' },
  categoryTextActive: { color: '#0066cc', fontWeight: '600' },
  buttonContainer: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 10, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  updateButton: { backgroundColor: '#0066cc' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelButtonText: { color: '#666' },
  errorText: { color: '#cc0000', fontSize: 11, marginTop: -6, marginBottom: 8 },
  pickerModal: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 12, paddingBottom: 20, maxHeight: '80%' },
  pickerHeader: { paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerItemText: { fontSize: 15, color: '#333' },
  readonlyInput: { backgroundColor: '#f5f5f5' },
  interactiveInput: { backgroundColor: '#fff', borderColor: '#0066cc', borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});

export default function EditExpenseScreen({ navigation, route }: EditExpenseScreenProps) {
  const { expenseId, groupId, groupName, groupCurrencyCode = 'GBP' } = route.params || {};
  const { user } = useAuth();
  
  // Determine if CREATE or EDIT mode
  const isCreateMode = !expenseId;
  const screenTitle = isCreateMode ? 'Create Expense' : 'Edit Expense';

  const { expense, categories, groupMembers, loading: dataLoading, error: dataError } = useExpenseData(expenseId, groupId);
  const { formState, updateField, setError, clearErrors, prefillFromExpense } = useExpenseForm(expense);
  const { splitState, addMember, removeMember, updateAmount, updatePercentage, setSplitType, getValidationError, getSplitPayload } = useSplitCalculator(formState.amount, formState.paidById, groupMembers, expense);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitTypeModal, setShowSplitTypeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Set header with group name on the right and title
  useEffect(() => {
    navigation.setOptions({
      headerTitle: screenTitle,
      headerRight: () => (
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0066cc', marginRight: 16 }}>
          {groupName}
        </Text>
      ),
    });
  }, [navigation, groupName, screenTitle]);

  useEffect(() => {
    if (expense) {
      prefillFromExpense(expense);
      if (expense.splitWith?.length > 0) {
        // Deduplicate members before adding
        const uniqueMemberIds = [...new Set(expense.splitWith.map(u => u.id))];
        uniqueMemberIds.forEach(userId => addMember(userId));
        
        if (expense.splitType === 'PERCENTAGE' && expense.splitPercentage?.length > 0) {
          // Load percentages directly from array (index 0+ = member 0+)
          expense.splitWith.forEach((user, idx) => {
            if (expense.splitPercentage?.[idx]) {
              updatePercentage(user.id, expense.splitPercentage[idx].toString());
            }
          });
        } else if (expense.splitType === 'AMOUNT' && expense.splitAmount?.length > 0) {
          // Load amounts directly from array (index 0+ = member 0+)
          expense.splitWith.forEach((user, idx) => {
            if (expense.splitAmount?.[idx]) {
              updateAmount(user.id, expense.splitAmount[idx].toString());
            }
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
      console.log('❌ VALIDATION FAILED - Form errors:', formState);
      console.log('   Title:', formState.title);
      console.log('   Amount:', formState.amount);
      console.log('   Category:', formState.category);
      console.log('   Payer:', formState.paidById);
      console.log('   Date:', formState.date);
      console.log('   Split IDs:', splitState.splitWithIds);
      
      // Check which field failed
      const firstError = Object.values(formState.errors).find(e => e);
      if (firstError) {
        Alert.alert('Validation Error', firstError);
      }
      return;
    }

    // For EDIT mode, expense must be loaded
    if (!isCreateMode && !expense) {
      logger.warn('Expense not loaded yet');
      console.log('❌ EDIT MODE: Expense not loaded');
      return;
    }

    setSubmitting(true);
    try {
      const splitPayload = getSplitPayload();
      
      console.log('📤 SUBMITTING EXPENSE');
      console.log('   Mode:', isCreateMode ? 'CREATE' : 'EDIT');
      console.log('   Title:', formState.title);
      console.log('   Amount:', formState.amount);
      console.log('   Category ID:', formState.category);
      console.log('   Paid By ID:', formState.paidById);
      console.log('   Date:', formState.date);
      console.log('   Currency:', currency);
      console.log('   Split Type:', splitState.splitType);
      console.log('   Split Members:', splitState.splitWithIds);
      console.log('   Split Payload:', splitPayload);
      
      const payload: any = { 
        title: formState.title.trim(), 
        amount: parseFloat(formState.amount), 
        categoryId: formState.category, 
        paidById: formState.paidById, 
        expenseDate: formState.date,
        currency: currency,  // ← ADD CURRENCY!
        notes: formState.notes.trim() || undefined, 
        ...splitPayload 
      };
      
      console.log('📦 FULL PAYLOAD:', JSON.stringify(payload, null, 2));
      
      if (isCreateMode) {
        // CREATE mode
        logger.info('Creating expense', { groupId, paidById: formState.paidById, splitType: splitState.splitType });
        payload.groupId = groupId;
        console.log('🆕 CREATE MODE - Calling createExpense with:', payload);
        await createExpense(payload);
        logger.info('Expense created successfully', { groupId, title: formState.title });
        console.log('✅ Expense created successfully!');
        Alert.alert('Success', 'Expense created');
      } else {
        // EDIT mode
        logger.info('Attempting update', { expenseId, paidById: formState.paidById, splitType: splitState.splitType });
        console.log('✏️ EDIT MODE - Calling updateExpense with:', payload);
        await updateExpense(expenseId, payload);
        logger.info('Expense updated successfully', { expenseId, title: formState.title });
        console.log('✅ Expense updated successfully!');
        Alert.alert('Success', 'Expense updated');
      }
      
      navigation.goBack();
    } catch (err: any) {
      const msg = getErrorMessage(err);
      console.log('❌ API ERROR:', msg);
      console.log('   Full error:', err);
      logger.error(isCreateMode ? 'Create failed' : 'Update failed', err, { 
        [isCreateMode ? 'groupId' : 'expenseId']: isCreateMode ? groupId : expenseId, 
        errorMsg: msg 
      });
      Alert.alert('Error', msg || `Failed to ${isCreateMode ? 'create' : 'update'} expense`);
    } finally {
      setSubmitting(false);
    }
  }, [formState, expense, validateForm, getSplitPayload, expenseId, groupId, isCreateMode, navigation, splitState.splitType]);

  if (dataLoading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0066cc" /><Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text></View>);
  if (dataError) return (<View style={styles.loadingContainer}><Text style={{ color: '#cc0000', fontSize: 16, marginBottom: 16 }}>{dataError}</Text><TouchableOpacity style={[styles.button, styles.updateButton]} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Go Back</Text></TouchableOpacity></View>);

  const currency = expense?.currency.code || groupCurrencyCode;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Modal visible={showPayerModal} transparent animationType="slide" onRequestClose={() => setShowPayerModal(false)}><View style={styles.pickerModal}><View style={styles.pickerContent}><View style={styles.pickerHeader}><Text style={styles.pickerTitle}>Who Paid?</Text><TouchableOpacity onPress={() => setShowPayerModal(false)}><Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text></TouchableOpacity></View><ScrollView>{groupMembers.map(member => (<TouchableOpacity key={member.id} style={[styles.pickerItem, formState.paidById === member.id && { backgroundColor: '#e6f0ff' }]} onPress={() => { updateField('paidById', member.id); setShowPayerModal(false); }}><Text style={[styles.pickerItemText, formState.paidById === member.id && { color: '#0066cc', fontWeight: '600' }]}>{member.name}</Text></TouchableOpacity>))}</ScrollView></View></View></Modal>
        <View style={styles.formSection}><Text style={styles.label}>Paid By <Text style={styles.required}>*</Text></Text><TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPayerModal(true)}><Text style={{ color: formState.paidById ? '#333' : '#999' }}>{groupMembers.find(m => m.id === formState.paidById)?.name || 'Select payer...'}</Text></TouchableOpacity>{formState.errors.paidById && <Text style={styles.errorText}>{formState.errors.paidById}</Text>}</View>
        <View style={styles.formSection}><Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text><TextInput style={styles.input} placeholder="e.g., Dinner" value={formState.title} onChangeText={val => updateField('title', val)} editable={!submitting} />{formState.errors.title && <Text style={styles.errorText}>{formState.errors.title}</Text>}</View>
        <View style={styles.formSection}><View style={styles.row}><View style={{width: 70}}><Text style={styles.label}>Currency</Text><TextInput style={[styles.input, styles.readonlyInput]} value={currency} editable={false} /></View><View style={styles.flex1}><Text style={styles.label}>Amount <Text style={styles.required}>*</Text></Text><TextInput style={styles.input} placeholder="0.00" value={formState.amount} onChangeText={val => {
              // Reject negative amounts
              if (val.startsWith('-')) {
                return;
              }
              updateField('amount', val);
            }} keyboardType="decimal-pad" editable={!submitting} />{formState.errors.amount && <Text style={styles.errorText}>{formState.errors.amount}</Text>}</View><View style={styles.flex1}><Text style={styles.label}>Split Type</Text><TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowSplitTypeModal(true)} disabled={submitting}><Text style={{ color: '#333' }}>{splitState.splitType === 'EQUAL' ? 'Equal' : splitState.splitType === 'AMOUNT' ? 'AMOUNT' : 'Percentage'}</Text></TouchableOpacity></View></View></View>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={[styles.interactiveInput, { justifyContent: 'center', paddingVertical: 12 }]} onPress={() => setShowCategoryPicker(true)} disabled={submitting}>
              <Text style={{ color: formState.category ? '#333' : '#666', fontSize: 14, fontWeight: '500' }}>{categories.find(c => c.id === formState.category)?.label || 'Select category...'}</Text>
            </TouchableOpacity>
            {formState.errors.category && <Text style={styles.errorText}>{formState.errors.category}</Text>}
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>When</Text>
            <TouchableOpacity style={[styles.interactiveInput, { justifyContent: 'center', paddingVertical: 12 }]} onPress={() => setShowDatePicker(true)} disabled={submitting}>
              <Text style={{ color: '#333', fontSize: 14, fontWeight: '500' }}>{formState.date}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Picker Modal */}
        <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <Text style={{ fontSize: 14, color: '#0066cc', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.pickerItem, formState.category === cat.id && { backgroundColor: '#e6f0ff' }]}
                    onPress={() => {
                      updateField('category', cat.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, formState.category === cat.id && { color: '#0066cc', fontWeight: '600' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <DatePickerModal visible={showDatePicker} selectedDate={formState.date} onSelectDate={date => updateField('date', date)} onClose={() => setShowDatePicker(false)} />

        {/* Split Type Modal */}
        <Modal visible={showSplitTypeModal} transparent animationType="slide" onRequestClose={() => setShowSplitTypeModal(false)}>
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
                  { value: 'AMOUNT', label: 'AMOUNT - Each person\'s share' },
                  { value: 'PERCENTAGE', label: 'Percentage - By percentage' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pickerItem, splitState.splitType === option.value && { backgroundColor: '#e6f0ff' }]}
                    onPress={() => {
                      setSplitType(option.value as any);
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

        <View style={styles.formSection}><Text style={styles.label}>Split (Optional)</Text><SplitMembersInput members={groupMembers} paidById={formState.paidById} splitWithIds={splitState.splitWithIds} splitAmount={splitState.splitAmount} splitPercentage={splitState.splitPercentage} splitType={splitState.splitType} totalAmount={formState.amount} currency={currency} onAddMember={addMember} onRemoveMember={removeMember} onUpdateAmount={updateAmount} onUpdatePercentage={updatePercentage} errors={formState.errors} /></View>

        <AccordionSection title="Additional Notes" isOptional={true} defaultExpanded={formState.notes.length > 0}><TextInput style={[styles.input, styles.notesInput]} placeholder="Add details..." value={formState.notes} onChangeText={val => updateField('notes', val)} multiline editable={!submitting} /></AccordionSection>

        <View style={styles.stickyFooter}>
          <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={handleUpdate} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()} disabled={submitting}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
