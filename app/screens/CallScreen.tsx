import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
  InteractionManager,
  BackHandler,
  NativeModules,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CallRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import callService, { CallStatus } from '../utils/callService';
import callFlowService from '../utils/callFlowService';
import { 
  endActiveCall, 
  toggleAudioMute
} from '../redux/thunks/callThunks';
import { setCallState } from '../redux/slices/callSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import apiClient from '../utils/apiClient';

const CallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CallRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  
  // Safely extract parameters with defaults
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  
  // Get avatar from route params or use default
  const avatar = safeParam(route, 'avatar', "https://randomuser.me/api/portraits/men/32.jpg"); 
  
  // Get call state from Redux
  const callState = useSelector((state: RootState) => state.call.activeCall);
  const currentUserId = useSelector((state: RootState) => state.auth.userId);
  
  // Check if we're receiver (coming from incoming call)
  const isReceiver = callState.status === CallStatus.CONNECTING || callState.status === CallStatus.RINGING;
  
  // Local state
  const [callDuration, setCallDuration] = useState(0);
  const [serverStartTime, setServerStartTime] = useState<Date | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Refs for tracking timers
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Initialize call status when the component mounts
  useEffect(() => {
    const syncCallStatus = async () => {
      try {
        // Check if we have a local call start time first
        const currentCallState = callService.getCallState();
        if (currentCallState.callStartTime) {
          console.log('Using local call start time:', currentCallState.callStartTime);
          const currentDuration = Math.floor((Date.now() - currentCallState.callStartTime) / 1000);
          setCallDuration(currentDuration);
          
          // Start a timer with local time
          if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
          }
          
          durationTimerRef.current = setInterval(() => {
            const updatedDuration = Math.floor((Date.now() - (currentCallState.callStartTime || Date.now())) / 1000);
            setCallDuration(updatedDuration);
          }, 1000);
          
          return; // Skip server sync if we have local time
        }

        // If no local time, try server sync
        console.log('Syncing call status with server for call ID:', id);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
          const response = await fetch(`/api/calls/${id}/details`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          const callDetails = await response.json();
          console.log('Received call details from server:', callDetails);
          
          if (callDetails?.status === 'answered' && callDetails.startTime) {
            const serverStartTime = new Date(callDetails.startTime);
            console.log('Setting server start time:', serverStartTime);
            setServerStartTime(serverStartTime);
            
            const currentDuration = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
            console.log('Setting initial duration to:', currentDuration, 'seconds');
            setCallDuration(currentDuration);
            
            if (durationTimerRef.current) {
              clearInterval(durationTimerRef.current);
            }
            
            durationTimerRef.current = setInterval(() => {
              const updatedDuration = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
              setCallDuration(updatedDuration);
            }, 1000);
          }
        } catch (fetchError) {
          console.log('Server sync failed, using local timing:', fetchError);
          // Just continue with local timing
        }
      } catch (error) {
        console.error('Error in syncCallStatus:', error);
        // Continue with local timing
      }
    };

    // Get the current call state directly from the service
    const currentCallState = callService.getCallState();
    console.log('Current call state:', currentCallState);
    console.log('Redux call state:', callState);
    console.log('Is receiver?', isReceiver);
    
    // Initialize callService when CallScreen loads (for WebRTC)
    callService.initialize();
    
    // If we're already connected, initialize the timer and sync with server
    if (currentCallState.status === CallStatus.CONNECTED || callState.status === CallStatus.CONNECTED) {
      syncCallStatus();
    }
    
    // Clean up timer on unmount
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [id]);
  
  // Set up event listeners when the component mounts
  useEffect(() => {
    // Define event handlers
    const handleCallEnded = (data: any) => {
      console.log('Call ended event data:', data);
      console.log('Current callDuration state:', callDuration);
      console.log('Current callState:', callState);
      
      // Get the latest call state directly from callService before it's reset
      const serviceCallState = callService.getCallState();
      console.log('Service call state:', serviceCallState);
      
      // Capture call state values IMMEDIATELY before they get reset
      const capturedUserId = callState.remoteUserId || serviceCallState.remoteUserId;
      const capturedUserName = callState.remoteUserName || serviceCallState.remoteUserName;
      const capturedCallHistoryId = callState.callHistoryId || serviceCallState.callHistoryId;
      
      // Calculate final duration from callStartTime if available
      let finalDuration = 0;
      if (serviceCallState.callStartTime) {
        finalDuration = Math.floor((Date.now() - serviceCallState.callStartTime) / 1000);
        console.log('Calculated duration from callStartTime:', finalDuration);
      }
      
      // Try to get duration from multiple sources (use calculated first)
      const capturedDuration = finalDuration ||          // Calculated from callStartTime
                               data?.duration ||         // From event data
                               callDuration ||           // From local state
                               serviceCallState.callDuration || // From service
                               callState.callDuration || // From Redux
                               0;
      
      console.log('Captured call data:', {
        userId: capturedUserId,
        userName: capturedUserName,
        duration: capturedDuration,
        durationSources: {
          calculated: finalDuration,
          fromEvent: data?.duration,
          fromLocal: callDuration,
          fromService: serviceCallState.callDuration,
          fromRedux: callState.callDuration
        },
        callHistoryId: capturedCallHistoryId
      });
      
      // Use a small delay before navigating back to avoid state conflicts
      setTimeout(() => {
        try {
          // Use captured values instead of callState (which gets reset)
          if (capturedUserId && capturedUserName && capturedDuration > 10) {
            console.log('Navigating to PostCallFlow with duration:', capturedDuration);
            // Use replace instead of navigate to completely remove CallScreen from stack
            navigation.replace('PostCallFlow' as any, {
              userId: capturedUserId,
              userName: capturedUserName,
              userAvatar: undefined, // Not available in CallState
              callDuration: capturedDuration,
              interactionId: capturedCallHistoryId || 'unknown'
            });
          } else {
            console.log('Not showing feedback - conditions not met:', {
              hasUserId: !!capturedUserId,
              hasUserName: !!capturedUserName,
              duration: capturedDuration,
              durationCheck: capturedDuration > 10
            });
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              // If we can't go back, try to navigate to the main screen instead
              navigation.navigate('Main');
            }
          }
        } catch (error) {
          console.error('Navigation error after call ended:', error);
          // Last resort: try to reset to main screen
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }
      }, 500);
    };
    
    // Define handler for call state changes
    const handleCallStateChanged = async (state: any) => {
      console.log('Call state changed:', state);
      
      // Update Redux state when call state changes (including audio enabled state)
      dispatch(setCallState(state));
      
      // If call state becomes IDLE (which happens when call is rejected/reset), navigate back
      if (state.status === CallStatus.IDLE) {
        console.log('Call state changed to IDLE - call was likely rejected or reset');
        // Don't navigate immediately here as call-rejected event handler will handle it
        // But we can check if we're on CallScreen and should navigate
        return;
      }
      
      // If connected, use local time for duration tracking
      // Server sync is optional and will fallback to local time on error
      if (state.status === CallStatus.CONNECTED) {
        // Always use local time first
        if (state.callStartTime) {
          const currentDuration = Math.floor((Date.now() - state.callStartTime) / 1000);
          console.log('Setting duration from local time:', currentDuration);
          setCallDuration(currentDuration);
        }
        
        // Try to sync with server in background (non-critical)
        // Use callHistoryId from call state, not the user id from route params
        const callHistoryId = state.callHistoryId;
        if (callHistoryId && callHistoryId !== 'unknown') {
          try {
            const callDetails = await apiClient.get(`/calls/details/${callHistoryId}`);
            
            if (callDetails.data && callDetails.data.startTime) {
              const serverStartTime = new Date(callDetails.data.startTime);
              console.log('Got server start time for verification:', serverStartTime);
              setServerStartTime(serverStartTime);
              
              // Update duration based on server time if available
              const serverDuration = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
              console.log('Server duration:', serverDuration, 'vs local duration:', callDuration);
              
              // Only update if server time is reasonable (within 10 seconds of local)
              if (Math.abs(serverDuration - callDuration) < 10) {
                setCallDuration(serverDuration);
              }
            }
          } catch (error: any) {
            // Server sync is not critical, just log the error
            console.log('Could not sync with server (using local time):', error.response?.status || error.message);
          }
        }
      }
    };
    
    // Define handler for when call is rejected by receiver
    const handleCallRejected = (data: any) => {
      console.log('Call was rejected by receiver:', data);
      
      // Get the receiver's name if available
      const receiverName = callState.remoteUserName || name || 'User';
      
      // Show toast notification
      Toast.show({
        type: 'info',
        text1: 'Call Declined',
        text2: `${receiverName} declined your call.`,
        visibilityTime: 3000,
      });
      
      // Navigate back after a short delay
      setTimeout(() => {
        try {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            // If we can't go back, navigate to main screen
            navigation.navigate('Main');
          }
        } catch (error) {
          console.error('Navigation error after call rejected:', error);
          // Last resort: reset to main screen
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }
      }, 500);
    };
    
    // Add event listeners
    callService.addEventListener('call-ended', handleCallEnded);
    callService.addEventListener('call-state-changed', handleCallStateChanged);
    callService.addEventListener('call-rejected', handleCallRejected);
    
    // Start a timer to update call duration
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    
    durationTimerRef.current = setInterval(() => {
      if (callState.status === CallStatus.CONNECTED) {
        // Always prefer server start time
        const startTime = serverStartTime?.getTime();
        if (startTime) {
          const currentDuration = Math.floor((Date.now() - startTime) / 1000);
          console.log('Updating duration to:', currentDuration, 'seconds');
          setCallDuration(currentDuration);
        } else if (callState.callStartTime) {
          // Fallback to local time if server time not available
          const currentDuration = Math.floor((Date.now() - callState.callStartTime) / 1000);
          console.log('Using local time, updating duration to:', currentDuration, 'seconds');
          setCallDuration(currentDuration);
        }
      }
    }, 1000);
    
    // Wait for animations before setting ready
    const readyTimer = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    
    // Clean up listeners and timers
    return () => {
      // Remove the event listeners using the same function references
      callService.removeEventListener('call-ended', handleCallEnded);
      callService.removeEventListener('call-state-changed', handleCallStateChanged);
      callService.removeEventListener('call-rejected', handleCallRejected);
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      
      // End call if it's still active
      if (callState.status !== CallStatus.IDLE && callState.status !== CallStatus.ENDED) {
        dispatch(endActiveCall());
      }
      
      readyTimer.cancel();
    };
  }, [dispatch, navigation]);
  
  // Add a separate effect to monitor callState changes
  useEffect(() => {
    // Update the call duration when callStartTime changes
    if (callState.status === CallStatus.CONNECTED && callState.callStartTime) {
      const currentDuration = Math.floor((Date.now() - callState.callStartTime) / 1000);
      console.log('Call start time updated:', callState.callStartTime, '- setting duration to:', currentDuration);
      setCallDuration(currentDuration);
    }
  }, [callState.status, callState.callStartTime]);

  // INVITATION-FIRST ARCHITECTURE: Handle call:ready-for-webrtc event
  // This is emitted after call:start event - WebRTC can now start
  useEffect(() => {
    console.log('🔧 [CallScreen] Setting up call:ready-for-webrtc listener');
    
    const handleCallReady = (callSession: any) => {
      console.log('🎬 [CallScreen] call:ready-for-webrtc received - Starting WebRTC now');
      console.log('   Call session:', callSession);
      console.log('   Call status:', callState.status);
      
      // Determine if we're caller or receiver
      const isCaller = callSession.callerId === currentUserId;
      
      console.log('   Current user ID:', currentUserId);
      console.log('   Caller ID:', callSession.callerId);
      console.log('   Receiver ID:', callSession.receiverId);
      console.log('   Is caller?', isCaller);
      
      // Get receiver name from call state or route params
      const receiverName = callState.remoteUserName || name || 'User';
      
      // Initialize WebRTC connection
      if (isCaller) {
        console.log('📞 [CallScreen] Caller: Creating WebRTC offer...');
        // Caller creates offer using startCall (creates offer and sends it)
        callService.startCall(
          callSession.receiverId,
          receiverName,
          {
            audio: true,
            video: callSession.metadata?.isVideo || false
          }
        ).catch((error) => {
          console.error('❌ [CallScreen] Error starting call:', error);
          Toast.show({
            type: 'error',
            text1: 'Call Failed',
            text2: error.message || 'Could not start call. Please try again.',
          });
        });
      } else {
        console.log('📞 [CallScreen] Receiver: Waiting for WebRTC offer...');
        // Receiver waits for offer (will be handled by call-offer socket event)
        // callService should already be initialized and listening for call-offer
      }
    };
    
    // Listen for call:ready-for-webrtc event
    callFlowService.on('call:ready-for-webrtc', handleCallReady);
    
    return () => {
      console.log('🧹 [CallScreen] Removing call:ready-for-webrtc listener');
      callFlowService.off('call:ready-for-webrtc', handleCallReady);
    };
  }, [callState.status, currentUserId, name]);

  // Handle receiver case: When WebRTC offer is received, accept it
  useEffect(() => {
    if (!isReceiver) return;

    const serviceCallState = callService.getCallState();
    console.log('🔍 [CallScreen Receiver] Monitoring callService state:', serviceCallState.status);
    
    // If callService received the offer (status is RINGING) and has SDP, accept it
    if (serviceCallState.status === CallStatus.RINGING && serviceCallState.sdp) {
      console.log('✅ [CallScreen Receiver] WebRTC offer received, accepting call...');
      callService.acceptCall({ audio: true, video: serviceCallState.isVideoEnabled })
        .then(() => {
          console.log('✅ [CallScreen Receiver] Call accepted successfully');
        })
        .catch((error) => {
          console.error('❌ [CallScreen Receiver] Error accepting call:', error);
        });
    }
  }, [isReceiver, callState.status]);
  
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Handle ending the call
  const handleEndCall = () => {
    try {
      void dispatch(endActiveCall());
      
      // Navigation will happen via the event listener for call-ended
    } catch (error) {
      console.error('Error ending call:', error);
      navigation.goBack();
    }
  };
  
  // Toggle mute
  const handleToggleMute = async () => {
    try {
      // Check if call is connected before attempting to toggle
      if (callState.status !== CallStatus.CONNECTED) {
        Toast.show({
          type: 'info',
          text1: 'Not Connected',
          text2: 'Please wait for the call to connect.',
        });
        return;
      }
      
      const result = await dispatch(toggleAudioMute());
      
      // Handle the result
      if (toggleAudioMute.fulfilled.match(result)) {
        const isEnabled = (result.payload as any)?.isEnabled;
        if (isEnabled !== undefined) {
          // State will be updated via call-state-changed event from callService
          console.log('Mute toggled, audio enabled:', isEnabled);
        }
      } else if (toggleAudioMute.rejected.match(result)) {
        // Handle rejection with user-friendly error message
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
      // Check if call is connected before attempting to toggle
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
        // Use callService's toggleSpeaker method
        await callService.toggleSpeaker(newSpeakerState);
        
        // Only update UI state if native call succeeded
        setIsSpeakerOn(newSpeakerState);
        console.log('Speaker successfully toggled to:', newSpeakerState);
      } catch (error: any) {
        console.error('Error toggling speaker:', error);
        // Don't update UI state if native call failed
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
  
  
  // Get call status text based on call state
  const getStatusText = () => {
    switch (callState.status) {
      case CallStatus.CALLING:
        return 'Calling...';
      case CallStatus.RINGING:
        return 'Ringing...';
      case CallStatus.CONNECTING:
        return 'Connecting...';
      case CallStatus.RECONNECTING:
        return 'Reconnecting...';
      case CallStatus.CONNECTED:
        return formatTime(callDuration);
      case CallStatus.ENDED:
        return 'Call ended';
      default:
        return 'Connecting...';
    }
  };
  
  
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
          {getStatusText()}
        </Text>
      </View>
      
      {/* Call actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, !callState.isAudioEnabled && styles.actionButtonActive]} 
          onPress={handleToggleMute}
        >
          <Icon 
            name={callState.isAudioEnabled ? 'mic-outline' : 'mic-off-outline'} 
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
      {callState.status === CallStatus.CONNECTED && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Conversation Tips</Text>
          <Text style={styles.tipsText}>
            Remember to speak clearly and don't be afraid to ask for clarification if needed.
          </Text>
        </View>
      )}
      
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
  avatarContainer: {
    alignItems: 'center',
    marginTop: 40,
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4A90E2',
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    color: '#BBBBBB',
  },
  loader: {
    marginTop: 20,
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
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
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
});

export default CallScreen;