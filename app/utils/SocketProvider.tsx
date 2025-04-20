import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from './socketService';
import { useAuth } from '../navigation';
import { getAuthToken, getUserIdFromToken } from './authUtils';

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
  const { isSignedIn } = useAuth();

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
      if (socket && socket.id && !userId) {
        await AsyncStorage.setItem('userId', socket.id);
      }
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      setIsConnected(false);
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