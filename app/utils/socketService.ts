import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { BASE_URL } from './config';
import { getAuthToken } from './authUtils';

// Socket.io instance
let socket: Socket | null = null;
let isInitializing = false;

/**
 * Initialize the socket connection
 */
export const initialize = async (): Promise<void> => {
  // Prevent multiple simultaneous initialization attempts
  if (isInitializing) {
    console.log('Socket already initializing');
    return;
  }
  
  // If socket is already connected, do nothing
  if (socket?.connected) {
    console.log('Socket already connected');
    return;
  }
  
  isInitializing = true;
  
  try {
    // Get auth token
    const token = await getAuthToken();
    
    if (!token) {
      console.error('No token available for socket connection');
      isInitializing = false;
      return;
    }
    
    // Close existing socket if any
    if (socket) {
      socket.close();
      socket = null;
    }
    
    // Initialize new socket connection
    socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Set up event listeners
    socket.on('connect', () => {
      console.log('Socket connected successfully', socket?.id);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
  } catch (error) {
    console.error('Error initializing socket:', error);
  } finally {
    isInitializing = false;
  }
};

/**
 * Get the socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Disconnect the socket
 */
export const disconnect = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit an event to the server
 */
export const socketEmit = (event: string, data: any): void => {
  if (!socket) {
    console.warn(`Socket not connected, can't emit ${event}`);
    initialize(); // Try to initialize
    return;
  }
  
  socket.emit(event, data);
};

/**
 * Listen for an event
 */
export const socketOn = (event: string, callback: (data: any) => void): void => {
  if (!socket) {
    console.warn(`Socket not connected, can't listen for ${event}`);
    initialize(); // Try to initialize
    return;
  }
  
  socket.on(event, callback);
};

/**
 * Stop listening for an event
 */
export const socketOff = (event: string, callback?: (data: any) => void): void => {
  if (!socket) return;
  
  if (callback) {
    socket.off(event, callback);
  } else {
    socket.off(event);
  }
};

/**
 * Store user data in AsyncStorage
 */
export const storeUserData = (userData: any): void => {
  if (!userData) return;
  
  console.log('Storing user data from socket');
  
  // Store user data in AsyncStorage
  AsyncStorage.setItem('user', JSON.stringify(userData))
    .then(() => console.log('User data stored successfully'))
    .catch(err => console.error('Error storing user data:', err));
};

// Default export for backward compatibility
export default {
  initialize,
  getSocket,
  disconnect,
  socketEmit,
  socketOn,
  socketOff,
  storeUserData
}; 