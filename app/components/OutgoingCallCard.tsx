/**
 * Outgoing Call Card Component
 * 
 * WhatsApp-style UI for caller (sender)
 * Shows: "You invited <UserName>" with countdown timer and Cancel button
 * Layout matches screenshot: Profile pic (left) | Details (middle) | Timer (right)
 * 
 * Visibility: callState.status === "calling" || "ringing" (for caller only)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../redux/store';
import callFlowService from '../utils/callFlowService';
import { resetInvitationState } from '../redux/slices/callSlice';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const INVITATION_TIMEOUT_SECONDS = 30; // 30 seconds timeout for invitations

/**
 * OUTGOING INVITATION MODAL (INVITATION-FIRST ARCHITECTURE)
 * 
 * Shows when caller sends invitation (invitation status = "inviting")
 * Invitation ≠ Call - Call starts only after invitation acceptance
 */
const OutgoingCallCard: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const invitation = useSelector((state: RootState) => state.call.invitation);
  const callState = useSelector((state: RootState) => state.call.activeCall); // Needed for navigation after call starts
  const [timeRemaining, setTimeRemaining] = useState(INVITATION_TIMEOUT_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // COMPONENT MOUNT/UPDATE LOG - Always log to verify component is rendering
  useEffect(() => {
    console.log('🔄 [OutgoingCallCard] Component rendered/updated', {
      invitationStatus: invitation.status,
      hasRemoteUserId: !!invitation.remoteUserId,
      hasRemoteUserName: !!invitation.remoteUserName
    });
  });

  // Show card when invitation status is "inviting" (caller side)
  const visible = invitation.status === 'inviting' &&
                  invitation.remoteUserId && 
                  invitation.remoteUserName;
  
  // Debug logging - ALWAYS log to help diagnose why modal isn't showing
  useEffect(() => {
    console.log('🔍 [OutgoingInvitationModal] Render check:', {
      invitationStatus: invitation.status,
      remoteUserId: invitation.remoteUserId,
      remoteUserName: invitation.remoteUserName,
      inviteId: invitation.inviteId,
      expiresAt: invitation.expiresAt,
      hasRemoteUserId: !!invitation.remoteUserId,
      hasRemoteUserName: !!invitation.remoteUserName,
      visible,
      willRender: visible ? 'YES ✅' : 'NO ❌',
      fullInvitationState: JSON.stringify(invitation, null, 2)
    });
  }, [invitation, visible]);

  // Format timer as M:SS (e.g., "1:56")
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  // Reset timer when invitation starts
  useEffect(() => {
    if (visible && invitation.expiresAt) {
      const expiresAt = invitation.expiresAt;
      startTimeRef.current = Date.now();
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }
  }, [visible, invitation.expiresAt]);

  // Navigate to CallScreen when call starts (after invitation acceptance)
  useEffect(() => {
    if (callState.status === 'connecting' && callState.remoteUserId) {
      console.log('✅ [OutgoingCallCard] Receiver accepted call, navigating to CallScreen');
      const currentCall = callFlowService.getCurrentCall();
      
      if (currentCall) {
        navigation.navigate('CallScreen' as never, {
          id: callState.remoteUserId,
          name: callState.remoteUserName,
          isVideoCall: callState.isVideoEnabled || false,
          callId: currentCall.callId || '',
          callType: currentCall.callType,
          isReceiver: false,
        } as never);
      }
    }
  }, [callState.status, callState.remoteUserId, navigation]);

      // Countdown timer
      useEffect(() => {
        if (!visible || !invitation.expiresAt) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        timerRef.current = setInterval(() => {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((invitation.expiresAt! - now) / 1000));
          setTimeRemaining(remaining);

          // Auto-close on timeout (invitation will expire on backend)
          if (remaining === 0) {
            handleCancel();
          }
        }, 1000);

        return () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        };
      }, [visible, invitation.expiresAt]);

      // Handle cancel button
      const handleCancel = () => {
        const currentInvitation = callFlowService.getCurrentInvitation();
        if (currentInvitation?.inviteId) {
          console.log('🚫 [OutgoingInvitationModal] Cancelling invitation:', currentInvitation.inviteId);
          callFlowService.cancelInvitation(currentInvitation.inviteId);
        } else if (invitation.inviteId) {
          console.log('🚫 [OutgoingInvitationModal] Cancelling invitation:', invitation.inviteId);
          callFlowService.cancelInvitation(invitation.inviteId);
        }

        // Reset invitation state
        dispatch(resetInvitationState());
      };

  // Debug: Log before returning null
  if (!visible) {
    console.log('❌ [OutgoingCallCard] Not rendering - visible is false');
    return null;
  }
  
  console.log('✅ [OutgoingCallCard] RENDERING MODAL - visible is true');

  // Placeholder user data (can be enhanced to fetch from backend or store in Redux)
  const userProfilePic = undefined; // Will be added later
  const userRating = undefined; // Will be added later
  const userGender = undefined; // Will be added later
  const userAge = undefined; // Will be added later
  const userCountry = undefined; // Will be added later
  const userTalks = undefined; // Will be added later

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Title */}
          <Text style={styles.title}>You invited {invitation.remoteUserName}</Text>

          {/* Main Content: Profile Pic | Details | Timer */}
          <View style={styles.contentRow}>
            {/* Profile Picture (Left) */}
            <View style={styles.profileSection}>
              {userProfilePic ? (
                <Image 
                  source={{ uri: userProfilePic }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Icon name="person" size={50} color="#666" />
                </View>
              )}
            </View>

            {/* User Details (Middle) */}
            <View style={styles.detailsSection}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{invitation.remoteUserName}</Text>
                {/* Badges/icons can be added here (e.g., umbrella icons) */}
              </View>
              
              {/* Rating, Gender, Age */}
              {(userRating || userGender || userAge) && (
                <Text style={styles.userDetails}>
                  {userRating && `👍 ${userRating}%`}
                  {userRating && userGender && ' • '}
                  {userGender}
                  {userAge && ` • ${userAge} years`}
                </Text>
              )}
              
              {/* Country, Talks */}
              {(userCountry || userTalks) && (
                <Text style={styles.userDetails}>
                  {userCountry}
                  {userTalks && ` • ${userTalks} talks`}
                </Text>
              )}
            </View>

            {/* Timer (Right) - Circular Progress */}
            <View style={styles.timerSection}>
              <View style={styles.timerContainer}>
                {/* Circular progress background */}
                <View style={styles.timerCircleBackground} />
                {/* Timer text */}
                <Text style={styles.timerText}>{formatTimer(timeRemaining)}</Text>
              </View>
            </View>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel invitation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    textAlign: 'left',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileSection: {
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsSection: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userDetails: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366F1',
  },
  timerCircleBackground: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB', // Light gray matching screenshot
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OutgoingCallCard;
