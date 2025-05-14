import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from './socketService';
import callService from './callService';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { getAuthToken, getUserIdFromToken } from './authUtils';
import { setCallState } from '../redux/slices/callSlice';

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
      callService.addEventListener('call-state-changed', (callState) => {
        console.log('Call state changed:', callState);
        dispatch(setCallState(callState));
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