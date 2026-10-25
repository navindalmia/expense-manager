/**
 * Add Member Modal
 * 
 * Modal for adding members to a group by email
 * Shows member list and allows adding new members
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { confirmThenProceed } from '../utils/crossPlatformAlert';
import { getAddMemberStrings } from '../i18n/addMemberStrings';

import { KeyboardInsetView } from '../hooks/useKeyboardInset';

interface AddMemberModalProps {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onMemberAdded: (updatedGroup: Group) => void;
}

// Ignore a Share press this soon after an Add press finished (stray second tap, issue #144).
export const SHARE_AFTER_ADD_GUARD_MS = 600;

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
    flexShrink: 1,
  },
  membersScroll: {
    maxHeight: 220,
    flexShrink: 1,
  },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
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
    marginTop: 0,
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
    marginTop: 12,
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
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddFinishedAtRef = useRef(0);
  const strings = getAddMemberStrings();

  // Clear any pending success timer if the modal unmounts or is closed early,
  // so onMemberAdded can't fire a second time after the user has navigated away
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    onClose();
  };

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

      // Show success state briefly before notifying parent, so the
      // confirmation is visible instead of the modal disappearing instantly
      setSuccess(true);

      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        setEmail('');
        setSuccess(false);
        onMemberAdded(result.data);
      }, 1500);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      logger.error('Failed to add member', err);
    } finally {
      lastAddFinishedAtRef.current = Date.now();
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!group) return;

    confirmThenProceed(
      'Remove Member',
      `Remove ${memberName} from the group?`,
      'Remove',
      async () => {
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
      }
    );
  };

  const handleShareViaWhatsApp = async () => {
    // Guard against a stray tap that was meant for Add (issue #144)
    if (loading || Date.now() - lastAddFinishedAtRef.current < SHARE_AFTER_ADD_GUARD_MS) return;
    if (!group) {
      Alert.alert('Error', 'No group selected');
      return;
    }

    const text = encodeURIComponent(strings.inviteMessage(group.name));
    // No canOpenURL gate: it returns false on Android 11+ without a <queries> entry even when installed.
    for (const url of [`whatsapp://send?text=${text}`, `https://wa.me/?text=${text}`]) {
      try {
        await Linking.openURL(url);
        logger.info('WhatsApp share opened', { groupId: group.id });
        return;
      } catch (err) {
        logger.warn('WhatsApp share attempt failed', { url: url.split('?')[0], err });
      }
    }
    Alert.alert(strings.shareFailedTitle, strings.shareFailedBody);
  };

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardInsetView style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add Members</Text>
          <Text style={styles.subtitle}>Invite people to join "{group?.name}"</Text>

          {/* Fixed section: email input + Add never scroll */}
          <View testID="add-member-input-section">
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
                testID="add-member-email-input"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddMember}
                disabled={loading || success || !email.trim()}
                testID="add-member-add-button"
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

          </View>

          {/* Members list scrolls on its own, bounded */}
          {group && group.members && group.members.length > 0 && (
              <View style={styles.membersList}>
                <Text style={styles.membersTitle}>
                  Group Members ({group.members.length})
                </Text>
                <ScrollView
                  style={styles.membersScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  testID="add-member-members-scroll"
                >
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
                      testID={`add-member-remove-button-${member.id}`}
                    >
                      <Text style={{ color: '#dc3545', fontSize: 12, fontWeight: '600' }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                </ScrollView>
              </View>
            )}

          {/* Fixed footer, clearly separated from Add */}
          <View style={styles.footer} testID="add-member-footer">
            <TouchableOpacity
              style={[styles.shareButton, loading && { opacity: 0.5 }]}
              onPress={handleShareViaWhatsApp}
              disabled={loading}
              testID="add-member-whatsapp-share-button"
            >
              <Text style={styles.shareButtonText}>📱 {strings.shareViaWhatsApp}</Text>
            </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            testID="add-member-close-button"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          </View>
        </View>
      </KeyboardInsetView>
    </Modal>
  );
}
