/**
 * Settlement Screen
 * 
 * Displays member-by-member settlement breakdown showing:
 * - How much each member paid
 * - How much each member owes
 * - Net balance (who owes whom)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { Expense } from '../services/expenseService';
import type { SettlementScreenProps } from '../types/navigation';

/**
 * Calculate user's share of an expense based on split type and their role.
 * Single source of truth - used by ExpenseListScreen, SettlementScreen, and other components.
 * Handles payer inclusion detection for accurate calculations.
 */
function calculateUserExpenseShare(exp: Expense, userId: number | undefined): number {
  if (!userId) return 0;
  
  // Check if user is the payer
  if (exp.paidBy?.id === userId) {
    // User is the payer - calculate their share based on split type
    if (exp.splitType === 'EQUAL' && exp.splitWith && exp.splitWith.length > 0) {
      // Check if payer is in the split
      const payerInSplit = exp.splitWith.some(m => m.id === exp.paidBy?.id);
      const totalPeople = payerInSplit ? exp.splitWith.length : exp.splitWith.length + 1;
      return exp.amount / totalPeople;
    } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage) {
      // Find payer's index in splitWith
      const payerIndex = exp.splitWith?.findIndex(m => m.id === exp.paidBy?.id) ?? -1;
      if (payerIndex !== -1 && exp.splitPercentage?.[payerIndex]) {
        return (exp.amount * exp.splitPercentage[payerIndex]) / 100;
      } else if (exp.splitPercentage?.[0]) {
        // Fallback: payer is not in split
        return (exp.amount * exp.splitPercentage[0]) / 100;
      }
    } else if (exp.splitType === 'AMOUNT' && exp.splitAmount) {
      // Amount split: total - sum of others' amounts
      return exp.amount - exp.splitAmount.reduce((a, b) => a + b, 0);
    } else if (!exp.splitWith || exp.splitWith.length === 0) {
      // No split - user pays full amount
      return exp.amount;
    }
  } else {
    // User is in splitWith - find their share
    const userIndex = exp.splitWith?.findIndex(u => u.id === userId) ?? -1;
    if (userIndex !== -1) {
      if (exp.splitType === 'EQUAL') {
        // Check if payer is in the split
        const payerInSplit = exp.splitWith.some(m => m.id === exp.paidBy?.id);
        const totalPeople = payerInSplit ? exp.splitWith.length : exp.splitWith.length + 1;
        return exp.amount / totalPeople;
      } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage?.[userIndex]) {
        return (exp.amount * exp.splitPercentage[userIndex]) / 100;
      } else if (exp.splitType === 'AMOUNT' && exp.splitAmount?.[userIndex]) {
        return exp.splitAmount[userIndex];
      }
    }
  }
  return 0;
}

interface Debt {
  otherMemberId: number;
  otherMemberName: string;
  amount: number;
  expenseName: string;
}

interface MemberSettlement {
  memberId: number;
  memberName: string;
  totalPaid: number;
  totalOwes: number;
  netBalance: number; // positive = owed to user, negative = user owes
  owesTo: Debt[]; // what this member owes to others
  isOwedBy: Debt[]; // what others owe to this member
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  listContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  memberCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  memberCardOwedToUser: {
    borderLeftColor: '#28a745',
  },
  memberCardUserOwes: {
    borderLeftColor: '#dc3545',
  },
  memberCardEven: {
    borderLeftColor: '#99a',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  memberLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  memberAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  memberNet: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  memberNetOwedToUser: {
    color: '#28a745',
  },
  memberNetUserOwes: {
    color: '#dc3545',
  },
  memberNetEven: {
    color: '#999',
  },
  debtSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  debtSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  debtItem: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});

function SettlementScreenComponent({ navigation, route }: SettlementScreenProps) {
  const params = route.params || {};
  const groupId = params.groupId || 0;
  const groupName = params.groupName || 'Group';
  const expenses = params.expenses as Expense[] || [];
  const { user: currentUser } = useAuth();

  // Debug what we actually received
  useEffect(() => {
    console.log('🔍 SettlementScreen mounted');
    console.log('  Expenses received:', expenses.length);
    console.log('  Looking for rent expense...');
    const rentExpense = expenses.find(e => 
      (e.category && e.category.toLowerCase().includes('rent')) || 
      (e.title && e.title.toLowerCase().includes('rent'))
    );
    if (rentExpense) {
      console.log('  ✅ Found rent:', {
        id: rentExpense.id,
        category: rentExpense.category,
        amount: rentExpense.amount,
        paidBy: rentExpense.paidBy?.name,
        splitWith: rentExpense.splitWith?.map(m => m.name),
      });
    } else {
      console.log('  ❌ Rent expense NOT found in array');
      console.log('  All expenses:', expenses.map(e => ({ category: e.category, amount: e.amount })));
    }
  }, [expenses]);

  // Calculate member settlements with PAIRWISE logic
  // For each pair of members: find all expenses they both participated in, 
  // calculate net balance between them
  const memberSettlements = useMemo((): MemberSettlement[] => {
    if (!expenses.length) return [];

    console.log('🔍 Settlement - Received expenses:', expenses.length);
    expenses.forEach((e, idx) => {
      console.log(`  [${idx}] ${e.category || 'Unknown'} - Amount: ${e.amount}, Paid by: ${e.paidBy?.name || 'MISSING'}, Split with: ${e.splitWith?.map(m => m.name).join(', ')}`);
    });

    // Collect all unique members involved in any expense
    const memberSet = new Set<number>();
    const memberNames = new Map<number, string>();

    for (const exp of expenses) {
      if (exp.paidBy?.id) {
        memberSet.add(exp.paidBy.id);
        memberNames.set(exp.paidBy.id, exp.paidBy.name);
      }
      if (exp.splitWith) {
        for (const member of exp.splitWith) {
          memberSet.add(member.id);
          memberNames.set(member.id, member.name);
        }
      }
    }

    const allMembers = Array.from(memberSet);
    console.log('👥 All members involved:', allMembers.map(id => memberNames.get(id)));

    // For each member, calculate their net position
    const settlements = new Map<number, MemberSettlement>();

    for (const memberId of allMembers) {
      const member: MemberSettlement = {
        memberId,
        memberName: memberNames.get(memberId) || 'Unknown',
        totalPaid: 0,
        totalOwes: 0,
        netBalance: 0,
        owesTo: [],
        isOwedBy: [],
      };

      // Go through all expenses
      for (const exp of expenses) {
        // If this member is the payer, add to totalPaid
        if (exp.paidBy?.id === memberId) {
          member.totalPaid += exp.amount;
          console.log(`  ${member.memberName} paid ${exp.amount} (${exp.category})`);
        }

        // If this member is in the split, calculate their share and add to totalOwes
        const memberInSplit = exp.splitWith?.findIndex(m => m.id === memberId);
        if (memberInSplit !== undefined && memberInSplit >= 0) {
          let share = 0;

          if (exp.splitType === 'EQUAL') {
            const payerInSplit = exp.splitWith?.some(m => m.id === exp.paidBy?.id);
            const totalPeople = payerInSplit ? exp.splitWith!.length : exp.splitWith!.length + 1;
            share = exp.amount / totalPeople;
          } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage?.[memberInSplit]) {
            share = (exp.amount * exp.splitPercentage[memberInSplit]) / 100;
          } else if (exp.splitType === 'AMOUNT' && exp.splitAmount?.[memberInSplit]) {
            share = exp.splitAmount[memberInSplit];
          }

          // If this member paid, they don't owe themselves
          if (exp.paidBy?.id !== memberId) {
            member.totalOwes += share;
            console.log(`  ${member.memberName} owes ${share} for ${exp.category} (paid by ${exp.paidBy?.name})`);

            // Record who they owe to
            const existing = member.owesTo.find(d => d.otherMemberId === exp.paidBy?.id);
            if (existing) {
              existing.amount += share;
            } else {
              member.owesTo.push({
                otherMemberId: exp.paidBy?.id || 0,
                otherMemberName: exp.paidBy?.name || 'Unknown',
                amount: share,
                expenseName: exp.category,
              });
            }
          }
        }
      }

      member.netBalance = member.totalPaid - member.totalOwes;
      settlements.set(memberId, member);
    }

    const result = Array.from(settlements.values()).sort((a, b) =>
      a.memberName.localeCompare(b.memberName)
    );

    console.log('📊 Final Settlement:', result);
    return result;
  }, [expenses, currentUser?.id]);

  const renderMemberCard = useCallback(({ item }: { item: MemberSettlement }) => {
    const isUserOwes = item.netBalance > 0.01;
    const isOwedToUser = item.netBalance < -0.01;
    const isEven = Math.abs(item.netBalance) <= 0.01;

    return (
      <View
        style={[
          styles.memberCard,
          isOwedToUser && styles.memberCardOwedToUser,
          isUserOwes && styles.memberCardUserOwes,
          isEven && styles.memberCardEven,
        ]}
      >
        <Text style={styles.memberName}>{item.memberName}</Text>

        <View style={styles.memberRow}>
          <Text style={styles.memberLabel}>Paid:</Text>
          <Text style={styles.memberAmount}>GBP {item.totalPaid.toFixed(2)}</Text>
        </View>

        <View style={styles.memberRow}>
          <Text style={styles.memberLabel}>Owes in splits:</Text>
          <Text style={styles.memberAmount}>GBP {item.totalOwes.toFixed(2)}</Text>
        </View>

        {/* Show detailed debt breakdown */}
        {(item.owesTo.length > 0 || item.isOwedBy.length > 0) && (
          <View style={styles.debtSection}>
            {item.owesTo.length > 0 && (
              <>
                <Text style={styles.debtSectionTitle}>Owes to:</Text>
                {item.owesTo.map((debt, idx) => (
                  <Text key={`owes-${idx}`} style={styles.debtItem}>
                    • {item.memberName} owes {debt.otherMemberName} GBP {debt.amount.toFixed(2)}
                  </Text>
                ))}
              </>
            )}
            {item.isOwedBy.length > 0 && (
              <>
                <Text style={[styles.debtSectionTitle, { marginTop: item.owesTo.length > 0 ? 8 : 0 }]}>
                  Is owed by:
                </Text>
                {item.isOwedBy.map((debt, idx) => (
                  <Text key={`owed-${idx}`} style={styles.debtItem}>
                    • {debt.otherMemberName} owes {item.memberName} GBP {debt.amount.toFixed(2)}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}

        <Text
          style={[
            styles.memberNet,
            isOwedToUser && styles.memberNetOwedToUser,
            isUserOwes && styles.memberNetUserOwes,
            isEven && styles.memberNetEven,
          ]}
        >
          {isUserOwes && `You owe GBP ${item.netBalance.toFixed(2)}`}
          {isOwedToUser && `Owes you GBP ${Math.abs(item.netBalance).toFixed(2)}`}
          {isEven && `Settled`}
        </Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settlement Breakdown</Text>
        <Text style={styles.headerSubtitle}>{groupName}</Text>
      </View>

      {memberSettlements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No settlement data</Text>
          <Text style={styles.emptySubtext}>No members to settle with</Text>
        </View>
      ) : (
        <FlatList
          data={memberSettlements}
          renderItem={renderMemberCard}
          keyExtractor={item => `member-${item.memberId}`}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={true}
        />
      )}
    </View>
  );
}

export const SettlementScreen = SettlementScreenComponent;
