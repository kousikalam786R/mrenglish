/**
 * CallScreen Component
 * 
 * STRICT SEPARATION OF RESPONSIBILITIES:
 * - Renders ONLY when callState.status === CONNECTED
 * - Pure UI component: timer, mute, speaker, end call
 * - NO WebRTC logic (handled by callService)
 * - NO invitation handling (handled by modals)
 * - NO pre-connection states (handled by modals)
 * 
 * State Flow:
 * IDLE → INVITING (OutgoingCallCard) → RINGING (IncomingCallCard) 
 * → CONNECTING (ConnectingModal) → CONNECTED (CallScreen) → ENDED
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CallRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch, store } from '../redux/store';
import { resetCallState } from '../redux/slices/callSlice';
//import callService, { CallStatus } from '../utils/callService';
import callService from '../utils/callService';
import { CallStatus } from '../utils/callService';

import { 
  toggleAudioMute
} from '../redux/thunks/callThunks';
import callFlowService from '../utils/callFlowService';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';

const CallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CallScreenRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  
  // Safely extract parameters with defaults
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const avatar = safeParam(route, 'avatar', "https://randomuser.me/api/portraits/men/32.jpg");
  const callId = safeParam(route, 'callId', ''); // Extract callId from route params
  
  // Get call state from Redux
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Local state
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  
  // Refs for tracking timers
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ REQUIREMENT 1: CallScreen renders ONLY when CONNECTED
  // If not connected, don't render (navigation should prevent this, but safety check)
  useEffect(() => {
    if (callState.status !== CallStatus.CONNECTED) {
      console.warn('⚠️ [CallScreen] Attempted to render when status is not CONNECTED:', callState.status);
      console.warn('   Navigation should only occur when CONNECTED. Redirecting...');
      // Navigate back if somehow we got here without being connected
      navigation.goBack();
      return;
    }
  }, [callState.status, navigation]);
  
  // Handle back button - prevent navigation but don't end call
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Just prevent navigation, don't end the call
        // User must use the "End Call" button to end the call
        return true;
      };
      
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => subscription.remove();
    }, [])
  );

  // Initialize call timer when component mounts (only if CONNECTED)
  // useEffect(() => {
  //   if (callState.status !== CallStatus.CONNECTED) {
  //     return;
  //   }

  //   // Get call start time from callService or Redux
  //   // const currentCallState = callService.getCallState();
  //   // const startTime = callState.callStartTime || currentCallState.callStartTime || Date.now();
  //   const startTime = callState.callStartTime || Date.now();

  //   // Calculate initial duration
  //   const initialDuration = Math.floor((Date.now() - startTime) / 1000);
  //   setCallDuration(Math.max(0, initialDuration));
    
  //   // Clear any existing timer
  //   if (durationTimerRef.current) {
  //     clearInterval(durationTimerRef.current);
  //   }
    
  //   // Start timer that updates every second
  //   durationTimerRef.current = setInterval(() => {
  //     const currentDuration = Math.floor((Date.now() - startTime) / 1000);
  //     setCallDuration(Math.max(0, currentDuration));
  //   }, 1000);
    
  //   return () => {
  //     if (durationTimerRef.current) {
  //       clearInterval(durationTimerRef.current);
  //       durationTimerRef.current = null;
  //     }
  //   };
  // }, [callState.status, callState.callStartTime]);

  useEffect(() => {
    if (callState.status !== CallStatus.CONNECTED || !callState.callStartTime) {
      return;
    }
  
    const startTime = callState.callStartTime;
  
    const update = () => {
      setCallDuration(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };
  
    update();
    durationTimerRef.current = setInterval(update, 1000);
  
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState.status, callState.callStartTime]);
  

  // Listen for call ended state to navigate back
  useEffect(() => {
    if (callState.status === CallStatus.ENDED || callState.status === CallStatus.IDLE) {
      console.log('📞 [CallScreen] Call ended or idle, navigating back');
      // Navigate back - callFlowService handles state reset
      navigation.goBack();
    }
  }, [callState.status, navigation]);
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Handle ending the call
  const handleEndCall = () => {
    try {
      console.log('📞 [CallScreen] End call button pressed');
      console.log('   Route callId:', callId);
      console.log('   Redux callState:', callState);
      
      // Get callId from multiple sources (fallback chain):
      // 1. Route params (passed during navigation)
      // 2. callFlowService.getCurrentCall()
      // 3. Redux state (if available)
      let endCallId = callId;
      
      if (!endCallId) {
        const currentCall = callFlowService.getCurrentCall();
        endCallId = currentCall?.callId || '';
        console.log('   Got callId from callFlowService:', endCallId);
      }
      
      if (!endCallId) {
        console.warn('⚠️ [CallScreen] No callId found from any source');
        console.warn('   Attempting to end call using callService directly');
        // Fallback: Call callService.endCall() directly (will clean up WebRTC)
        callService.endCall();
        // Still need to update Redux and emit socket event
        store.dispatch(resetCallState());
        navigation.goBack();
        return;
      }
      
      console.log('✅ [CallScreen] Ending call with callId:', endCallId);
      // Use callFlowService to end call (handles Redux state, WebRTC cleanup, and socket events)
      callFlowService.endCall(endCallId, 'user_ended');
      // Navigation will happen via the useEffect listening to callState.status
    } catch (error) {
      console.error('❌ [CallScreen] Error ending call:', error);
      // Fallback: Force cleanup and navigation
      callService.endCall();
      store.dispatch(resetCallState());
      navigation.goBack();
    }
  };
  
  // Toggle mute
  const handleToggleMute = async () => {
    try {
      // Safety check - should already be CONNECTED if we're here
      if (callState.status !== CallStatus.CONNECTED) {
        Toast.show({
          type: 'info',
          text1: 'Not Connected',
          text2: 'Please wait for the call to connect.',
        });
        return;
      }
      
      const result = await dispatch(toggleAudioMute());
      
      if (toggleAudioMute.fulfilled.match(result)) {
        const isEnabled = (result.payload as any)?.isEnabled;
        if (typeof isEnabled === 'boolean') {
          setIsMuted(!isEnabled);
        }
        
        if (isEnabled !== undefined) {
          console.log('Mute toggled, audio enabled:', isEnabled);
        }
      } else if (toggleAudioMute.rejected.match(result)) {
        const errorMessage = result.payload as string || 'Failed to toggle mute. Please try again.';
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
      }
    } catch (error: any) {
      console.error('Error toggling mute:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to toggle mute. Please try again.',
      });
    }
  };
  
  // Toggle speaker
  const handleToggleSpeaker = async () => {
    try {
      // Safety check - should already be CONNECTED if we're here
      if (callState.status !== CallStatus.CONNECTED) {
        Toast.show({
          type: 'info',
          text1: 'Not Connected',
          text2: 'Please wait for the call to connect.',
        });
        return;
      }
      
      const newSpeakerState = !isSpeakerOn;
      
      try {
        await callService.toggleSpeaker(newSpeakerState);
        setIsSpeakerOn(newSpeakerState);
        console.log('Speaker successfully toggled to:', newSpeakerState);
      } catch (error: any) {
        console.error('Error toggling speaker:', error);
        const errorMessage = error?.message || 'Failed to toggle speaker. Speaker may not be available on this device.';
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
      }
    } catch (error: any) {
      console.error('Error in handleToggleSpeaker:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to toggle speaker. Please try again.',
      });
    }
  };
  
  // ✅ REQUIREMENT 1: Don't render if not CONNECTED
  if (callState.status !== CallStatus.CONNECTED) {
    return null; // Navigation should prevent this, but safety check
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333333" />
      
      {/* Call content area - avatar */}
      <View style={styles.audioCallContainer}>
        <Image 
          source={{uri: avatar}} 
          style={styles.callerImage} 
        />
        <Text style={styles.callerName}>{name}</Text>
        <Text style={styles.callStatus}>
          {formatTime(callDuration)}
        </Text>
      </View>
      
      {/* Call actions */}
      <View style={styles.actionsContainer}>
      <TouchableOpacity 
  style={[styles.actionButton, isMuted && styles.actionButtonActive]} 
  onPress={handleToggleMute}
>
  <Icon 
    name={isMuted ? 'mic-off-outline' : 'mic-outline'} 
    size={28} 
    color="white" 
  />
  <Text style={styles.actionButtonText}>Mute</Text>
</TouchableOpacity>

        
        <TouchableOpacity 
          style={[styles.actionButton, isSpeakerOn && styles.actionButtonActive]} 
          onPress={handleToggleSpeaker}
        >
          <Icon 
            name={isSpeakerOn ? 'volume-high-outline' : 'volume-medium-outline'} 
            size={28} 
            color="white" 
          />
          <Text style={styles.actionButtonText}>Speaker</Text>
        </TouchableOpacity>
      </View>
      
      {/* End call button */}
      <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
        <Icon name="call-outline" size={28} color="white" style={styles.endCallIcon} />
        <Text style={styles.endCallText}>End Call</Text>
      </TouchableOpacity>
      
      {/* Call tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Conversation Tips</Text>
        <Text style={styles.tipsText}>
          Remember to speak clearly and don't be afraid to ask for clarification if needed.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  audioCallContainer: {
    alignItems: 'center',
    marginTop: 40,
    flex: 1,
    justifyContent: 'center',
  },
  callerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4A90E2',
    marginBottom: 20,
  },
  callerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 18,
    color: '#BBBBBB',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 20,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 80,
  },
  actionButtonActive: {
    backgroundColor: '#4A90E2',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  endCallButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 50,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
    marginRight: 8,
  },
  endCallText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#DDDDDD',
    lineHeight: 20,
  },
});

export default CallScreen;
