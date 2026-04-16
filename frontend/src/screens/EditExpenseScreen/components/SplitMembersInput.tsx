/**
 * SplitMembersInput Component
 * Handles split configuration UI: member selection, split type, amounts/percentages
 * 
 * Wrapped with React.memo to prevent unnecessary re-renders on parent state changes
 * Fixes Issue #3: Prevents performance regression from re-rendering large split forms
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { SplitType } from '../../../types/common';
import type { GroupMember } from '../hooks/useExpenseData';

interface SplitMembersInputProps {
  members: GroupMember[];
  paidById: number | null;
  splitWithIds: number[];
  splitType: SplitType;
  splitAmount: Record<number, string>;
  splitPercentage: Record<number, string>;
  onAddMember: (id: number) => void;
  onRemoveMember: (id: number) => void;
  onUpdateAmount: (id: number, amount: string) => void;
  onUpdatePercentage: (id: number, percentage: string) => void;
  onSplitTypeChange: (type: SplitType) => void;
  errors?: Record<string, string>;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  selectedMembersContainer: {
    marginBottom: 12,
  },
  selectedMembersLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  chipClose: {
    fontSize: 16,
    color: '#cc0000',
    fontWeight: '600',
  },
  memberButtonContainer: {
    marginBottom: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: '30%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
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
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#0066cc',
    fontWeight: '600',
  },
  splitTypeContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  splitTypeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  splitTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  splitTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  splitTypeButtonActive: {
    borderColor: '#0066cc',
    backgroundColor: '#0066cc',
  },
  splitTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  splitTypeButtonTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
});

/**
 * SplitMembersInput Component
 * Handles:
 * 1. Selected members display (with remove buttons)
 * 2. Member selection buttons
 * 3. Split type selector (EQUAL/AMOUNT/PERCENTAGE)
 * 4. Amount/percentage input fields
 * 
 * Memoized to prevent re-renders on every parent keystroke
 */
function SplitMembersInputComponent(props: SplitMembersInputProps) {
  const {
    members,
    paidById,
    splitWithIds,
    splitType,
    splitAmount,
    splitPercentage,
    onAddMember,
    onRemoveMember,
    onUpdateAmount,
    onUpdatePercentage,
    onSplitTypeChange,
    errors = {},
  } = props;

  // Filter out payer from member list
  const availableMembers = useMemo(() => {
    return members.filter(m => m.id !== paidById);
  }, [members, paidById]);

  // Get selected member objects
  const selectedMembers = useMemo(() => {
    return members.filter(m => splitWithIds.includes(m.id));
  }, [members, splitWithIds]);

  if (!members.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Selected Members Display */}
      {splitWithIds.length > 0 && (
        <View style={styles.selectedMembersContainer}>
          <Text style={styles.selectedMembersLabel}>Selected Members</Text>
          <View style={styles.chipContainer}>
            {selectedMembers.map(member => (
              <TouchableOpacity
                key={member.id}
                style={styles.chip}
                onPress={() => onRemoveMember(member.id)}
              >
                <Text style={styles.chipText}>{member.name || 'Unknown Member'}</Text>
                <Text style={styles.chipClose}>✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Member Selection Buttons */}
      <View style={styles.memberButtonContainer}>
        <Text style={styles.sectionLabel}>Who should this expense be split with?</Text>
        <View style={styles.categoryContainer}>
          {availableMembers.map(member => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.categoryButton,
                splitWithIds.includes(member.id) && styles.categoryButtonActive,
              ]}
              onPress={() => {
                if (splitWithIds.includes(member.id)) {
                  onRemoveMember(member.id);
                } else {
                  onAddMember(member.id);
                }
              }}
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
      </View>

      {/* Split Type Selector */}
      {splitWithIds.length > 0 && (
        <View style={styles.splitTypeContainer}>
          <Text style={styles.splitTypeLabel}>How to split?</Text>
          <View style={styles.splitTypeButtons}>
            {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.splitTypeButton,
                  splitType === type && styles.splitTypeButtonActive,
                ]}
                onPress={() => onSplitTypeChange(type)}
              >
                <Text
                  style={[
                    styles.splitTypeButtonText,
                    splitType === type && styles.splitTypeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount/Percentage Inputs */}
          {splitType !== 'EQUAL' && (
            <View>
              {splitWithIds.map(memberId => {
                const member = members.find(m => m.id === memberId);
                const isAmount = splitType === 'AMOUNT';
                const value = isAmount ? splitAmount[memberId] : splitPercentage[memberId];
                const suffix = isAmount ? '' : '%';

                return (
                  <View key={memberId} style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>
                      {member?.name || 'Unknown Member'} ({isAmount ? 'Amount' : 'Percentage'})
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={isAmount ? '0.00' : '0'}
                      value={value || ''}
                      onChangeText={newValue => {
                        if (isAmount) {
                          onUpdateAmount(memberId, newValue);
                        } else {
                          onUpdatePercentage(memberId, newValue);
                        }
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                );
              })}

              {/* Payer percentage for PERCENTAGE split */}
              {splitType === 'PERCENTAGE' && paidById !== null && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>You (Payer) %</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={splitPercentage[paidById] || ''}
                    onChangeText={newValue => onUpdatePercentage(paidById, newValue)}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>
          )}

          {/* Error Message */}
          {errors.split && <Text style={styles.errorText}>{errors.split}</Text>}
        </View>
      )}
    </View>
  );
}

// ✅ Issue #3: Memoized to prevent re-renders on parent keystroke
export const SplitMembersInput = React.memo(SplitMembersInputComponent, (prevProps, nextProps) => {
  // Deep equality check - only re-render if props actually changed
  return (
    prevProps.paidById === nextProps.paidById &&
    prevProps.splitType === nextProps.splitType &&
    JSON.stringify(prevProps.splitWithIds) === JSON.stringify(nextProps.splitWithIds) &&
    JSON.stringify(prevProps.splitAmount) === JSON.stringify(nextProps.splitAmount) &&
    JSON.stringify(prevProps.splitPercentage) === JSON.stringify(nextProps.splitPercentage) &&
    JSON.stringify(prevProps.members) === JSON.stringify(nextProps.members) &&
    JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors)
  );
});

SplitMembersInput.displayName = 'SplitMembersInput';
