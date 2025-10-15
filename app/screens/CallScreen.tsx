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
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CallRouteProp } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { safeParam } from '../utils/safeProps';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { RTCView, MediaStream, MediaStreamTrack } from 'react-native-webrtc';
import callService, { CallStatus } from '../utils/callService';
import { 
  endActiveCall, 
  toggleAudioMute,
  toggleVideoStream
} from '../redux/thunks/callThunks';
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
  const isVideoCall = safeParam(route, 'isVideoCall', false);
  
  // Get avatar from route params or use default
  const avatar = safeParam(route, 'avatar', "https://randomuser.me/api/portraits/men/32.jpg"); 
  
  // Get call state from Redux
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Local state
  const [callDuration, setCallDuration] = useState(0);
  const [serverStartTime, setServerStartTime] = useState<Date | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeRequestFrom, setUpgradeRequestFrom] = useState<string | null>(null);
  
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
    
    // If we're already connected, initialize the timer and sync with server
    if (currentCallState.status === CallStatus.CONNECTED) {
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
    const handleLocalStreamUpdate = (stream: MediaStream) => {
      console.log('Local stream updated', stream);
      setLocalStream(stream);
    };
    
    const handleRemoteStreamUpdate = (stream: MediaStream) => {
      console.log('Remote stream updated', stream);
      setRemoteStream(stream);
    };
    
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
            navigation.navigate('PostCallFlow' as any, {
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
    
    // Add event listeners
    callService.addEventListener('local-stream-updated', handleLocalStreamUpdate);
    callService.addEventListener('remote-stream-updated', handleRemoteStreamUpdate);
    callService.addEventListener('call-ended', handleCallEnded);
    callService.addEventListener('call-state-changed', handleCallStateChanged);
    
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
  
  // Add a listener for video upgrade requests
  useEffect(() => {
    const handleVideoUpgradeRequest = async (data: any) => {
      console.log('Received video upgrade request', data);
      setUpgradeRequestFrom(data.userId);
      
      // Preload camera immediately when request comes in, don't wait for user to accept
      try {
        console.log('Preloading camera for incoming video request');
        const { requestCameraPermission } = require('../utils/permissionUtils');
        const hasPermission = await requestCameraPermission();
        
        if (hasPermission) {
          // Start camera initialization in background without showing loading state yet
          const { mediaDevices } = require('react-native-webrtc');
          
          // Create a timeout promise to limit how long we'll wait
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera preload timeout')), 5000);
          });
          
          // Try to preload camera with timeout
          Promise.race([
            mediaDevices.getUserMedia({ audio: false, video: true }),
            timeoutPromise
          ]).then((stream: any) => {
            console.log('Camera preloaded successfully for video request');
            // Stop tracks immediately, we just wanted to initialize the camera
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          }).catch(err => {
            // Just log error but continue showing dialog, we'll try again when user accepts
            console.log('Camera preload in background failed:', err);
          });
        }
      } catch (error) {
        console.log('Error in background camera preload:', error);
        // Error is non-fatal, dialog will still show
      }
      
      // Show the dialog to the user
      setShowUpgradeDialog(true);
    };
    
    callService.addEventListener('video-upgrade-request', handleVideoUpgradeRequest);
    
    return () => {
      callService.removeEventListener('video-upgrade-request', handleVideoUpgradeRequest);
    };
  }, []);
  
  // Add effect for preloading camera when entering call screen for video calls
  useEffect(() => {
    // For video calls, preload camera when component mounts
    const preloadCamera = async () => {
      if (isVideoCall) {
        try {
          console.log('Preloading camera for video call');
          const { requestCameraPermission } = require('../utils/permissionUtils');
          const hasPermission = await requestCameraPermission();
          
          if (hasPermission) {
            // Import only what we need to avoid circular dependencies
            const { mediaDevices } = require('react-native-webrtc');
            
            // Just check camera access but don't keep the stream
            const cameraCheckStream = await mediaDevices.getUserMedia({
              audio: false,
              video: true
            });
            
            // Stop tracks to release camera after checking
            cameraCheckStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            console.log('Camera preloaded successfully');
          }
        } catch (error) {
          console.log('Camera preload failed:', error);
          // Failure is ok, we'll retry when user explicitly enables video
        }
      }
    };
    
    // Run after a short delay to let the component mount fully first
    const preloadTimer = setTimeout(preloadCamera, 1000);
    
    return () => {
      clearTimeout(preloadTimer);
    };
  }, [isVideoCall]);
  
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
  
  // Handle accepting a video upgrade request
  const handleAcceptVideoUpgrade = () => {
    if (upgradeRequestFrom) {
      // Show loading state immediately to give user feedback
      setIsVideoLoading(true);
      
      // Set a timeout to clear the loading state if it takes too long
      const loadingTimeout = setTimeout(() => {
        console.log('Camera initialization timeout after accepting - clearing loading state');
        setIsVideoLoading(false);
        Toast.show({
          type: 'info',
          text1: 'Camera initialization taking longer than expected',
          text2: 'Video should appear shortly'
        });
      }, 8000); // 8 seconds timeout
      
      // Set up a one-time listener for stream updates to clear loading state
      const clearLoading = () => {
        clearTimeout(loadingTimeout);
        setIsVideoLoading(false);
      };
      
      callService.addEventListener('local-stream-updated', clearLoading);
      
      // Clean up the listener after a timeout
      setTimeout(() => {
        callService.removeEventListener('local-stream-updated', clearLoading);
        setIsVideoLoading(false);
      }, 10000);
      
      // Accept the upgrade request
      callService.acceptVideoUpgrade();
      setShowUpgradeDialog(false);
      setUpgradeRequestFrom(null);
    }
  };
  
  // Handle rejecting a video upgrade request
  const handleRejectVideoUpgrade = () => {
    if (upgradeRequestFrom) {
      callService.rejectVideoUpgrade();
      setShowUpgradeDialog(false);
      setUpgradeRequestFrom(null);
    }
  };
  
  // Modified handleToggleVideo to use the video upgrade flow when in a call
  const handleToggleVideo = async () => {
    try {
      // If video is already enabled, just toggle it off
      if (callState.isVideoEnabled) {
        await dispatch(toggleVideoStream());
        return;
      }
      
      // If video is not enabled, request camera permission first
      const { requestCameraPermission } = require('../utils/permissionUtils');
      const hasPermission = await requestCameraPermission();
      
      if (!hasPermission) {
        console.error('Camera permission denied');
        Toast.show({
          type: 'error',
          text1: 'Camera permission denied',
          text2: 'Please enable camera access in settings to use video'
        });
        return;
      }
      
      // Set loading state
      setIsVideoLoading(true);
      
      // Set a timeout to clear the loading state if it takes too long
      const loadingTimeout = setTimeout(() => {
        console.log('Camera initialization timeout - clearing loading state');
        setIsVideoLoading(false);
        Toast.show({
          type: 'info',
          text1: 'Camera initialization taking longer than expected',
          text2: 'Please try again if video doesn\'t appear soon'
        });
      }, 8000); // 8 seconds timeout
      
      // Check if callService supports video upgrade
      if (callState.status === CallStatus.CONNECTED && 
          typeof callService.requestVideoUpgrade === 'function') {
        try {
          // Use the video upgrade flow
          console.log('Using video upgrade flow');
          callService.requestVideoUpgrade();
          // Loading state will be cleared when stream updates or on error
          
          // Add event listener to clear loading state when stream is updated
          const clearLoading = () => {
            clearTimeout(loadingTimeout);
            setIsVideoLoading(false);
          };
          
          callService.addEventListener('local-stream-updated', clearLoading);
          
          // Clean up after 10 seconds regardless of result
          setTimeout(() => {
            callService.removeEventListener('local-stream-updated', clearLoading);
            setIsVideoLoading(false);
          }, 10000);
        } catch (error) {
          clearTimeout(loadingTimeout);
          console.error('Failed to request video upgrade:', error);
          // Fallback to regular toggle
          await dispatch(toggleVideoStream());
          setIsVideoLoading(false);
        }
      } else {
        console.log('Using regular video toggle flow');
        // Regular toggle for initial call setup or if upgrade not supported
        try {
          const result = await dispatch(toggleVideoStream());
          clearTimeout(loadingTimeout);
          setIsVideoLoading(false);
        } catch (error) {
          clearTimeout(loadingTimeout);
          setIsVideoLoading(false);
          console.error('Error in video toggle:', error);
        }
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      setIsVideoLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Error enabling video',
        text2: 'Please try again'
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
  
  // Modified renderVideoContent to handle loading state
  const renderVideoContent = () => {
    // Show loading indicator if video is being initialized
    if (isVideoLoading) {
      return (
        <View style={styles.videoContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      );
    }
    
    // Show video streams if video is enabled
    if (callState.isVideoEnabled) {
      return (
        <View style={styles.videoContainer}>
          {/* Remote Video - Large (background) */}
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
            />
          )}
          
          {/* Local Video - Small (picture-in-picture) */}
          {localStream && (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
            />
          )}
        </View>
      );
    }
    
    // Default audio-only call UI
    return (
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
      
      {/* Video Upgrade Dialog */}
      <Modal
        visible={showUpgradeDialog}
        transparent
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.upgradeDialog}>
            <Text style={styles.upgradeTitle}>Video Upgrade Request</Text>
            <Text style={styles.upgradeMessage}>
              {`${name} wants to enable video for this call.`}
            </Text>
            <View style={styles.upgradeButtons}>
              <TouchableOpacity 
                style={[styles.upgradeButton, styles.rejectButton]} 
                onPress={handleRejectVideoUpgrade}
              >
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.upgradeButton, styles.acceptButton]} 
                onPress={handleAcceptVideoUpgrade}
              >
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
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
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  localVideo: {
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
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  upgradeDialog: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  upgradeMessage: {
    fontSize: 16,
    marginBottom: 20,
  },
  upgradeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  upgradeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CallScreen;