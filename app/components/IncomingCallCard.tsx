/**
 * Incoming Call Card Component
 * 
 * WhatsApp-style UI for receiver
 * Shows: "<CallerName> invited you" with Accept/Decline invitation buttons
 * Layout matches OutgoingCallCard: Profile pic (left) | Details (middle) | (right side empty or call icon)
 * 
 * Visibility: callState.status === "ringing" (for receiver only)
 */

import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../redux/store';
import callFlowService from '../utils/callFlowService';
import { resetInvitationState } from '../redux/slices/callSlice';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

/**
 * INCOMING INVITATION MODAL (INVITATION-FIRST ARCHITECTURE)
 * 
 * Shows when receiver receives invitation (invitation status = "incoming")
 * Invitation ≠ Call - Call starts only after invitation acceptance
 */
const IncomingCallCard: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const invitation = useSelector((state: RootState) => state.call.invitation);
  const callState = useSelector((state: RootState) => state.call.activeCall);

  // COMPONENT MOUNT/UPDATE LOG - Always log to verify component is rendering
  useEffect(() => {
    console.log('🔄 [IncomingCallCard] Component rendered/updated', {
      invitationStatus: invitation.status,
      hasRemoteUserId: !!invitation.remoteUserId,
      hasRemoteUserName: !!invitation.remoteUserName
    });
  });

  // Show card when invitation status is "incoming" (receiver side)
  const visible = invitation.status === 'incoming' &&
                  invitation.remoteUserId && 
                  invitation.remoteUserName;
  
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

  // Get caller profile picture from invitation data
  const callerProfilePic = invitation.remoteUserProfilePic;
  
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

  // Navigate to CallScreen when call starts (after invitation acceptance)
  useEffect(() => {
    // Navigate to CallScreen when call state becomes CONNECTING (after call:start event)
    if (callState.status === 'connecting' && callState.remoteUserId) {
      console.log('✅ [IncomingInvitationModal] Call started, navigating to CallScreen');
      const currentCall = callFlowService.getCurrentCall();
      
      if (currentCall) {
        navigation.navigate('CallScreen' as never, {
          id: callState.remoteUserId,
          name: callState.remoteUserName,
          isVideoCall: callState.isVideoEnabled || false,
          callId: currentCall.callId || '',
          callType: currentCall.callType,
          isReceiver: true,
        } as never);
      }
    }
  }, [callState.status, callState.remoteUserId, navigation]);

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

  // Debug: Log before returning null
  if (!visible) {
    console.log('❌ [IncomingCallCard] Not rendering - visible is false');
    return null;
  }
  
  console.log('✅ [IncomingCallCard] RENDERING MODAL - visible is true');

  // Placeholder user data (can be enhanced to fetch from backend or store in Redux)
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
      onRequestClose={handleDecline}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Title */}
          <Text style={styles.title}>{invitation.remoteUserName} invited you</Text>

          {/* Main Content: Profile Pic | Details | (Empty or call icon) */}
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

            {/* Call Icon (Right) - indicates incoming call */}
            <View style={styles.iconSection}>
              <View style={styles.callIconContainer}>
                <Icon name="call" size={24} color="#6366F1" />
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
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366F1',
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
