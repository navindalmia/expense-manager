/**
 * Add Member Modal
 * 
 * Modal for adding members to a group by email
 * Shows member list and allows adding new members
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
} from 'react-native';
import { addMemberByEmail, removeMemberFromGroup, Group } from '../services/groupService';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';

interface AddMemberModalProps {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onMemberAdded: (updatedGroup: Group) => void;
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  membersList: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginVertical: 12,
  },
  membersTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  memberEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  memberBadge: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  memberBadgeText: {
    fontSize: 11,
    color: '#666',
  },
  shareButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
});

export default function AddMemberModal({
  visible,
  group,
  onClose,
  onMemberAdded,
}: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAddMember = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!group) return;

    setLoading(true);
    setError('');

    try {
      const result = await addMemberByEmail(group.id, email.trim());
      logger.info('Member added successfully', {
        groupId: group.id,
        memberEmail: email,
      });

      // Show success state briefly
      setSuccess(true);
      onMemberAdded(result.data);
      
      // Close modal after 1.5 seconds
      setTimeout(() => {
        setEmail('');
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      logger.error('Failed to add member', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!group) return;

    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the group?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            setLoading(true);
            try {
              const updatedGroup = await removeMemberFromGroup(group.id, memberId);
              onMemberAdded(updatedGroup);
              logger.info('Member removed successfully', {
                groupId: group.id,
                memberId,
              });
            } catch (err) {
              const errorMessage = getErrorMessage(err);
              Alert.alert('Error', `Failed to remove member: ${errorMessage}`);
              logger.error('Failed to remove member', err);
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleShareViaWhatsApp = async () => {
    if (!group) {
      Alert.alert('Error', 'No group selected');
      return;
    }

    try {
      // Create invitation message
      const message = `Hey! 👋 I've invited you to join "${group.name}" in Expense Manager. It's a great app for splitting expenses with friends and family. Check it out!`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        logger.info('WhatsApp share opened', { groupId: group.id });
      } else {
        Alert.alert('Error', 'WhatsApp is not installed on this device');
        logger.warn('WhatsApp not available');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open WhatsApp');
      logger.error('WhatsApp share failed', err);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add Members</Text>
          <Text style={styles.subtitle}>Invite people to join "{group?.name}"</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="member@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(''); // Clear error when user types
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !success}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddMember}
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            
            {success && (
              <View style={{ 
                backgroundColor: '#d4edda', 
                padding: 10, 
                borderRadius: 6, 
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: '#28a745'
              }}>
                <Text style={{ color: '#155724', fontWeight: '600', fontSize: 13 }}>
                  ✓ Member added successfully!
                </Text>
              </View>
            )}
            
            {error && (
              <View style={{ 
                backgroundColor: '#f8d7da', 
                padding: 10, 
                borderRadius: 6, 
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: '#f5222d'
              }}>
                <Text style={{ color: '#721c24', fontWeight: '600', fontSize: 13 }}>
                  ✕ {error}
                </Text>
              </View>
            )}

            {/* Members List */}
            {group && group.members && group.members.length > 0 && (
              <View style={styles.membersList}>
                <Text style={styles.membersTitle}>
                  Group Members ({group.members.length})
                </Text>
                {group.members.map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(member.id, member.name)}
                      disabled={loading}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: '#dc3545', fontSize: 12, fontWeight: '600' }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareViaWhatsApp}
            >
              <Text style={styles.shareButtonText}>📱 Share via WhatsApp</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
