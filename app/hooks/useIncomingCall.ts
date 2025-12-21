/**
 * useIncomingCall Hook
 * 
 * Manages incoming call state and UI
 * Integrates with CallFlowService and displays IncomingCallModal
 */

import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import callFlowService, { IncomingCallData, CallType } from '../utils/callFlowService';
import callService from '../utils/callService';
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
      console.log('📞 [RECEIVER UI] Incoming call received in useIncomingCall hook:', data);
      console.log('   callId:', data.callId);
      console.log('   callerId:', data.callerId);
      console.log('   callType:', data.callType);
      console.log('   autoAccept:', data.autoAccept);
      
      // Only show modal for direct calls (match calls auto-accept)
      if (data.callType === CallType.DIRECT_CALL && !data.autoAccept) {
        console.log('✅ [RECEIVER UI] Setting incoming call state and showing modal');
        setIncomingCall(data);
        setShowModal(true);
        console.log('✅ [RECEIVER UI] Incoming call modal state updated - modal should be visible');
      } else {
        console.log('⚠️ [RECEIVER UI] Not showing modal - callType:', data.callType, 'autoAccept:', data.autoAccept);
      }
    };

    // Listen for call accepted (ready for WebRTC)
    const handleCallReady = (callSession: any) => {
      console.log('✅ [RECEIVER] Call ready for WebRTC:', callSession);
      setShowModal(false);
      setIncomingCall(null);
      
      // Initialize callService for receiver (to handle incoming WebRTC offer)
      callService.initialize();
      console.log('✅ [RECEIVER] CallService initialized, waiting for WebRTC offer from caller');
      
      // Navigate to CallScreen (receiver will wait for call-offer event from caller)
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



