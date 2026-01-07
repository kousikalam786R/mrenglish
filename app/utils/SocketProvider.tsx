import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from './socketService';
import callService, { CallStatus } from './callService';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { getAuthToken, getUserIdFromToken } from './authUtils';
import { setCallState } from '../redux/slices/callSlice';
import { store } from '../redux/store';

// Create socket context
type SocketContextType = {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

// Interface for JWT payload (add any additional fields from your actual JWT)
interface JwtPayload {
  id?: string;
  userId?: string;
  sub?: string;
  exp?: number;
}

const SocketContext = createContext<SocketContextType>({
  isConnected: false,
  connect: async () => {
    console.warn('SocketContext.connect() was called without a provider');
  },
  disconnect: () => {
    console.warn('SocketContext.disconnect() was called without a provider');
  },
});

// Socket provider component
export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const { isSignedIn } = useAppSelector((state: any) => state.auth);
  const dispatch = useAppDispatch();

  // Connect to socket
  const connect = async () => {
    try {
      // Get user ID and store it if needed
      const userId = await getUserIdFromToken();
      if (userId) {
        await AsyncStorage.setItem('userId', userId);
      }
      
      // Initialize socket connection
      await socketService.initialize();
      setIsConnected(true);
  
      // Store the socket ID as a fallback if we couldn't get the user ID from JWT
      const socket = socketService.getSocket();
      if (socket) {
        if (socket.id && !userId) {
          await AsyncStorage.setItem('userId', socket.id);
        }
        
        // Add listener for user data
        socket.on('user_data', (userData) => {
          console.log('Received user data from socket:', userData);
          if (userData) {
            socketService.storeUserData(userData);
          }
        });
        
        // Initialize call service
        initializeCallService();
        
        // UNIFIED USER STATUS SYSTEM - Initialize user status service
        import('../services/userStatusService').then(({ default: userStatusService }) => {
          console.log('📊 [SocketProvider] Initializing userStatusService after socket connection');
          userStatusService.initialize();
        });
        
        // CRITICAL FIX: Initialize callFlowService when socket connects
        // This ensures socket listeners are set up for incoming calls
        import('../utils/callFlowService').then(({ default: callFlowService }) => {
          console.log('🔧 [SocketProvider] Initializing callFlowService after socket connection');
          callFlowService.initialize();
          
          // FALLBACK: Also set up notification handler to trigger incoming call modal
          // This ensures the modal shows even if socket event is missed
          import('../utils/notificationService').then(({ default: notificationService }) => {
            console.log('📱 [SocketProvider] Setting up notification handler for invitations');
            
            notificationService.onForegroundMessage((remoteMessage) => {
              console.log('📱 [SocketProvider] Foreground notification received:', remoteMessage);
              
              // Check if this is a call/invitation notification
              const notificationData = remoteMessage.data;
              console.log('📱 [SocketProvider] Notification data:', notificationData);
              
              if (notificationData?.type === 'call' && notificationData?.callerId) {
                // Check if this is an invitation (has inviteId) or old call format
                if (notificationData.inviteId) {
                  console.log('📱 [SocketProvider] Invitation notification detected, inviteId:', notificationData.inviteId);
                  
                  // Check Redux state to see if invitation was already handled
                  const currentReduxState = store.getState().call.invitation;
                  console.log('📱 [SocketProvider] Current Redux invitation state:', currentReduxState);
                  
                  // Only process if invitation is not already in Redux state
                  if (currentReduxState.inviteId === notificationData.inviteId && currentReduxState.status === 'incoming') {
                    console.log('📱 [SocketProvider] Invitation already in Redux state (socket event handled it), ignoring notification');
                    return;
                  }
                  
                  // Also check callFlowService local state
                  const currentInvitation = callFlowService.getCurrentInvitation();
                  if (currentInvitation && currentInvitation.inviteId === notificationData.inviteId) {
                    console.log('📱 [SocketProvider] Invitation already in callFlowService (socket event handled it), ignoring notification');
                    return;
                  }
                  
                  console.log('📱 [SocketProvider] Processing invitation notification - triggering handleIncomingInvitation');
                  console.log('   inviteId:', notificationData.inviteId);
                  console.log('   callerId:', notificationData.callerId);
                  console.log('   callerName:', notificationData.callerName);
                  
                  const invitationData = {
                    inviteId: notificationData.inviteId,
                    callerId: notificationData.callerId,
                    callerName: notificationData.callerName || 'Unknown',
                    callerProfilePic: notificationData.callerProfilePic,
                    metadata: {
                      isVideo: notificationData.callType === 'video'
                    },
                    callHistoryId: notificationData.callHistoryId,
                    expiresAt: notificationData.expiresAt || new Date(Date.now() + 30000).toISOString()
                  };
                  
                  // Trigger incoming invitation handler (will update invitation state and show modal)
                  callFlowService.handleIncomingInvitation(invitationData);
                  console.log('✅ [SocketProvider] handleIncomingInvitation called - modal should appear');
                } else {
                  // Legacy call notification (should not happen in invitation-first architecture)
                  console.warn('📱 [SocketProvider] Received legacy call notification (no inviteId), ignoring');
                }
              } else {
                console.log('📱 [SocketProvider] Notification is not a call/invitation, ignoring');
              }
            });
            
            // Also handle notification when app is opened from notification
            notificationService.onNotificationOpenedApp((remoteMessage) => {
              console.log('📱 [SocketProvider] App opened from notification:', remoteMessage);
              const notificationData = remoteMessage.data;
              
              if (notificationData?.type === 'call' && notificationData?.inviteId) {
                console.log('📱 [SocketProvider] Processing invitation notification from app open');
                const invitationData = {
                  inviteId: notificationData.inviteId,
                  callerId: notificationData.callerId,
                  callerName: notificationData.callerName || 'Unknown',
                  callerProfilePic: notificationData.callerProfilePic,
                  metadata: {
                    isVideo: notificationData.callType === 'video'
                  },
                  callHistoryId: notificationData.callHistoryId,
                  expiresAt: notificationData.expiresAt || new Date(Date.now() + 30000).toISOString()
                };
                callFlowService.handleIncomingInvitation(invitationData);
              }
            });
            
            console.log('✅ [SocketProvider] Notification handlers set up successfully');
          }).catch((err) => {
            console.error('❌ [SocketProvider] Failed to set up notification handler:', err);
          });
        }).catch((error) => {
          console.error('❌ [SocketProvider] Failed to initialize callFlowService:', error);
        });
      }
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      setIsConnected(false);
    }
  };

  // Initialize call service and set up event listeners
  const initializeCallService = () => {
    try {
      console.log('🔧 [SocketProvider] Initializing call service');
      
      // CRITICAL: Ensure socket is connected before initializing callService
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.warn('⚠️ [SocketProvider] Cannot initialize callService - socket not ready');
        console.warn('   Socket exists:', !!socket);
        console.warn('   Socket connected:', socket?.connected);
        console.warn('   Will retry when socket connects');
        return;
      }
      
      console.log('✅ [SocketProvider] Socket is ready, initializing callService');
      console.log('   Socket ID:', socket.id);
      
      // Initialize the call service
      callService.initialize();
      
      // Set up listener for call state changes
      // NOTE: Only update Redux for match calls or when callFlowService isn't managing state
      // callFlowService updates Redux directly for direct calls to avoid conflicts
      callService.addEventListener('call-state-changed', (callState) => {
        console.log('Call state changed (callService):', callState);
        const currentReduxState = store.getState().call.activeCall;
        // Update Redux if:
        // 1. Current state is IDLE (callFlowService isn't managing a call)
        // 2. callService is resetting to IDLE (cleanup)
        // 3. callService is setting to ENDED (allow end call to propagate)
        // 4. callService is setting to CONNECTED from CONNECTING (normal connection flow)
        //    Note: callFlowService also handles CONNECTED, but this ensures it works even if callFlowService isn't initialized
        if (currentReduxState.status === CallStatus.IDLE || 
            callState.status === CallStatus.IDLE || 
            callState.status === CallStatus.ENDED ||
            (callState.status === CallStatus.CONNECTED && currentReduxState.status === CallStatus.CONNECTING)) {
          dispatch(setCallState(callState));
        } else {
          console.log('⚠️ Skipping callService state update - callFlowService is managing call state');
        }
      });
      
      // Set up listener for incoming calls
      callService.addEventListener('incoming-call', (data) => {
        console.log('Incoming call:', data);
        // Incoming call notification will be handled by the call state change
      });
      
    } catch (error) {
      console.error('Failed to initialize call service:', error);
    }
  };

  // Disconnect from socket
  const disconnect = () => {
    try {
      socketService.disconnect();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect from socket:', error);
    }
  };

  // Connect to socket when signed in, disconnect when signed out
  useEffect(() => {
    if (isSignedIn) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isSignedIn]);

  return (
    <SocketContext.Provider value={{ isConnected, connect, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

// Hook to use socket context
export const useSocket = () => useContext(SocketContext);

export default SocketProvider;