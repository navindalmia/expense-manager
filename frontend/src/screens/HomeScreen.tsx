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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface Group {
  id: number;
  name: string;
  description?: string;
  currency: string;
  _count: {
    expenses: number;
    members: number;
  };
  createdAt: string;
}

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
});

/**
 * Home Screen showing all groups/lists
 */
function HomeScreen({ navigation }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all groups from backend
   */
  const loadGroups = async () => {
    try {
      setError(null);
      // TODO: Call actual API when ready
      // const response = await fetch('http://localhost:4000/api/groups');
      // const data = await response.json();
      // setGroups(data.data);
      
      // For now, show empty state
      setGroups([]);
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
  };

  /**
   * Load groups on mount
   */
  useEffect(() => {
    loadGroups();
  }, []);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  /**
   * Render individual group item
   */
  const renderGroupItem = useCallback(
    ({ item }: { item: Group }) => {
      const monthYear = new Date(item.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });

      return (
        <TouchableOpacity
          style={styles.groupCard}
          onPress={() => {
            navigation.navigate('ExpenseList', { groupId: item.id });
          }}
          testID={`group-item-${item.id}`}
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
            <Text style={styles.groupCurrency}>{item.currency}</Text>
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

          <Text style={styles.groupDate}>{monthYear}</Text>
        </TouchableOpacity>
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
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </View>
  );
}

export default memo(HomeScreen);
