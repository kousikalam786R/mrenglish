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
        
        // CRITICAL FIX: Initialize callFlowService when socket connects
        // This ensures socket listeners are set up for incoming calls
        import('../utils/callFlowService').then(({ default: callFlowService }) => {
          console.log('🔧 [SocketProvider] Initializing callFlowService after socket connection');
          callFlowService.initialize();
          
          // FALLBACK: Also set up notification handler to trigger incoming call modal
          // This ensures the modal shows even if socket event is missed
          import('../utils/notificationService').then(({ default: notificationService }) => {
            notificationService.onForegroundMessage((remoteMessage) => {
              // Check if this is a call/invitation notification
              const notificationData = remoteMessage.data;
              if (notificationData?.type === 'call' && notificationData?.callerId) {
                // Check if this is an invitation (has inviteId) or old call format
                if (notificationData.inviteId) {
                  // Check if we already have this invitation (socket event might have already handled it)
                  const currentInvitation = callFlowService.getCurrentInvitation();
                  if (currentInvitation && currentInvitation.inviteId === notificationData.inviteId) {
                    console.log('📱 [SocketProvider] Invitation notification received but already handled via socket event, ignoring');
                    return;
                  }
                  
                  console.log('📱 [SocketProvider] Invitation notification received, triggering handleIncomingInvitation');
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
                } else {
                  // Legacy call notification (should not happen in invitation-first architecture)
                  console.warn('📱 [SocketProvider] Received legacy call notification (no inviteId), ignoring');
                }
              }
            });
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
      console.log('Initializing call service');
      
      // Initialize the call service
      callService.initialize();
      
      // Set up listener for call state changes
      // NOTE: Only update Redux for match calls or when callFlowService isn't managing state
      // callFlowService updates Redux directly for direct calls to avoid conflicts
      callService.addEventListener('call-state-changed', (callState) => {
        console.log('Call state changed (callService):', callState);
        // Only update Redux if current state is IDLE (callFlowService isn't managing a call)
        // or if callService is resetting to IDLE
        const currentReduxState = store.getState().call.activeCall;
        if (currentReduxState.status === CallStatus.IDLE || callState.status === CallStatus.IDLE) {
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