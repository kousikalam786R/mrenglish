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

    // DELETED: Direct navigation - navigation happens automatically when CONNECTED
    // (handled by callFlowService 'call:navigate-to-callscreen' event)
    // const handleCallReady = (callSession: any) => {
    //   // Navigation to CallScreen happens automatically when CONNECTED
    //   // (handled by callFlowService events in IncomingCallCard)
    // };

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
    // DELETED: call:ready-for-webrtc listener - navigation happens when CONNECTED
    // callFlowService.on('call:ready-for-webrtc', handleCallReady);
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
      // DELETED: call:ready-for-webrtc listener cleanup
      // callFlowService.off('call:ready-for-webrtc', handleCallReady);
      callFlowService.off('call:cancelled', handleCallCancelled);
      callFlowService.off('call:ended', handleCallEnded);
      callFlowService.off('call:timeout', handleCallTimeout);
      subscription.remove();
    };
  }, [navigation, incomingCall]);

  const handleAccept = () => {
    if (incomingCall) {
      console.log('✅ Accepting invitation:', incomingCall.inviteId || incomingCall.callId);
      const inviteId = incomingCall.inviteId || incomingCall.callId;
      callFlowService.acceptInvitation(inviteId);
      setShowModal(false);
      // Navigation will happen automatically when CONNECTED
      // (handled by callFlowService 'call:navigate-to-callscreen' event)
    }
  };

  const handleDecline = () => {
    if (incomingCall) {
      console.log('❌ Declining invitation:', incomingCall.inviteId || incomingCall.callId);
      const inviteId = incomingCall.inviteId || incomingCall.callId;
      callFlowService.declineInvitation(inviteId);
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



