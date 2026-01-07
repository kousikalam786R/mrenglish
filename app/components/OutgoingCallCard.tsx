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
  Animated,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import callFlowService from '../utils/callFlowService';
import { resetInvitationState } from '../redux/slices/callSlice';
import callService, { CallStatus } from '../utils/callService';
import Icon from 'react-native-vector-icons/Ionicons';
import NavigationService from '../navigation/NavigationService';
import socketService from '../utils/socketService';

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
  const invitation = useSelector((state: RootState) => state.call.invitation);
  const callState = useSelector((state: RootState) => state.call.activeCall); // Needed for navigation after call starts
  const [timeRemaining, setTimeRemaining] = useState(INVITATION_TIMEOUT_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [pulseAnim] = useState(new Animated.Value(1));

  // Get receiver profile picture from invitation data
  const receiverProfilePic = invitation.remoteUserProfilePic;

  // COMPONENT MOUNT/UPDATE LOG - Always log to verify component is rendering
  useEffect(() => {
    console.log('🔄 [OutgoingCallCard] Component rendered/updated', {
      invitationStatus: invitation.status,
      hasRemoteUserId: !!invitation.remoteUserId,
      hasRemoteUserName: !!invitation.remoteUserName
    });
  });

  // Show card when invitation status is "inviting" (caller side)
  const visible = !!(invitation.status === 'inviting' &&
                  invitation.remoteUserId && 
                  invitation.remoteUserName);
  
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

  // Pulse animation for avatar
  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);


  // Reset timer when invitation starts
  useEffect(() => {
    if (visible && invitation.expiresAt) {
      const expiresAt = invitation.expiresAt;
      startTimeRef.current = Date.now();
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }
  }, [visible, invitation.expiresAt]);

  // Listen for invitation declined event (backup listener in component)
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('⚠️ [OutgoingCallCard] Socket not available for declined listener');
      return;
    }

    console.log('✅ [OutgoingCallCard] Setting up call:invite:declined listener');
    const handleDeclined = (data: { inviteId: string; receiverId?: string }) => {
      console.log('❌ [OutgoingCallCard] call:invite:declined received in component:', data);
      console.log('   Current invitation inviteId:', invitation.inviteId);
      console.log('   Event inviteId:', data.inviteId);
      
      // Check if this decline is for the current invitation
      if (invitation.inviteId === data.inviteId || invitation.status === 'inviting') {
        console.log('✅ [OutgoingCallCard] This decline is for our current invitation, showing alert');
        
        // Close the modal first
        dispatch(resetInvitationState());
        
        // Show alert after a brief delay to ensure modal closes
        setTimeout(() => {
          console.log('📱 [OutgoingCallCard] Showing Alert for declined invitation');
          Alert.alert(
            'Call Declined',
            'The person you called declined your invitation.',
            [{ text: 'OK' }],
            { cancelable: true }
          );
        }, 300);
      } else {
        console.log('ℹ️ [OutgoingCallCard] Decline event is for a different invitation, ignoring');
      }
    };

    socket.on('call:invite:declined', handleDeclined);
    console.log('✅ [OutgoingCallCard] call:invite:declined listener registered');

    return () => {
      console.log('🧹 [OutgoingCallCard] Cleaning up call:invite:declined listener');
      socket.off('call:invite:declined', handleDeclined);
    };
  }, [invitation.inviteId, invitation.status, dispatch]);

  // ✅ REQUIREMENT 3: Navigate to CallScreen ONLY when CONNECTED
  // Listen for navigation event from callFlowService (emitted when CONNECTED)
  useEffect(() => {
    const handleNavigateToCallScreen = (data: any) => {
      console.log('✅ [OutgoingCallCard] call:navigate-to-callscreen received (CONNECTED state)');
      console.log('   Navigating to CallScreen');
      
      // Navigate to CallScreen
      NavigationService.navigate('CallScreen', {
        id: data.remoteUserId,
        name: data.remoteUserName || invitation.remoteUserName || 'User',
        isVideoCall: data.isVideoCall || false,
        callId: data.callId || '',
        callType: data.callType || 'direct_call',
        isReceiver: false,
      });
      
      // Close invitation modal after navigation
      dispatch(resetInvitationState());
    };

    callFlowService.on('call:navigate-to-callscreen', handleNavigateToCallScreen);

    return () => {
      callFlowService.off('call:navigate-to-callscreen', handleNavigateToCallScreen);
    };
  }, []);

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
      console.log('🚫 [OutgoingCallCard] Cancelling invitation:', currentInvitation.inviteId);
      callFlowService.cancelInvitation(currentInvitation.inviteId);
    } else if (invitation.inviteId) {
      console.log('🚫 [OutgoingCallCard] Cancelling invitation:', invitation.inviteId);
      callFlowService.cancelInvitation(invitation.inviteId);
    }

    // Reset invitation state
    dispatch(resetInvitationState());
  };

  // Placeholder user data (can be enhanced to fetch from backend or store in Redux)
  const userRating = undefined; // Will be added later
  const userGender = undefined; // Will be added later
  const userAge = undefined; // Will be added later
  const userCountry = undefined; // Will be added later
  const userTalks = undefined; // Will be added later

  // Always render Modal to maintain hooks order - control visibility with visible prop
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Title */}
          <Text style={styles.title}>You invited {invitation.remoteUserName}</Text>

          {/* Main Content: Profile Pic | Details | Timer */}
          <View style={styles.contentRow}>
            {/* Profile Picture (Left) */}
            <View style={styles.profileSection}>
              <Animated.View
                style={[
                  styles.avatarContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                {receiverProfilePic ? (
                  <Image 
                    source={{ uri: receiverProfilePic }} 
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="person" size={50} color="#666" />
                  </View>
                )}
              </Animated.View>
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
    zIndex: 9999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  avatarContainer: {
    // Container for animated avatar
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
