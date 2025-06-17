import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { BASE_URL } from './config';
import { getAuthToken } from './authUtils';

// Socket.io instance
let socket: Socket | null = null;
let isInitializing = false;

// Type definitions for event data
interface UserStatusData {
  userId: string;
  status: 'online' | 'offline';
}

interface TypingData {
  userId: string;
  chatId?: string;
}

interface MessageData {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt: string;
  read: boolean;
}

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

/**
 * Listen for user status changes
 */
export const onUserStatus = (callback: (data: UserStatusData) => void): void => {
  socketOn('user_status', callback);
};

/**
 * Listen for typing indicators
 */
export const onUserTyping = (callback: (data: TypingData) => void): void => {
  socketOn('typing', callback);
};

/**
 * Listen for typing stopped indicators
 */
export const onTypingStopped = (callback: (data: TypingData) => void): void => {
  socketOn('typing_stopped', callback);
};

/**
 * Listen for new messages
 */
export const onNewMessage = (callback: (data: MessageData) => void): void => {
  socketOn('new_message', callback);
};

/**
 * Send typing indicator to server
 */
export const startTyping = (receiverId: string): void => {
  socketEmit('typing', { receiverId });
};

/**
 * Send typing stopped indicator to server
 */
export const stopTyping = (receiverId: string): void => {
  socketEmit('typing_stopped', { receiverId });
};

/**
 * Remove all socket event listeners
 */
export const removeAllListeners = (): void => {
  if (!socket) return;
  
  // Remove common event listeners
  socket.off('user_status');
  socket.off('typing');
  socket.off('typing_stopped');
  socket.off('new_message');
};

// Default export for backward compatibility
export default {
  initialize,
  getSocket,
  disconnect,
  socketEmit,
  socketOn,
  socketOff,
  storeUserData,
  onUserStatus,
  onUserTyping,
  onTypingStopped,
  onNewMessage,
  startTyping,
  stopTyping,
  removeAllListeners
}; 