/**
 * Incoming Call Modal Component
 * 
 * Displays incoming call UI with Accept/Decline buttons
 * Only shown for direct_call type calls
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
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../redux/store';
import { CallStatus } from '../utils/callService';
import callFlowService from '../utils/callFlowService';
import { resetCallState, setCallState } from '../redux/slices/callSlice';

const { width, height } = Dimensions.get('window');

/**
 * IncomingCallModal Component
 * 
 * FIXED: Now reads from Redux store instead of props
 * Shows Accept/Decline modal when callState.status === RINGING
 * Redux store is the single source of truth
 */
const IncomingCallModal: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  // Read call state from Redux (single source of truth)
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Show modal when status is RINGING
  const visible = callState.status === CallStatus.RINGING;
  
  const [pulseAnim] = useState(new Animated.Value(1));
  const [ringAnim] = useState(new Animated.Value(0));

  // Handle Accept button press
  const handleAccept = () => {
    console.log('✅ [IncomingCallModal] Accept button pressed');
    const incomingCall = callFlowService.getIncomingCall();
    if (!incomingCall) {
      console.error('❌ [IncomingCallModal] No incoming call data found');
      return;
    }
    
    console.log('   Accepting call:', incomingCall.callId);
    console.log('   Setting call state to CONNECTING');
    
    // Update Redux state to CONNECTING (modal will hide)
    dispatch(setCallState({
      ...callState,
      status: CallStatus.CONNECTING
    }));
    
    // Accept invitation (this emits call:invite:accept socket event to server)
    // Navigation to CallScreen happens automatically when CONNECTED
    // (handled by callFlowService 'call:navigate-to-callscreen' event)
    const inviteId = incomingCall.inviteId || incomingCall.callId;
    callFlowService.acceptInvitation(inviteId);
  };

  // Handle Decline button press
  const handleDecline = () => {
    console.log('❌ [IncomingCallModal] Decline button pressed');
    const incomingCall = callFlowService.getIncomingCall();
    if (!incomingCall) {
      console.error('❌ [IncomingCallModal] No incoming call data found');
      // Reset state anyway
      dispatch(resetCallState());
      return;
    }
    
    console.log('   Declining call:', incomingCall.callId);
    
    // Decline invitation (this emits call:invite:decline socket event)
    const inviteId = incomingCall.inviteId || incomingCall.callId;
    callFlowService.declineInvitation(inviteId);
    
    // Reset Redux call state to IDLE
    dispatch(resetCallState());
  };

  useEffect(() => {
    if (visible) {
      console.log('✅ [IncomingCallModal] Modal mounted/visible');
      console.log('   Call State:', callState.status);
      console.log('   Remote User:', callState.remoteUserId, callState.remoteUserName);
    }
  }, [visible, callState.status]);

  useEffect(() => {
    if (visible) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start ring animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      ringAnim.stopAnimation();
    }
  }, [visible]);

  // Don't render if not ringing or missing required data
  if (!visible || !callState.remoteUserId || !callState.remoteUserName) {
    return null;
  }

  const rotateInterpolate = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDecline}
    >
      <LinearGradient
        colors={['#1E0071', '#00BFFF']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          {/* Caller Info */}
          <View style={styles.callerInfo}>
            <Animated.View
              style={[
                styles.avatarContainer,
                {
                  transform: [
                    { scale: pulseAnim },
                    { rotate: rotateInterpolate },
                  ],
                },
              ]}
            >
              {/* Profile pic - can be added to Redux state if needed */}
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={60} color="#fff" />
              </View>
            </Animated.View>

            <Text style={styles.callerName}>{callState.remoteUserName}</Text>
            <Text style={styles.callType}>
              {callState.isVideoEnabled ? 'Video Call' : 'Audio Call'}
            </Text>
          </View>

          {/* Call Status */}
          <View style={styles.statusContainer}>
            <Animated.View
              style={[
                styles.ringIndicator,
                {
                  opacity: ringAnim,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <Text style={styles.statusText}>Incoming Call</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Decline Button */}
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Icon name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Icon name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.9,
    alignItems: 'center',
    paddingVertical: 40,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatar: {
    width: 114,
    height: 114,
    borderRadius: 57,
  },
  avatarPlaceholder: {
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  topic: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  ringIndicator: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
  },
  statusText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 100,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
    transform: [{ rotate: '0deg' }],
  },
});

export default IncomingCallModal;
