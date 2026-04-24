/**
 * SplitMembersInput Component
 * Handles split configuration UI: member selection, split type, amounts/percentages
 * 
 * Wrapped with React.memo to prevent unnecessary re-renders on parent state changes
 * Fixes Issue #3: Prevents performance regression from re-rendering large split forms
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { GroupMember } from '../hooks/useExpenseData';
import { calculateMemberShare } from '../utils/splitValidation';

interface SplitMembersInputProps {
  members: GroupMember[];
  paidById: number | null;
  splitWithIds: number[];
  splitAmount: Record<number, string>;
  splitPercentage: Record<number, string>;
  splitType: 'EQUAL' | 'AMOUNT' | 'PERCENTAGE';
  totalAmount?: string;
  currency?: string;
  onAddMember: (id: number) => void;
  onRemoveMember: (id: number) => void;
  onUpdateAmount: (id: number, amount: string) => void;
  onUpdatePercentage: (id: number, percentage: string) => void;
  errors?: Record<string, string>;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  checkboxContainer: {
    backgroundColor: '#fafafa',
    borderRadius: 4,
    paddingVertical: 4,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#0066cc',
    backgroundColor: '#0066cc',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  payerBadge: {
    fontSize: 9,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    fontWeight: '600',
  },
  memberAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    minWidth: 85,
    textAlign: 'right',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 0,
  },
});

/**
 * SplitMembersInput Component
 * Compact member selection with real-time amount calculation (Tricount-style)
 * Displays checkboxes for all members with live split amounts
 */
function SplitMembersInputComponent(props: SplitMembersInputProps) {
  const {
    members,
    paidById,
    splitWithIds,
    splitAmount,
    splitPercentage,
    splitType,
    totalAmount = '0',
    currency = 'GBP',
    onAddMember,
    onRemoveMember,
    onUpdateAmount,
    onUpdatePercentage,
    errors = {},
  } = props;

  // Get payer's name
  const payerName = members.find(m => m.id === paidById)?.name || 'Payer';

  // Calculate if all non-payer members are selected
  const selectableMembers = members.filter(m => m.id !== paidById);
  const allSelected = selectableMembers.length > 0 && selectableMembers.every(m => splitWithIds.includes(m.id));

  // Handle select/deselect all
  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      selectableMembers.forEach(m => {
        if (splitWithIds.includes(m.id)) {
          onRemoveMember(m.id);
        }
      });
    } else {
      // Select all non-payer members
      selectableMembers.forEach(m => {
        if (!splitWithIds.includes(m.id)) {
          onAddMember(m.id);
        }
      });
    }
  };

  // Helper to safely calculate percentage-based amount
  const calculatePercentageAmount = (percentStr: string, totalStr: string): string => {
    const total = parseFloat(totalStr || '0') || 0;
    const percent = parseFloat(percentStr || '0') || 0;
    const result = (total * percent) / 100;
    return isNaN(result) ? '0.00' : result.toFixed(2);
  };

  if (!members.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Select/Deselect All Button */}
      {selectableMembers.length > 1 && (
        <TouchableOpacity
          style={[styles.checkboxRow, { backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginBottom: 4 }]}
          onPress={handleSelectAll}
        >
          <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
            {allSelected && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { fontWeight: '600', color: '#0066cc' }]}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Compact Member Selection with Checkboxes and Real-time Amounts - TRICOUNT STYLE */}
      <View style={styles.checkboxContainer}>
        {members.map(member => {
          const isSelected = splitWithIds.includes(member.id);
          let memberShare = '0.00';
          if (isSelected) {
            const share = calculateMemberShare(
              'EQUAL',
              parseFloat(totalAmount || '0') || 0,
              splitAmount[member.id],
              splitPercentage[member.id],
              splitWithIds.length
            );
            memberShare = isNaN(parseFloat(share)) ? '0.00' : share;
          }
          
          return (
            <TouchableOpacity
              key={member.id}
              style={styles.checkboxRow}
              onPress={() => {
                if (isSelected) {
                  onRemoveMember(member.id);
                } else {
                  onAddMember(member.id);
                }
              }}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>{member.name}</Text>
              {member.id === paidById && <Text style={styles.payerBadge}>Payer</Text>}
              {isSelected && splitType === 'AMOUNT' ? (
                <TextInput
                  style={[styles.memberAmount, { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, width: 80, textAlign: 'right', marginLeft: 'auto' }]}
                  value={splitAmount[member.id] || ''}
                  onChangeText={val => onUpdateAmount(member.id, val)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              ) : isSelected && splitType === 'PERCENTAGE' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
                  <TextInput
                    style={[styles.memberAmount, { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 6, paddingVertical: 6, fontSize: 14, width: 50, textAlign: 'right' }]}
                    value={splitPercentage[member.id] || ''}
                    onChangeText={val => onUpdatePercentage(member.id, val)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  <Text style={{ fontSize: 12, color: '#999', fontWeight: '500' }}>%</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', width: 50, textAlign: 'right' }}>
                    {calculatePercentageAmount(splitPercentage[member.id] || '', totalAmount || '0')}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.memberAmount, { marginLeft: 'auto', width: 50, textAlign: 'right' }]}>{memberShare}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error Message */}
      {errors.split && <Text style={styles.errorText}>{errors.split}</Text>}
    </View>
  );
}

// ✅ Issue #3: Memoized to prevent re-renders on parent keystroke
export const SplitMembersInput = React.memo(SplitMembersInputComponent, (prevProps, nextProps) => {
  // Deep equality check - only re-render if props actually changed
  return (
    prevProps.paidById === nextProps.paidById &&
    prevProps.splitType === nextProps.splitType &&
    prevProps.currency === nextProps.currency &&
    JSON.stringify(prevProps.splitWithIds) === JSON.stringify(nextProps.splitWithIds) &&
    JSON.stringify(prevProps.splitAmount) === JSON.stringify(nextProps.splitAmount) &&
    JSON.stringify(prevProps.splitPercentage) === JSON.stringify(nextProps.splitPercentage) &&
    JSON.stringify(prevProps.members) === JSON.stringify(nextProps.members) &&
    JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors)
  );
});

SplitMembersInput.displayName = 'SplitMembersInput';
