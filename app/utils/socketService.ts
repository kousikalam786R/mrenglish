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
    // For mobile data networks, prioritize polling over websocket for better reliability
    socket = io(BASE_URL, {
      auth: { token },
      transports: ['polling', 'websocket'], // Polling first for mobile data reliability
      reconnection: true,
      reconnectionAttempts: 10, // More attempts for mobile networks
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // Longer timeout for mobile networks
      forceNew: false,
      upgrade: true, // Allow upgrade from polling to websocket if available
    });
    
    // Set up event listeners
    socket.on('connect', () => {
      console.log('✅ Socket connected successfully', socket?.id);
      console.log('   Transport:', socket.io.engine?.transport?.name || 'unknown');
      
      // CRITICAL FIX: Initialize callFlowService when socket connects
      // This ensures socket listeners are set up for incoming calls
      import('./callFlowService').then(({ default: callFlowService }) => {
        console.log('🔧 [socketService] Initializing callFlowService on socket connect');
        callFlowService.initialize();
      }).catch((error) => {
        console.error('❌ [socketService] Failed to initialize callFlowService on connect:', error);
      });
      
      // Emit connection event for services that need to re-register listeners
      socket.emit('socket-reconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      console.error('   Error type:', error.type);
      
      // Check if it's an authentication error
      if (error.message?.includes('unauthorized') || 
          error.message?.includes('401') || 
          error.message?.includes('authentication') ||
          error.type === 'UnauthorizedError') {
        console.warn('🚨 Socket connection failed due to authentication - logging out');
        import('./authUtils').then(({ forceLogoutOnError }) => {
          forceLogoutOnError('Socket authentication failed during connection');
        });
      }
    });
    
    // Track disconnection reasons and attempts for logout detection
    let disconnectCount = 0;
    let lastDisconnectTime = 0;
    const DISCONNECT_THRESHOLD = 3; // Number of disconnects before considering logout
    const DISCONNECT_WINDOW = 30000; // 30 seconds window
    
    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      
      const now = Date.now();
      
      // Check if disconnection is due to authentication issues
      if (reason === 'io server disconnect' || reason === 'unauthorized') {
        console.warn('🚨 Socket disconnected due to authentication issue - logging out');
        // Import and call force logout
        import('./authUtils').then(({ forceLogoutOnError }) => {
          forceLogoutOnError('Socket authentication failed');
        });
        return;
      }
      
      // Track disconnections for persistent server issues
      if (reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout') {
        disconnectCount++;
        lastDisconnectTime = now;
        
        // If multiple disconnects in short time, might be server issue
        if (disconnectCount >= DISCONNECT_THRESHOLD) {
          console.warn(`🚨 Multiple socket disconnections (${disconnectCount}) - possible server issue`);
          // Don't logout immediately, but track it
        }
      } else {
        // Reset counter for other disconnect reasons
        disconnectCount = 0;
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      console.log('   Socket ID:', socket?.id);
      console.log('   Transport:', socket.io.engine?.transport?.name || 'unknown');
      
      // CRITICAL FIX: Re-initialize callFlowService when socket reconnects
      // This ensures socket listeners are re-set up after reconnection
      import('./callFlowService').then(({ default: callFlowService }) => {
        console.log('🔧 [socketService] Re-initializing callFlowService on socket reconnect');
        callFlowService.reinitialize();
      }).catch((error) => {
        console.error('❌ [socketService] Failed to re-initialize callFlowService on reconnect:', error);
      });
      
      // Reset disconnect counter on successful reconnect
      disconnectCount = 0;
      
      // Emit reconnection event for services that need to refresh
      socket.emit('socket-reconnected');
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Socket reconnection attempt ${attemptNumber}...`);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('❌ Socket reconnection error:', error.message);
      
      // If reconnection fails repeatedly, might be server down
      if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
        console.warn('🚨 Socket reconnection failed due to authentication - logging out');
        import('./authUtils').then(({ forceLogoutOnError }) => {
          forceLogoutOnError('Socket reconnection authentication failed');
        });
      }
    });
    
    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed after all attempts');
      
      // If we had multiple disconnects and reconnection failed, likely server issue
      if (disconnectCount >= DISCONNECT_THRESHOLD) {
        console.warn('🚨 Persistent socket connection failures - possible server error');
        import('./authUtils').then(({ forceLogoutOnError }) => {
          forceLogoutOnError('Persistent socket connection failures');
        });
      } else {
        // Try to reinitialize one more time
        setTimeout(() => {
          console.log('🔄 Attempting to reinitialize socket...');
          initialize();
        }, 5000);
      }
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
  socketOn('user-status', callback);
};

/**
 * Listen for typing indicators
 */
export const onUserTyping = (callback: (data: TypingData) => void): void => {
  socketOn('user-typing', callback);
};

/**
 * Listen for typing stopped indicators
 */
export const onTypingStopped = (callback: (data: TypingData) => void): void => {
  socketOn('typing-stopped', callback);
};

/**
 * Listen for new messages
 */
export const onNewMessage = (callback: (data: MessageData) => void): void => {
  socketOn('new-message', callback);
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
  socketEmit('typing-stopped', { receiverId });
};

/**
 * Send a private message via socket
 */
export const sendPrivateMessage = (receiverId: string, content: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      console.warn('Socket not connected, cannot send private message');
      reject(new Error('Socket not connected'));
      return;
    }

    console.log(`📤 Sending message via socket to ${receiverId}: ${content.substring(0, 50)}...`);
    
    // Emit the message
    socket.emit('private-message', { receiverId, content });

    // Listen for the message-sent confirmation
    const timeout = setTimeout(() => {
      console.error('❌ Message sending timeout');
      reject(new Error('Message sending timeout'));
    }, 10000); // 10 second timeout

    const onMessageSent = (data: any) => {
      clearTimeout(timeout);
      if (data.success) {
        console.log('✅ Message confirmed sent via socket');
        resolve(data);
      } else {
        console.error('❌ Message sending failed:', data.error);
        reject(new Error(data.error || 'Failed to send message'));
      }
      socket?.off('message-sent', onMessageSent);
    };

    socket.once('message-sent', onMessageSent);
  });
};

/**
 * Remove all socket event listeners
 */
export const removeAllListeners = (): void => {
  if (!socket) return;
  
  // Remove common event listeners
  socket.off('user-status');
  socket.off('user-typing');
  socket.off('typing-stopped');
  socket.off('new-message');
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
  sendPrivateMessage,
  removeAllListeners
}; 