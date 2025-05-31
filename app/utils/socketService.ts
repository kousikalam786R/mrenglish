import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, DIRECT_IP, BACKUP_IPS, getAlternateUrls, BASE_URL } from './config';
import { getAuthToken } from './authUtils';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Declare the global property for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var _successfulSocketUrl: string | undefined;
}

// Interface for pending operations
interface PendingOperation {
  type: string;
  params: any;
  timestamp: number;
}

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private lastSuccessfulUrl: string | null = null;
  private remoteUserId: string | null = null;
  private currentUserReadyStatus: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private backoffTime: number = 2000; // Start with 2 seconds
  private pendingOperations: PendingOperation[] = []; // Queue for operations when socket is initializing
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Listen for network changes
    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && !this.socket?.connected && !this.isConnecting) {
        console.log('Network reconnected, attempting to reconnect socket...');
        this.initialize();
      }
    });
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public async initialize(): Promise<void> {
    // If already initializing, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('Already attempting to connect, skipping duplicate attempt');
      return Promise.resolve();
    }
    
    this.isConnecting = true;
    
    // Create a new promise for this initialization
    this.initPromise = new Promise<void>(async (resolve) => {
      try {
        // Check network status first
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          console.log('No network connection available. Will retry when network is back.');
          this.isConnecting = false;
          resolve(); // Resolve anyway to prevent hanging
          return;
        }
        
        const token = await getAuthToken();
        
        if (!token) {
          console.error('No token found for socket connection');
          this.isConnecting = false;
          resolve();
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
          this.isConnecting = false;
          this.startHeartbeat();
          this.processPendingOperations(); // Process any operations that were queued
          resolve();
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
          if (result) {
            this.isConnecting = false;
            this.backoffTime = 2000; // Reset backoff time on successful connection
            this.startHeartbeat();
            this.processPendingOperations(); // Process any operations that were queued
            resolve();
            return;
          }
        }
        
        // Try the last successful URL if available
        if (this.lastSuccessfulUrl) {
          console.log(`Trying last successful URL: ${this.lastSuccessfulUrl}`);
          const result = await this.tryConnection(this.lastSuccessfulUrl, token);
          if (result) {
            this.isConnecting = false;
            this.backoffTime = 2000; // Reset backoff time on successful connection  
            this.startHeartbeat();
            this.processPendingOperations(); // Process any operations that were queued
            resolve();
            return;
          }
        }
        
        // Get base URL without /api for Socket.IO connection
        const baseUrl = BASE_URL; // This is already without /api
        console.log(`Trying base URL (without /api): ${baseUrl}`);
        const result = await this.tryConnection(baseUrl, token);
        if (result) {
          this.isConnecting = false;
          this.backoffTime = 2000; // Reset backoff time on successful connection
          this.startHeartbeat();
          this.processPendingOperations(); // Process any operations that were queued
          resolve();
          return;
        }
        
        // For Android, prioritize the direct IP that has been working
        if (Platform.OS === 'android') {
          const directIpUrl = `http://${DIRECT_IP}:5000`;
          console.log(`Trying direct IP URL without /api: ${directIpUrl}`);
          const result = await this.tryConnection(directIpUrl, token);
          if (result) {
            this.isConnecting = false;
            this.backoffTime = 2000; // Reset backoff time on successful connection
            this.startHeartbeat();
            this.processPendingOperations(); // Process any operations that were queued
            resolve();
            return;
          }
        }
        
        // Last resort - try other URLs from getAlternateUrls
        const alternateUrls = getAlternateUrls();
        for (const url of alternateUrls) {
          if (!url.includes('/api')) {
            console.log(`Trying alternate URL: ${url}`);
            const result = await this.tryConnection(url, token);
            if (result) {
              this.isConnecting = false;
              this.backoffTime = 2000; // Reset backoff time on successful connection
              this.startHeartbeat();
              this.processPendingOperations(); // Process any operations that were queued
              resolve();
              return;
            }
          }
        }
        
        // Only if all base URLs fail, try the API URLs
        console.log('All base URLs failed, trying API URLs as last resort');
        const apiResult = await this.tryConnection(API_URL, token);
        if (apiResult) {
          this.isConnecting = false;
          this.backoffTime = 2000; // Reset backoff time on successful connection
          this.startHeartbeat();
          this.processPendingOperations(); // Process any operations that were queued
          resolve();
          return;
        }
        
        // If we get here, all connection attempts failed
        console.log('All connection attempts failed. Will try again with exponential backoff.');
        this.scheduleReconnection();
        resolve(); // Resolve anyway to avoid hanging promises
        
      } catch (error) {
        console.error('Error initializing socket:', error);
        this.scheduleReconnection();
        resolve(); // Resolve anyway to avoid hanging promises
      } finally {
        this.isConnecting = false;
        this.initPromise = null; // Clear the promise so we can try again
      }
    });
    
    return this.initPromise;
  }

  // Queue operations when socket is not available
  private queueOperation(type: string, params: any): void {
    console.log(`Socket not available, queuing operation: ${type}`);
    this.pendingOperations.push({
      type,
      params,
      timestamp: Date.now()
    });
    
    // Auto-initialize the socket if needed
    if (!this.socket && !this.isConnecting) {
      console.log('Auto-initializing socket for queued operation');
      this.initialize();
    } else if (this.pendingOperations.length === 1) {
      // If this is the first operation in the queue, set a timeout to process
      // This ensures operations don't get stuck if connection succeeds
      setTimeout(() => this.processPendingOperations(), 5000);
    }
  }
  
  // Process any pending operations after connection is established
  private processPendingOperations(): void {
    if (this.pendingOperations.length === 0) {
      return;
    }
    
    console.log(`Processing ${this.pendingOperations.length} pending operations`);
    
    // Only process operations if we have a socket
    if (!this.socket || !this.socket.connected) {
      console.log('Socket still not connected, keeping operations in queue');
      return;
    }
    
    // Process operations in order, remove any that are older than 2 minutes
    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
    const validOperations = this.pendingOperations.filter(op => op.timestamp >= twoMinutesAgo);
    
    if (validOperations.length < this.pendingOperations.length) {
      console.log(`Discarded ${this.pendingOperations.length - validOperations.length} stale operations`);
    }
    
    // Process valid operations
    validOperations.forEach(operation => {
      try {
        console.log(`Processing queued operation: ${operation.type}`);
        switch (operation.type) {
          case 'set-ready-to-talk':
            this.socket?.emit('set-ready-to-talk', operation.params);
            break;
          case 'get-ready-users':
            this.socket?.emit('get-ready-users');
            break;
          case 'find-random-partner':
            this.socket?.emit('find-random-partner');
            break;
          case 'private-message':
            this.socket?.emit('private-message', operation.params);
            break;
          case 'call-offer':
          case 'call-answer':
          case 'call-end':
          case 'call-ice-candidate':
            this.socket?.emit(operation.type, operation.params);
            break;
          default:
            console.log(`Unknown operation type: ${operation.type}`);
        }
      } catch (error) {
        console.error(`Error processing operation ${operation.type}:`, error);
      }
    });
    
    // Clear the queue
    this.pendingOperations = [];
  }
  
  private scheduleReconnection(): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    console.log(`Scheduling reconnection in ${this.backoffTime / 1000} seconds`);
    
    // Schedule reconnection with current backoff time
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting reconnection after backoff...');
      this.initialize();
    }, this.backoffTime);
    
    // Increase backoff time for next attempt (capped at 60 seconds)
    this.backoffTime = Math.min(this.backoffTime * 1.5, 60000);
  }
  
  // Implement a heartbeat to proactively detect disconnections
  private startHeartbeat(): void {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Set up a new heartbeat
    this.heartbeatInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) {
        console.log('Heartbeat detected disconnection. Attempting to reconnect...');
        // Socket is disconnected, try to reconnect
        this.clearHeartbeat();
        this.initialize();
        return;
      }
      
      // Send a ping to keep the connection alive
      this.socket.emit('ping');
      console.log('Heartbeat ping sent to server');
      
    }, 15000); // Check every 15 seconds
    
    console.log('Started heartbeat interval to maintain connection');
  }
  
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private async tryConnection(url: string, token: string): Promise<boolean> {
    this.connectionAttempts++;
    console.log(`Connection attempt ${this.connectionAttempts} to ${url}`);
    
    try {
      // IMPORTANT: Socket.IO must NOT use the /api endpoint
      // Remove /api from the URL if present
      const socketsUrl = url.endsWith('/api') ? url.substring(0, url.length - 4) : url;
      
      console.log(`Cleaned socket URL (without /api): ${socketsUrl}`);
      
      // Create socket with current URL - using more aggressive settings for mobile
      this.socket = io(socketsUrl, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 5000,        // Increased delay between attempts for mobile networks
        reconnectionAttempts: 10,       // Increased number of attempts
        transports: ['polling', 'websocket'], // Start with polling first
        timeout: 20000,                 // Shorter timeout for initial connection
        autoConnect: true,
        forceNew: true,
        ackTimeout: 30000,              // Reduced timeout for acknowledgments
        upgrade: true,                  // Attempt to upgrade to websocket after establishing polling connection
        extraHeaders: {                 // Add extra headers that might help with connection
          "Authorization": `Bearer ${token}`,
          "Access-Control-Allow-Origin": "*"
        }
      });
      
      // Set up a promise that resolves on connect or rejects on error
      const connectionPromise = new Promise<boolean>((resolve, reject) => {
        // Set a timeout for the connection attempt - shorter timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 20000);
        
        if (!this.socket) {
          console.log('Creating new socket connection to:', socketsUrl);
          console.log('Connection options:', {
            auth: 'token provided',
            reconnection: true,
            transports: ['polling', 'websocket'],
            timeout: 20000
          });
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
      
      return false;
    }
  }
  
  // Helper method to set up event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected successfully:', this.socket?.id);
      console.log('Using transport:', this.socket?.io?.engine?.transport?.name);
      this.backoffTime = 2000; // Reset backoff on successful connection
      this.startHeartbeat(); // Start heartbeat when connected
      this.processPendingOperations(); // Process any operations that were queued
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.scheduleReconnection();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      // If the server disconnected us, we should try to reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.scheduleReconnection();
      }
      
      // Socket.IO will automatically try to reconnect for other reasons
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      
      // Attempt to reconnect after error
      if (this.socket) {
        console.log('Attempting to reconnect after socket error...');
        this.scheduleReconnection();
      }
    });
    
    // Add handler for pong response from server
    this.socket.on('pong', () => {
      console.log('Received pong from server');
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
    
    // Set up ready-to-talk listener
    this.socket.on('user-ready-status', (data) => {
      console.log('User ready status update received:', data);
      if (data && data.userId) {
        console.log(`User ${data.userId} ready status: ${data.isReady}`);
      }
    });
    
    // Set up ready users list listener
    this.socket.on('ready-users-list', (data) => {
      console.log(`Received ${data.users?.length || 0} ready users`);
    });
    
    // Set up random partner result listener
    this.socket.on('random-partner-result', (data) => {
      console.log('Random partner result received:', data.success);
    });
    
    // Set up partner found listener
    this.socket.on('partner-found', (data) => {
      console.log('Partner found notification received');
    });
  }

  public disconnect(): void {
    this.clearHeartbeat(); // Stop heartbeat
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  // Enhanced methods with auto-reconnect and operation queuing
  public sendPrivateMessage(receiverId: string, content: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation and initialize the socket
      this.queueOperation('private-message', { receiverId, content });
      return;
    }
    
    // Log sending attempt
    console.log('Attempting to send message to:', receiverId);
    
    // ID doesn't need to be validated here - let the server handle validation
    // This allows messages to be sent regardless of ID format
    this.socket.emit('private-message', { receiverId, content });
  }

  public startTyping(receiverId: string): void {
    if (!this.socket || !this.socket.connected) {
      // No need to queue typing indicators, they're transient
      return;
    }
    this.socket.emit('typing', { receiverId });
  }

  public stopTyping(receiverId: string): void {
    if (!this.socket || !this.socket.connected) {
      // No need to queue typing indicators, they're transient
      return;
    }
    this.socket.emit('typing-stopped', { receiverId });
  }

  // Event handlers with auto-reconnect
  public onNewMessage(callback: (data: any) => void): void {
    // Initialize socket if needed
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    // Set up callback for when socket is eventually connected
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  public onMessageSent(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('message-sent', callback);
    }
  }

  public onUserTyping(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  public onTypingStopped(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('typing-stopped', callback);
    }
  }

  public onUserStatus(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('user-status', callback);
    }
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

  // Call-related methods with auto-reconnect
  public sendCallOffer(targetUserId: string, sdp: string, type: string, isVideo: boolean = false): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('call-offer', { targetUserId, sdp, type, isVideo });
      return;
    }
    
    console.log(`Sending call offer to ${targetUserId}`);
    this.socket.emit('call-offer', { targetUserId, sdp, type, isVideo });
  }
  
  public sendCallAnswer(targetUserId: string, sdp: string, type: string, accepted: boolean): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('call-answer', { targetUserId, sdp, type, accepted });
      return;
    }
    
    console.log(`Sending call answer to ${targetUserId}: ${accepted ? 'accepted' : 'rejected'}`);
    this.socket.emit('call-answer', { targetUserId, sdp, type, accepted });
  }
  
  public sendCallEnd(targetUserId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('call-end', { targetUserId });
      return;
    }
    
    console.log(`Sending call end to ${targetUserId}`);
    this.socket.emit('call-end', { targetUserId });
  }
  
  public sendIceCandidate(targetUserId: string, candidate: string, sdpMid: string, sdpMLineIndex: number): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('call-ice-candidate', { targetUserId, candidate, sdpMid, sdpMLineIndex });
      return;
    }
    
    this.socket.emit('call-ice-candidate', { targetUserId, candidate, sdpMid, sdpMLineIndex });
  }
  
  public onCallOffer(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('call-offer', callback);
    }
  }
  
  public onCallAnswer(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('call-answer', callback);
    }
  }
  
  public onCallEnd(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('call-end', callback);
    }
  }
  
  public onIceCandidate(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('call-ice-candidate', callback);
    }
  }

  // Set remote user ID for active call
  public setRemoteUserId(userId: string): void {
    this.remoteUserId = userId;
  }

  // Get remote user ID for active call
  public getRemoteUserId(): string | null {
    return this.remoteUserId;
  }

  // Ready-to-talk related methods with auto-reconnect
  public setReadyToTalk(status: boolean, additionalData: any = {}): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation and initialize the socket
      this.queueOperation('set-ready-to-talk', { status, ...additionalData });
      return;
    }
    
    console.log(`Setting ready to talk status to: ${status}`);
    this.currentUserReadyStatus = status;
    
    this.socket.emit('set-ready-to-talk', { 
      status, 
      ...additionalData 
    });
  }
  
  public getReadyToTalkUsers(): void {
    if (!this.socket || !this.socket.connected) {
      console.log('Socket not initialized, attempting to connect before getting ready users');
      // Queue the operation and initialize the socket
      this.queueOperation('get-ready-users', {});
      this.initialize();
      return;
    }
    
    console.log('Requesting ready to talk users');
    this.socket.emit('get-ready-users');
  }
  
  public findRandomPartner(): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation and initialize the socket
      this.queueOperation('find-random-partner', {});
      this.initialize();
      return;
    }
    
    console.log('Finding random partner');
    this.socket.emit('find-random-partner');
  }
  
  public isUserReady(): boolean {
    return this.currentUserReadyStatus;
  }
  
  public onReadyStatusUpdated(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('ready-status-updated', callback);
    }
  }
  
  public onUserReadyStatus(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('user-ready-status', callback);
    }
  }
  
  public onReadyUsersList(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('ready-users-list', callback);
    }
  }
  
  public onRandomPartnerResult(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('random-partner-result', callback);
    }
  }
  
  public onPartnerFound(callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      this.initialize();
    }
    
    if (this.socket) {
      this.socket.on('partner-found', callback);
    }
  }

  // Call-room related methods with auto-reconnect
  public joinCallRoom(roomId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('join-call-room', { roomId });
      this.initialize();
      return;
    }
    
    this.socket.emit('join-call-room', { roomId });
  }

  public leaveCallRoom(roomId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Not critical to queue, but initialize socket for future operations
      this.initialize();
      return;
    }
    
    this.socket.emit('leave-call-room', { roomId });
  }

  // Video upgrade methods with auto-reconnect
  public requestVideoUpgrade(userId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('video-upgrade-request', { targetUserId: userId });
      this.initialize();
      return;
    }
    
    console.log(`Requesting video upgrade to user: ${userId}`);
    this.socket.emit('video-upgrade-request', { targetUserId: userId });
  }

  public acceptVideoUpgrade(userId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('video-upgrade-accepted', { targetUserId: userId });
      this.initialize();
      return;
    }
    
    console.log(`Accepting video upgrade from user: ${userId}`);
    this.socket.emit('video-upgrade-accepted', { targetUserId: userId });
  }

  public rejectVideoUpgrade(userId: string): void {
    if (!this.socket || !this.socket.connected) {
      // Queue the operation
      this.queueOperation('video-upgrade-rejected', { targetUserId: userId });
      this.initialize();
      return;
    }
    
    console.log(`Rejecting video upgrade from user: ${userId}`);
    this.socket.emit('video-upgrade-rejected', { targetUserId: userId });
  }

  // Ensure socket is connected
  public async ensureConnected(): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }
    
    try {
      await this.initialize();
      return this.socket?.connected || false;
    } catch (e) {
      console.error('Failed to ensure socket connection:', e);
      return false;
    }
  }
}

export default SocketService.getInstance();