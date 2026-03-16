/**
 * ExpenseListScreen Styles
 * 
 * Centralized styling for ExpenseListScreen component.
 * Extracted to separate file for readability and maintainability.
 */

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },

  addButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },

  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  summaryCard: {
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },

  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },

  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },

  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  expenseItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },

  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  expenseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },

  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0066cc',
    marginLeft: 8,
  },

  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  expenseDate: {
    fontSize: 12,
    color: '#999',
  },

  expenseCategory: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  expenseNotes: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },

  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
  },

  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 6,
  },

  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
