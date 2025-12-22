/**
 * Incoming Call Card Component
 * 
 * WhatsApp-style UI for receiver
 * Shows: "<CallerName> invited you" with Accept/Decline invitation buttons
 * Layout matches OutgoingCallCard: Profile pic (left) | Details (middle) | (right side empty or call icon)
 * 
 * Visibility: callState.status === "ringing" (for receiver only)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import callFlowService from '../utils/callFlowService';
import { resetInvitationState, setInvitationState } from '../redux/slices/callSlice';
import { CallStatus } from '../utils/callService';
import Icon from 'react-native-vector-icons/Ionicons';
import NavigationService from '../navigation/NavigationService';

const { width } = Dimensions.get('window');

/**
 * INCOMING INVITATION MODAL (INVITATION-FIRST ARCHITECTURE)
 * 
 * Shows when receiver receives invitation (invitation status = "incoming")
 * Invitation ≠ Call - Call starts only after invitation acceptance
 */
const IncomingCallCard: React.FC = () => {
  console.log('🔵 [IncomingCallCard] Component function called');
  
  const dispatch = useDispatch();
  const invitation = useSelector((state: RootState) => state.call.invitation);
  const callState = useSelector((state: RootState) => state.call.activeCall);
  const currentUserId = useSelector((state: RootState) => state.auth.userId);
  
  console.log('🔵 [IncomingCallCard] Redux selectors executed:', {
    invitationStatus: invitation.status,
    hasRemoteUserId: !!invitation.remoteUserId,
    hasRemoteUserName: !!invitation.remoteUserName,
    currentUserId: currentUserId,
    remoteUserId: invitation.remoteUserId
  });

  // COMPONENT MOUNT/UPDATE LOG - Always log to verify component is rendering
  useEffect(() => {
    console.log('🔄 [IncomingCallCard] ============================================');
    console.log('🔄 [IncomingCallCard] Component rendered/updated');
    console.log('🔄 [IncomingCallCard] ============================================');
    console.log('🔄 [IncomingCallCard] Full invitation state:', JSON.stringify(invitation, null, 2));
    console.log('🔄 [IncomingCallCard] invitation.status:', invitation.status);
    console.log('🔄 [IncomingCallCard] invitation.remoteUserId:', invitation.remoteUserId);
    console.log('🔄 [IncomingCallCard] invitation.remoteUserName:', invitation.remoteUserName);
    console.log('🔄 [IncomingCallCard] invitation.inviteId:', invitation.inviteId);
    console.log('🔄 [IncomingCallCard] visible will be:', invitation.status === 'incoming' && !!invitation.remoteUserId && !!invitation.remoteUserName);
    
    // FIX: Only fix status if we're likely the RECEIVER (not the sender)
    // The receiver should have status 'incoming', not 'inviting'
    // Key indicator: If we have inviteId AND remoteUserProfilePic (set by handleIncomingInvitation),
    // then we're likely the receiver who received the invitation but status wasn't set correctly
    const hasReceiverIndicators = invitation.inviteId && 
                                   invitation.remoteUserId && 
                                   invitation.remoteUserProfilePic && // Only set when receiving invitation
                                   currentUserId && 
                                   invitation.remoteUserId !== currentUserId;
    
    // Only auto-fix if we have strong indicators we're the receiver
    if (invitation.status === 'inviting' && hasReceiverIndicators) {
      console.warn('⚠️ [IncomingCallCard] BUG DETECTED: Receiver has status "inviting" but should be "incoming"');
      console.warn('   Indicators: has inviteId, remoteUserProfilePic, and remoteUserId != currentUserId');
      console.warn('   Current User ID:', currentUserId);
      console.warn('   Remote User ID:', invitation.remoteUserId);
      console.warn('   This indicates handleIncomingInvitation was not called or state was overwritten');
      console.warn('   Attempting to fix by updating status to "incoming"...');
      
      // Fix the status by dispatching the correct state
      dispatch(setInvitationState({ status: 'incoming' }));
      console.log('✅ [IncomingCallCard] Status corrected from "inviting" to "incoming"');
    } else if (invitation.status === 'inviting' && currentUserId) {
      // Sender case - this is normal, don't change status
      console.log('ℹ️ [IncomingCallCard] Status is "inviting" - this is the SENDER side');
      console.log('   OutgoingCallCard should be showing, not IncomingCallCard');
      console.log('   (IncomingCallCard will NOT render because visible = false)');
    }
  }, [invitation.status, invitation.remoteUserId, invitation.inviteId, invitation.remoteUserProfilePic, currentUserId, dispatch]);

  // Show card when invitation status is "incoming" (receiver side)
  const visible = !!(invitation.status === 'incoming' &&
                  invitation.remoteUserId && 
                  invitation.remoteUserName);
  
  // Debug logging - ALWAYS log to help diagnose why modal isn't showing
  useEffect(() => {
    console.log('🔍 [IncomingInvitationModal] Render check:', {
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
  
  const [pulseAnim] = useState(new Animated.Value(1));
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds default
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const INVITATION_TIMEOUT_SECONDS = 30; // 30 seconds timeout for invitations

  // Get caller profile picture from invitation data
  const callerProfilePic = invitation.remoteUserProfilePic;

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
      setTimeRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }
  }, [visible, invitation.expiresAt]);

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

      // Auto-reset on timeout (invitation will expire on backend)
      if (remaining === 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, invitation.expiresAt]);
  
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

  // Navigate to CallScreen when call starts (after invitation acceptance via call:start event)
  useEffect(() => {
    // Navigate to CallScreen when call state becomes CONNECTING (after call:start event)
    // This happens after receiver accepts invitation and server emits call:start
    if (callState.status === CallStatus.CONNECTING && callState.remoteUserId) {
      console.log('✅ [IncomingCallCard] Call started (call:start received), navigating to CallScreen');
      console.log('   Call state:', callState);
      const currentCall = callFlowService.getCurrentCall();
      
      if (currentCall) {
        console.log('   Navigating to CallScreen with call session:', currentCall);
        NavigationService.navigate('CallScreen', {
          id: callState.remoteUserId,
          name: callState.remoteUserName || invitation.remoteUserName || 'User',
          isVideoCall: callState.isVideoEnabled || invitation.metadata?.isVideo || false,
          callId: currentCall.callId || '',
          callType: currentCall.callType,
          isReceiver: true,
        });
        
        // Close invitation modal after navigation
        dispatch(resetInvitationState());
      } else {
        console.warn('⚠️ [IncomingCallCard] No current call found, cannot navigate');
      }
    }
  }, [callState.status, callState.remoteUserId]);

  // Handle Accept button
  const handleAccept = () => {
    console.log('✅ [IncomingInvitationModal] Accept invitation button pressed');
    const currentInvitation = callFlowService.getCurrentInvitation();
    if (!currentInvitation?.inviteId && !invitation.inviteId) {
      console.error('❌ [IncomingInvitationModal] No invitation found');
      return;
    }
    
    const inviteId = currentInvitation?.inviteId || invitation.inviteId;
    console.log('   Accepting invitation:', inviteId);
    
    // Accept invitation (emits call:invite:accept socket event)
    // Call will start after server processes acceptance (call:start event)
    callFlowService.acceptInvitation(inviteId!);
  };

  // Handle Decline button
  const handleDecline = () => {
    console.log('❌ [IncomingInvitationModal] Decline invitation button pressed');
    const currentInvitation = callFlowService.getCurrentInvitation();
    if (!currentInvitation?.inviteId && !invitation.inviteId) {
      console.error('❌ [IncomingInvitationModal] No invitation found');
      dispatch(resetInvitationState());
      return;
    }
    
    const inviteId = currentInvitation?.inviteId || invitation.inviteId;
    console.log('   Declining invitation:', inviteId);
    
    // Decline invitation (emits call:invite:decline socket event)
    callFlowService.declineInvitation(inviteId!);
    
    // Reset invitation state
    dispatch(resetInvitationState());
  };

  // Debug: Log Modal render (MUST be before conditional return - Rules of Hooks)
  useEffect(() => {
    if (visible) {
      console.log('🎯 [IncomingCallCard] Modal is VISIBLE - should be showing on screen');
      console.log('   Modal props: visible=true, transparent=true, statusBarTranslucent=true');
    } else {
      console.log('❌ [IncomingCallCard] Modal is HIDDEN - visible is false');
    }
  }, [visible]);

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
        onRequestClose={handleDecline}
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        onShow={() => console.log('🟢 [IncomingCallCard] Modal onShow called - Modal is visible!')}
        onDismiss={() => console.log('🔴 [IncomingCallCard] Modal onDismiss called')}
      >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Title */}
          <Text style={styles.title}>{invitation.remoteUserName} invited you</Text>

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
                {callerProfilePic ? (
                  <Image 
                    source={{ uri: callerProfilePic }} 
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

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Decline Button */}
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.declineButtonText}>Decline invitation</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Accept invitation</Text>
            </TouchableOpacity>
          </View>
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Light gray matching OutgoingCallCard cancel button
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759', // Green for accept
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default IncomingCallCard;
