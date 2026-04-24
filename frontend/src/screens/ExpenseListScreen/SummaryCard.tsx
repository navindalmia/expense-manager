/**
 * Summary Card Component
 * 
 * Displays financial summary (Total, Personal, Balance)
 * at the top of ExpenseListScreen.
 * Extracted for better code organization and reusability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SummaryCardProps {
  total: number;
  personal: number;
  balance: number;
  currencyCode: string;
  onPress: () => void;
}

export function SummaryCard({
  total,
  personal,
  balance,
  currencyCode,
  onPress,
}: SummaryCardProps) {
  return (
    <TouchableOpacity
      style={styles.summaryCard}
      testID="summary-card"
      accessible={true}
      accessibilityLabel={`Total: ${currencyCode} ${total.toFixed(2)}, Your share: ${currencyCode} ${personal.toFixed(2)}, Balance: ${balance > 0 ? 'owed' : 'owe'} ${currencyCode} ${Math.abs(balance).toFixed(2)}`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={styles.column}>
          <Text style={styles.summaryLabel}>TOTAL</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.summaryLabel}>MY PERSONAL</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.summaryLabel}>BALANCE</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <View style={styles.column}>
          <Text style={styles.summaryAmount} numberOfLines={1}>
            {currencyCode}
          </Text>
          <Text style={styles.summaryAmount} numberOfLines={1}>
            {total.toFixed(2)}
          </Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.summaryAmount} numberOfLines={1}>
            {currencyCode}
          </Text>
          <Text style={styles.summaryAmount} numberOfLines={1}>
            {personal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.column}>
          <Text
            style={[
              styles.summaryAmount,
              { color: balance >= 0 ? '#28a745' : '#dc3545', fontSize: 12 },
            ]}
            numberOfLines={1}
          >
            {balance >= 0 ? 'Owed' : 'Owe'}
          </Text>
          <Text
            style={[
              styles.summaryAmount,
              { color: balance >= 0 ? '#28a745' : '#dc3545' },
            ]}
            numberOfLines={1}
          >
            {currencyCode}
          </Text>
          <Text
            style={[
              styles.summaryAmount,
              { color: balance >= 0 ? '#28a745' : '#dc3545', fontSize: 16 },
            ]}
            numberOfLines={1}
          >
            {Math.abs(balance).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Tap to see settlement breakdown →
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#e8f4fd',
    borderRadius: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#0066cc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },

  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 2,
  },

  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryLabel: {
    fontSize: 8,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },

  summaryAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0066cc',
    textAlign: 'center',
    lineHeight: 18,
  },

  footer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },

  footerText: {
    fontSize: 11,
    color: '#0066cc',
    fontWeight: '500',
    textAlign: 'center',
  },
});
