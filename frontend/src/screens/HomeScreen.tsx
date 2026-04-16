/**
 * Home Screen
 * 
 * Displays all expense groups (lists/trips/months).
 * Allows creation of new groups and navigation to existing ones.
 * Shows loading, error, and empty states.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EditGroupModal from '../components/EditGroupModal';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import type { Group } from '../services/groupService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 12,
    color: '#666',
  },
  groupCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  groupDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  groupDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  editButtonText: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '600',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  groupTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
});

/**
 * Format date efficiently - memoize to avoid recalculation
 */
const formatGroupDate = (createdAt: string): string => {
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
};

/**
 * Home Screen showing all groups/lists
 */
function HomeScreen({ navigation }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<Group | null>(null);
  const { logout } = useAuth();

  /**
   * Set up header with logout button
   */
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={logout}
          style={{ marginRight: 16 }}
        >
          <Text style={{ color: '#0066cc', fontSize: 14, fontWeight: '600' }}>
            Logout
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  /**
   * Fetch all groups from backend
   */
  const loadGroups = useCallback(async () => {
    try {
      setError(null);
      const response = await http.get('/groups');
      setGroups(response.data.data || []);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      logger.error('Failed to load groups', err, {
        screen: 'HomeScreen',
        action: 'loadGroups',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Load groups when screen comes into focus
   * This ensures new groups appear immediately after creation
   * without requiring manual refresh
   */
  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  /**
   * Handle group edit success - update list and close modal
   * This uses optimistic update: immediately update state with the response from API
   */
  const handleEditSuccess = useCallback((updatedGroup: Group) => {
    // Immediately update the group in the list with the fresh data from API
    // This creates a NEW array reference which triggers FlatList re-render
    setGroups((prevGroups) =>
      prevGroups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g
      )
    );
    
    // Close modal after state update
    setEditModalVisible(false);
    setSelectedGroupForEdit(null);
    
    logger.info('Group updated in list', {
      groupId: updatedGroup.id,
      name: updatedGroup.name,
    });
  }, []);

  /**
   * Render individual group item
   * Memoized to prevent re-renders of unchanged items
   */
  const renderGroupItem = useCallback(
    ({ item }: { item: Group }) => {
      return (
        <View
          style={styles.groupCard}
          testID={`group-item-${item.id}`}
        >
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('ExpenseList', { groupId: item.id, groupName: item.name, groupCurrencyCode: item.currency.code });
            }}
            accessible={true}
            accessibilityLabel={`${item.name}, ${item._count.expenses} expenses`}
            accessibilityRole="button"
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupInfo}>
                <Text 
                  style={styles.groupName}
                  numberOfLines={1}
                  testID={`group-name-${item.id}`}
                >
                  {item.name}
                </Text>
                <Text style={styles.groupMeta}>
                  {item._count.expenses} expenses • {item._count.members} members
                </Text>
              </View>
              <Text style={styles.groupCurrency}>{item.currency.code}</Text>
            </View>

            {item.description && (
              <Text 
                style={styles.groupDescription}
                numberOfLines={2}
                testID={`group-description-${item.id}`}
              >
                {item.description}
              </Text>
            )}

            <View style={styles.groupFooter}>
              <Text style={styles.groupDate}>{formatGroupDate(item.createdAt)}</Text>
              <View>
                <Text style={styles.groupTotal}>
                  {item.totalAmount.toFixed(2)} {item.currency.code}
                </Text>
                <Text style={{ fontSize: 11, color: '#0066cc', textAlign: 'right' }}>
                  Your share: {item.userPersonalTotal.toFixed(2)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Edit button */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setSelectedGroupForEdit(item);
              setEditModalVisible(true);
            }}
          >
            <Text style={styles.editButtonText}>
              ✏️ Edit Group
            </Text>
          </TouchableOpacity>
        </View>
      );
    },
    [navigation]
  );

  /**
   * Render empty state
   */
  const renderEmptyState = useCallback(
    () => (
      <View 
        style={styles.emptyContainer}
        testID="empty-state"
        accessible={true}
        accessibilityLabel="No groups yet. Create one to get started"
      >
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No expense groups yet</Text>
        <Text style={styles.emptySubtext}>
          Create a new group to start tracking expenses
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateGroup')}
          testID="create-group-button"
          accessible={true}
          accessibilityLabel="Create a new group"
          accessibilityRole="button"
        >
          <Text style={styles.createButtonText}>+ Create Group</Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation]
  );

  if (loading) {
    return <LoadingState message="Loading groups..." />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={handleRefresh} />;
  }

  return (
    <View 
      style={styles.container}
      testID="home-screen"
    >
      <View style={styles.header}>
        <Text 
          style={styles.headerTitle}
          testID="header-title"
        >
          Expense Groups
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateGroup')}
          testID="add-group-button"
          accessible={true}
          accessibilityLabel="Create new group"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        extraData={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0066cc']}
            tintColor="#0066cc"
            title="Pull to refresh"
          />
        }
        contentContainerStyle={styles.listContent}
        testID="groups-flat-list"
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        visible={editModalVisible}
        group={selectedGroupForEdit}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedGroupForEdit(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </View>
  );
}

export default memo(HomeScreen);
