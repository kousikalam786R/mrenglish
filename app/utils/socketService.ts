import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, DIRECT_IP, BACKUP_IPS, getAlternateUrls } from './config';
import { getAuthToken } from './authUtils';
import { Platform } from 'react-native';

// Declare the global property for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var _successfulSocketUrl: string | undefined;
}

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private lastSuccessfulUrl: string | null = null;
  private remoteUserId: string | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const token = await getAuthToken();
      
      if (!token) {
        console.error('No token found for socket connection');
        return;
      }

      // Extract userID from token for debugging
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('Token payload for socket connection:', payload);
          console.log('User ID from token:', payload.id);
        }
      } catch (e) {
        console.error('Error parsing token:', e);
      }

      console.log('Connecting to socket with token:', token.substring(0, 10) + '...');
      
      // Only try to connect if there's no existing connection
      if (this.socket && this.socket.connected) {
        console.log('Socket already connected, reusing connection:', this.socket.id);
        return;
      }
      
      // If there's an existing socket that's not connected, disconnect it
      if (this.socket) {
        console.log('Disconnecting existing socket before creating new one');
        this.socket.disconnect();
        this.socket = null;
      }

      // Reset connection attempts
      this.connectionAttempts = 0;
      
      // Use the global successful URL if available
      if (global._successfulSocketUrl) {
        console.log(`Trying previously successful URL: ${global._successfulSocketUrl}`);
        const result = await this.tryConnection(global._successfulSocketUrl, token);
        if (result) return;
      }
      
      // Try the last successful URL if available
      if (this.lastSuccessfulUrl) {
        console.log(`Trying last successful URL: ${this.lastSuccessfulUrl}`);
        const result = await this.tryConnection(this.lastSuccessfulUrl, token);
        if (result) return;
      }
      
      // For Android, prioritize the direct IP that has been working
      if (Platform.OS === 'android') {
        const directIpUrl = `http://${DIRECT_IP}:5000/api`;
        console.log(`Trying direct IP URL: ${directIpUrl}`);
        const result = await this.tryConnection(directIpUrl, token);
        if (result) return;
      }
      
      // Try to connect with main URL
      await this.tryConnection(API_URL, token);
    } catch (error) {
      console.error('Error initializing socket:', error);
    }
  }
  
  private async tryConnection(url: string, token: string): Promise<boolean> {
    this.connectionAttempts++;
    console.log(`Connection attempt ${this.connectionAttempts} to ${url}`);
    
    try {
      // Socket.IO uses the namespace format without '/api' - this is likely causing the "Invalid namespace" error
      // Just use the base URL without appending '/api' as the namespace
      const socketsUrl = url.endsWith('/api') ? url.substring(0, url.length - 4) : url;
      
      console.log(`Connecting to socket URL: ${socketsUrl}`);
      
      // Create socket with current URL - start with polling first, then try to upgrade to websocket
      this.socket = io(socketsUrl, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 2000,        // Increase delay between attempts
        reconnectionAttempts: 5,        // Increase number of attempts
        transports: ['polling', 'websocket'], // Start with polling first
        timeout: 20000,                 // Increased timeout
        autoConnect: true,
        forceNew: true,
        upgrade: true,                  // Attempt to upgrade to websocket after establishing polling connection
        extraHeaders: {                 // Add extra headers that might help with connection
          "Authorization": `Bearer ${token}`,
          "Access-Control-Allow-Origin": "*"
        }
      });
      
      // Set up a promise that resolves on connect or rejects on error
      const connectionPromise = new Promise<boolean>((resolve, reject) => {
        // Set a timeout for the connection attempt
        const timeoutId = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000);
        
        if (!this.socket) {
          clearTimeout(timeoutId);
          reject(new Error('Socket not created'));
          return;
        }
        
        this.socket.on('connect', () => {
          clearTimeout(timeoutId);
          console.log('Socket connected successfully:', this.socket?.id);
          console.log('Using transport:', this.socket?.io?.engine?.transport?.name);
          
          // Store the successful URL
          this.lastSuccessfulUrl = url;
          global._successfulSocketUrl = url;
          
          resolve(true);
        });
        
        this.socket.on('connect_error', (error) => {
          console.error(`Socket connect_error to ${url}:`, error.message);
          clearTimeout(timeoutId);
          reject(error);
        });
      });
      
      // Wait for connection or error
      await connectionPromise;
      
      // If we get here, connection was successful
      this.setupEventListeners();
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${url}:`, error);
      
      // Clean up failed socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      // Try next fallback if we have attempts left
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        // Get alternate URLs and try the next one
        const alternateUrls = getAlternateUrls();
        const nextUrlIndex = this.connectionAttempts % alternateUrls.length;
        const nextUrl = alternateUrls[nextUrlIndex];
        
        console.log(`Trying fallback URL: ${nextUrl}`);
        return this.tryConnection(nextUrl, token);
      } else {
        console.error('Maximum connection attempts reached. Could not connect to any server.');
        
        // Last resort: try polling only on the DIRECT_IP with extended timeout
        // Using the direct IP that has been shown to work in profileService
        console.log('Trying final attempt with polling transport only and extended timeout...');
        try {
          const finalUrl = `http://${DIRECT_IP}:5000`;
          console.log(`Final attempt using: ${finalUrl}`);
          
          this.socket = io(finalUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 2000,          // Increased delay
            reconnectionAttempts: 3,          // Increased attempts
            transports: ['polling'],          // Polling only as last resort
            timeout: 45000,                   // Much longer timeout for last attempt
            autoConnect: true,
            forceNew: true,
            upgrade: false,                   // Disable upgrade attempts to keep polling
            extraHeaders: {                   // Add extra headers that might help with connection
              "Authorization": `Bearer ${token}`,
              "Access-Control-Allow-Origin": "*"
            }
          });
          
          // Add specific listener for this last attempt
          const finalPromise = new Promise<boolean>((resolve, reject) => {
            const finalTimeoutId = setTimeout(() => {
              if (this.socket && !this.socket.connected) {
                reject(new Error('Final connection attempt timed out'));
              }
            }, 30000);
            
            if (!this.socket) {
              clearTimeout(finalTimeoutId);
              reject(new Error('Socket not created in final attempt'));
              return;
            }
            
            this.socket.on('connect', () => {
              clearTimeout(finalTimeoutId);
              console.log('Final attempt socket connected successfully:', this.socket?.id);
              console.log('Using transport:', this.socket?.io?.engine?.transport?.name);
              
              // Store the successful URL
              this.lastSuccessfulUrl = finalUrl;
              global._successfulSocketUrl = finalUrl;
              
              resolve(true);
            });
            
            this.socket.on('connect_error', (error) => {
              clearTimeout(finalTimeoutId);
              console.error('Final attempt connect error:', error.message);
              reject(error);
            });
          });
          
          await finalPromise;
          this.setupEventListeners();
          return true;
        } catch (e) {
          console.error('Final connection attempt failed:', e);
          return false;
        }
      }
    }
  }
  
  // Helper method to set up event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected successfully:', this.socket?.id);
      console.log('Using transport:', this.socket?.io?.engine?.transport?.name);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Set up user status listener with more detailed logging
    this.socket.on('user-status', (data) => {
      console.log('User status update received:', data);
      if (data && data.userId) {
        console.log(`User ${data.userId} is now ${data.status}`);
      }
    });
    
    // Set up new message listener
    this.socket.on('new-message', (data) => {
      console.log('New message received');
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public sendPrivateMessage(receiverId: string, content: string): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    
    // Log sending attempt
    console.log('Attempting to send message to:', receiverId);
    
    // ID doesn't need to be validated here - let the server handle validation
    // This allows messages to be sent regardless of ID format
    this.socket.emit('private-message', { receiverId, content });
  }

  public startTyping(receiverId: string): void {
    if (!this.socket) return;
    this.socket.emit('typing', { receiverId });
  }

  public stopTyping(receiverId: string): void {
    if (!this.socket) return;
    this.socket.emit('typing-stopped', { receiverId });
  }

  public onNewMessage(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('new-message', callback);
  }

  public onMessageSent(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('message-sent', callback);
  }

  public onUserTyping(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('user-typing', callback);
  }

  public onTypingStopped(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('typing-stopped', callback);
  }

  public onUserStatus(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('user-status', callback);
  }

  public removeAllListeners(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
  }

  public storeUserData(userData: any): void {
    if (!userData) return;
    
    console.log('Storing user data from socket:', userData);
    
    // Store the user data in AsyncStorage
    try {
      AsyncStorage.setItem('user', JSON.stringify(userData))
        .then(() => console.log('Successfully stored user data from socket'))
        .catch(err => console.error('Error storing user data from socket:', err));
    } catch (error) {
      console.error('Error in storeUserData:', error);
    }
  }

  // Call-related methods
  public sendCallOffer(targetUserId: string, sdp: string, type: string, isVideo: boolean = false): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    
    console.log(`Sending call offer to ${targetUserId}`);
    this.socket.emit('call-offer', { targetUserId, sdp, type, isVideo });
  }
  
  public sendCallAnswer(targetUserId: string, sdp: string, type: string, accepted: boolean): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    
    console.log(`Sending call answer to ${targetUserId}: ${accepted ? 'accepted' : 'rejected'}`);
    this.socket.emit('call-answer', { targetUserId, sdp, type, accepted });
  }
  
  public sendCallEnd(targetUserId: string): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    
    console.log(`Sending call end to ${targetUserId}`);
    this.socket.emit('call-end', { targetUserId });
  }
  
  public sendIceCandidate(targetUserId: string, candidate: string, sdpMid: string, sdpMLineIndex: number): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    
    this.socket.emit('call-ice-candidate', { targetUserId, candidate, sdpMid, sdpMLineIndex });
  }
  
  public onCallOffer(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('call-offer', callback);
  }
  
  public onCallAnswer(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('call-answer', callback);
  }
  
  public onCallEnd(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('call-end', callback);
  }
  
  public onIceCandidate(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('call-ice-candidate', callback);
  }

  // Set remote user ID for active call
  public setRemoteUserId(userId: string): void {
    this.remoteUserId = userId;
  }

  // Get remote user ID for active call
  public getRemoteUserId(): string | null {
    return this.remoteUserId;
  }
}

export default SocketService.getInstance();