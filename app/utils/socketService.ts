import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, DIRECT_IP } from './config';
import { getAuthToken } from './authUtils';
import { Platform } from 'react-native';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

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

      console.log('Connecting to socket with token:', token.substring(0, 10) + '...');
      
      // Use direct LAN IP for Android emulators
      let socketUrl = API_URL;
      
      // For Android emulators, direct LAN IP works best based on testing
      if (Platform.OS === 'android') {
        // Use direct LAN IP from config
        socketUrl = `http://${DIRECT_IP}:5000`;
        console.log('Using direct LAN IP for socket connection:', socketUrl);
      }

      // Try to ping the server first to check connectivity
      try {
        console.log('Testing server connectivity before socket connection...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${socketUrl}/`, { 
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('Server ping successful:', await response.text());
      } catch (pingError: any) {
        console.warn('Server ping failed:', pingError.message, 
          'Attempting socket connection anyway...');
      }

      this.socket = io(socketUrl, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
        extraHeaders: {
          Authorization: `Bearer ${token}`
        },
        timeout: 30000, // Increased timeout
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        console.error('Socket connection error details:', error);
        
        // Log additional debug info
        console.log('Connection URL:', socketUrl);
        console.log('Token status:', token ? 'Present' : 'Missing');
        console.log('Socket options:', {
          reconnection: true,
          reconnectionAttempts: 5,
          timeout: 30000
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
    } catch (error) {
      console.error('Error initializing socket:', error);
    }
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
}

export default SocketService.getInstance(); 