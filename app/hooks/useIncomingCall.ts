/**
 * useIncomingCall Hook
 * 
 * Manages incoming call state and UI
 * Integrates with CallFlowService and displays IncomingCallModal
 */

import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import callFlowService, { IncomingCallData, CallType } from '../utils/callFlowService';
import { useNavigation } from '@react-navigation/native';

export const useIncomingCall = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    // Initialize call flow service
    callFlowService.initialize();

    // Listen for incoming calls
    const handleIncomingCall = (data: IncomingCallData) => {
      console.log('📞 Incoming call received in hook:', data);
      
      // Only show modal for direct calls (match calls auto-accept)
      if (data.callType === CallType.DIRECT_CALL && !data.autoAccept) {
        setIncomingCall(data);
        setShowModal(true);
      }
    };

    // Listen for call accepted (ready for WebRTC)
    const handleCallReady = (callSession: any) => {
      console.log('✅ Call ready for WebRTC:', callSession);
      setShowModal(false);
      setIncomingCall(null);
      
      // Navigate to CallScreen
      navigation.navigate('CallScreen' as never, {
        id: callSession.callerId,
        name: callSession.callerName,
        isVideoCall: callSession.metadata?.isVideo || false,
        callId: callSession.callId,
        callType: callSession.callType,
      } as never);
    };

    // Listen for call cancelled
    const handleCallCancelled = (data: any) => {
      console.log('🚫 Call cancelled:', data);
      setShowModal(false);
      setIncomingCall(null);
    };

    // Listen for call ended
    const handleCallEnded = (data: any) => {
      console.log('📴 Call ended:', data);
      setShowModal(false);
      setIncomingCall(null);
    };

    // Listen for call timeout
    const handleCallTimeout = (data: any) => {
      console.log('⏰ Call timed out:', data);
      setShowModal(false);
      setIncomingCall(null);
    };

    // Register event listeners
    callFlowService.on('call:incoming', handleIncomingCall);
    callFlowService.on('call:ready-for-webrtc', handleCallReady);
    callFlowService.on('call:cancelled', handleCallCancelled);
    callFlowService.on('call:ended', handleCallEnded);
    callFlowService.on('call:timeout', handleCallTimeout);

    // Handle app state changes (background/foreground)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && incomingCall) {
        // App came to foreground, ensure modal is shown
        setShowModal(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      callFlowService.off('call:incoming', handleIncomingCall);
      callFlowService.off('call:ready-for-webrtc', handleCallReady);
      callFlowService.off('call:cancelled', handleCallCancelled);
      callFlowService.off('call:ended', handleCallEnded);
      callFlowService.off('call:timeout', handleCallTimeout);
      subscription.remove();
    };
  }, [navigation, incomingCall]);

  const handleAccept = () => {
    if (incomingCall) {
      console.log('✅ Accepting call:', incomingCall.callId);
      callFlowService.acceptCall(incomingCall.callId);
      setShowModal(false);
      // Navigation will happen via call:ready-for-webrtc event
    }
  };

  const handleDecline = () => {
    if (incomingCall) {
      console.log('❌ Declining call:', incomingCall.callId);
      callFlowService.declineCall(incomingCall.callId);
      setShowModal(false);
      setIncomingCall(null);
    }
  };

  return {
    incomingCall,
    showModal,
    handleAccept,
    handleDecline,
  };
};

