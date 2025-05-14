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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CallRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { RTCView, MediaStream } from 'react-native-webrtc';
import callService, { CallStatus } from '../utils/callService';
import { 
  endActiveCall, 
  toggleAudioMute,
  toggleVideoStream
} from '../redux/thunks/callThunks';
import Icon from 'react-native-vector-icons/Ionicons';

const CallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CallRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  
  // Safely extract parameters with defaults
  const id = safeParam(route, 'id', '0');
  const name = safeParam(route, 'name', 'User');
  const isVideoCall = safeParam(route, 'isVideoCall', false);
  
  // Get avatar from route params or use default
  const avatar = safeParam(route, 'avatar', "https://randomuser.me/api/portraits/men/32.jpg"); 
  
  // Get call state from Redux
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Local state
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  
  // Refs for tracking timers
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        handleEndCall();
        return true;
      };
      
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => subscription.remove();
    }, [])
  );
  
  // Initialize call status when the component mounts
  useEffect(() => {
    // Get the current call state directly from the service
    const currentCallState = callService.getCallState();
    
    // If we're already connected, initialize the timer
    if (currentCallState.status === CallStatus.CONNECTED && currentCallState.callStartTime) {
      const currentDuration = Math.floor((Date.now() - currentCallState.callStartTime) / 1000);
      setCallDuration(currentDuration);
    }
  }, []);
  
  // Set up event listeners when the component mounts
  useEffect(() => {
    // Define event handlers
    const handleLocalStreamUpdate = (stream: MediaStream) => {
      console.log('Local stream updated', stream);
      setLocalStream(stream);
    };
    
    const handleRemoteStreamUpdate = (stream: MediaStream) => {
      console.log('Remote stream updated', stream);
      setRemoteStream(stream);
    };
    
    const handleCallEnded = (data: any) => {
      console.log('Call ended', data);
      
      // Use a small delay before navigating back to avoid state conflicts
      setTimeout(() => {
        try {
          // First check if we can go back to prevent the GO_BACK error
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            // If we can't go back, try to navigate to the main screen instead
            navigation.navigate('Main');
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
    const handleCallStateChanged = (state: any) => {
      console.log('Call state changed:', state);
      
      // If connected, ensure timer is running and start time is set
      if (state.status === CallStatus.CONNECTED && state.callStartTime) {
        // Calculate current duration since start time
        const currentDuration = Math.floor((Date.now() - state.callStartTime) / 1000);
        console.log('Setting call duration to:', currentDuration, 'seconds from start time:', state.callStartTime);
        setCallDuration(currentDuration);
      }
    };
    
    // Add event listeners
    callService.addEventListener('local-stream-updated', handleLocalStreamUpdate);
    callService.addEventListener('remote-stream-updated', handleRemoteStreamUpdate);
    callService.addEventListener('call-ended', handleCallEnded);
    callService.addEventListener('call-state-changed', handleCallStateChanged);
    
    // Start a timer to update call duration
    durationTimerRef.current = setInterval(() => {
      if (callState.status === CallStatus.CONNECTED && callState.callStartTime) {
        // Calculate duration based on start time for more accuracy
        const currentDuration = Math.floor((Date.now() - callState.callStartTime) / 1000);
        setCallDuration(currentDuration);
      }
    }, 1000);
    
    // Wait for animations before setting ready
    const readyTimer = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    
    // Clean up listeners and timers
    return () => {
      // Remove the event listeners using the same function references
      callService.removeEventListener('local-stream-updated', handleLocalStreamUpdate);
      callService.removeEventListener('remote-stream-updated', handleRemoteStreamUpdate);
      callService.removeEventListener('call-ended', handleCallEnded);
      callService.removeEventListener('call-state-changed', handleCallStateChanged);
      
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
  const handleToggleMute = () => {
    void dispatch(toggleAudioMute());
  };
  
  // Toggle speaker
  const handleToggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    callService.toggleSpeaker();
  };
  
  // Toggle video
  const handleToggleVideo = () => {
    void dispatch(toggleVideoStream());
  };
  
  // Get call status text based on call state
  const getStatusText = () => {
    switch (callState.status) {
      case CallStatus.CALLING:
        return 'Calling...';
      case CallStatus.RINGING:
        return 'Ringing...';
      case CallStatus.RECONNECTING:
        return 'Reconnecting...';
      case CallStatus.CONNECTED:
        return formatTime(callDuration);
      case CallStatus.ENDED:
        return 'Call ended';
      default:
        return '';
    }
  };
  
  // Render video streams or avatar
  const renderVideoContent = () => {
    // If video call and streams are available, render RTCViews
    if (isVideoCall && localStream && remoteStream && callState.status === CallStatus.CONNECTED) {
      return (
        <View style={styles.videoContainer}>
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteStream}
            objectFit="cover"
          />
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localStream}
            objectFit="cover"
            zOrder={1} // Make sure local view is on top
          />
        </View>
      );
    }
    
    // Otherwise, render avatar
    return (
      <View style={styles.avatarContainer}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <Text style={styles.name}>{callState.remoteUserName || name}</Text>
        <Text style={styles.status}>
          {getStatusText()}
        </Text>
        
        {(callState.status === CallStatus.CALLING || callState.status === CallStatus.RECONNECTING) && (
          <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
        )}
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333333" />
      
      {/* Call content area - avatar or video */}
      {renderVideoContent()}
      
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
        
        <TouchableOpacity 
          style={[styles.actionButton, callState.isVideoEnabled && styles.actionButtonActive]} 
          onPress={handleToggleVideo}
          disabled={!isVideoCall}
        >
          <Icon 
            name={callState.isVideoEnabled ? 'videocam-outline' : 'videocam-off-outline'} 
            size={28} 
            color="white" 
          />
          <Text style={styles.actionButtonText}>Video</Text>
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
  videoContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  remoteStream: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#444',
  },
  localStream: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: '#666',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
    zIndex: 2,
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
});

export default CallScreen;