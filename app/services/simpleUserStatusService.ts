import socketService from '../utils/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
  isTyping?: boolean;
  typingInChat?: string;
  isOnCall?: boolean;
  callStartTime?: string;
}

export interface UserStatusUpdate {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

class SimpleUserStatusService {
  private userStatuses: Map<string, UserStatus> = new Map();
  private currentUserId: string | null = null;
  private isInitialized = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusUpdateCallbacks: Set<(statuses: Map<string, UserStatus>) => void> = new Set();

  constructor() {
    // Initialize
  }

  /**
   * Initialize the user status service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔧 SimpleUserStatusService: Initializing...');

    try {
      // Get current user ID
      this.currentUserId = await this.getCurrentUserId();
      console.log('🔧 SimpleUserStatusService: Current user ID:', this.currentUserId);

      // Initialize socket service
      socketService.initialize();

      // Set up socket event listeners
      this.setupSocketListeners();

      // Start heartbeat to keep status updated
      this.startHeartbeat();

      this.isInitialized = true;
      console.log('✅ SimpleUserStatusService: Initialized successfully');

    } catch (error) {
      console.error('❌ SimpleUserStatusService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get current user ID from storage
   */
  private async getCurrentUserId(): Promise<string> {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) return userId;

      // Fallback to user object
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const user = JSON.parse(userJson);
        return user._id || user.id || '';
      }

      return '';
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return '';
    }
  }

  /**
   * Set up socket event listeners for user status updates
   */
  private setupSocketListeners(): void {
    console.log('🔧 SimpleUserStatusService: Setting up socket listeners...');

    // Listen for user status updates (single user)
    socketService.socketOn('user-status', (data: any) => {
      console.log('📡 SimpleUserStatusService: Received user-status event:', data);
      
      // Handle both old and new data formats
      let userStatusData: UserStatusUpdate;
      
      if (data.status !== undefined) {
        // New format: { userId, status: 'online'|'offline', lastSeen }
        userStatusData = {
          userId: data.userId,
          isOnline: data.status === 'online',
          lastSeenAt: data.lastSeen ? new Date(data.lastSeen).toISOString() : undefined
        };
      } else {
        // Old format: { userId, isOnline, lastSeenAt }
        userStatusData = data as UserStatusUpdate;
      }
      
      console.log('📡 SimpleUserStatusService: Processed user status data:', userStatusData);
      this.updateUserStatus(userStatusData);
    });

    // Listen for bulk user status updates (multiple users at once)
    socketService.socketOn('bulk-user-statuses', (data: any) => {
      console.log(`📡 SimpleUserStatusService: Received bulk status for ${data.statuses?.length || 0} users`);
      
      if (data.statuses && Array.isArray(data.statuses)) {
        data.statuses.forEach((statusData: any) => {
          const userStatusData: UserStatusUpdate = {
            userId: statusData.userId,
            isOnline: statusData.status === 'online',
            lastSeenAt: statusData.lastSeen ? new Date(statusData.lastSeen).toISOString() : undefined
          };
          this.updateUserStatus(userStatusData);
        });
        console.log(`✅ SimpleUserStatusService: Updated ${data.statuses.length} user statuses from bulk response`);
      }
    });

    // Listen for typing indicators
    socketService.socketOn('user-typing', (data: { userId: string, chatId: string }) => {
      console.log('⌨️ SimpleUserStatusService: User typing:', data);
      this.setUserTyping(data.userId, true, data.chatId);
    });

    socketService.socketOn('typing-stopped', (data: { userId: string }) => {
      console.log('⌨️ SimpleUserStatusService: User stopped typing:', data);
      this.setUserTyping(data.userId, false);
    });

    // Listen for call status updates
    socketService.socketOn('user-call-started', (data: { userId: string, callStartTime?: string }) => {
      console.log('📞 SimpleUserStatusService: User started call:', data);
      this.setUserCallStatus(data.userId, true, data.callStartTime);
    });

    socketService.socketOn('user-call-ended', (data: { userId: string }) => {
      console.log('📞 SimpleUserStatusService: User ended call:', data);
      this.setUserCallStatus(data.userId, false);
    });

    // Listen for connection status changes
    socketService.socketOn('connect', () => {
      console.log('🔗 SimpleUserStatusService: Socket connected');
      this.requestAllUserStatuses();
      
      // Force refresh all tracked users after a short delay
      setTimeout(() => {
        this.refreshAllUserStatuses();
      }, 2000);
    });

    socketService.socketOn('disconnect', () => {
      console.log('🔌 SimpleUserStatusService: Socket disconnected');
      this.setAllUsersOffline();
    });
  }

  /**
   * Start heartbeat to keep user status updated
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        // Send user activity to update last seen
        socket.emit('user-activity');
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Request status for all users we're tracking (bulk request)
   */
  private requestAllUserStatuses(): void {
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      console.log('📡 SimpleUserStatusService: Socket not connected, cannot request bulk status');
      return;
    }

    // Collect all user IDs we're tracking (excluding current user)
    const userIds: string[] = [];
    this.userStatuses.forEach((status, userId) => {
      if (userId !== this.currentUserId) {
        userIds.push(userId);
      }
    });

    if (userIds.length === 0) {
      console.log('📡 SimpleUserStatusService: No users to track');
      return;
    }

    console.log(`📡 SimpleUserStatusService: Requesting bulk status for ${userIds.length} users`);
    
    // Request bulk status for all users at once
    socket.emit('get-bulk-user-statuses', { userIds });
  }

  /**
   * Force refresh all user statuses (useful after reconnection)
   */
  private refreshAllUserStatuses(): void {
    console.log('🔄 SimpleUserStatusService: Force refreshing all user statuses');
    
    // Reset all statuses to unknown
    this.userStatuses.forEach((status, userId) => {
      if (userId !== this.currentUserId) {
        this.userStatuses.set(userId, {
          ...status,
          isOnline: false,
          lastSeenAt: undefined
        });
      }
    });
    
    // Request bulk status for all users at once
    this.requestAllUserStatuses();
    
    // Notify callbacks of the refresh
    this.notifyStatusUpdate();
  }

  /**
   * Update user status and notify callbacks
   */
  private updateUserStatus(data: UserStatusUpdate): void {
    const { userId, isOnline, lastSeenAt } = data;
    
    // Only update if we're tracking this user
    if (!this.userStatuses.has(userId)) {
      console.log('📊 SimpleUserStatusService: Received status update for untracked user:', userId);
      return;
    }
    
    const currentStatus = this.userStatuses.get(userId);
    const newStatus: UserStatus = {
      userId,
      isOnline,
      lastSeenAt,
      isTyping: currentStatus?.isTyping || false,
      typingInChat: currentStatus?.typingInChat
    };

    // Only update if status actually changed
    const statusChanged = !currentStatus || 
      currentStatus.isOnline !== newStatus.isOnline || 
      currentStatus.lastSeenAt !== newStatus.lastSeenAt;

    if (statusChanged) {
      this.userStatuses.set(userId, newStatus);

      console.log('📊 SimpleUserStatusService: Updated status for user:', {
        userId,
        isOnline,
        lastSeenAt,
        hasCallbacks: this.statusUpdateCallbacks.size > 0,
        previousStatus: currentStatus?.isOnline
      });

      // Notify all callbacks
      this.notifyStatusUpdate();
    } else {
      console.log('📊 SimpleUserStatusService: Status unchanged for user:', userId);
    }
  }

  /**
   * Set user typing status
   */
  private setUserTyping(userId: string, isTyping: boolean, chatId?: string): void {
    const currentStatus = this.userStatuses.get(userId) || {
      userId,
      isOnline: false,
      lastSeenAt: undefined,
      isTyping: false
    };

    const updatedStatus: UserStatus = {
      ...currentStatus,
      isTyping,
      typingInChat: isTyping ? chatId : undefined
    };

    this.userStatuses.set(userId, updatedStatus);
    this.notifyStatusUpdate();
  }

  /**
   * Set user call status
   */
  public setUserCallStatus(userId: string, isOnCall: boolean, callStartTime?: string): void {
    const currentStatus = this.userStatuses.get(userId) || {
      userId,
      isOnline: false,
      lastSeenAt: undefined,
      isTyping: false
    };

    const updatedStatus: UserStatus = {
      ...currentStatus,
      isOnCall,
      callStartTime: isOnCall ? (callStartTime || new Date().toISOString()) : undefined
    };

    this.userStatuses.set(userId, updatedStatus);
    console.log('📞 SimpleUserStatusService: Updated call status for user:', {
      userId,
      isOnCall,
      callStartTime: updatedStatus.callStartTime
    });
    this.notifyStatusUpdate();
  }

  /**
   * Set all users offline (when disconnected)
   */
  private setAllUsersOffline(): void {
    console.log('📊 SimpleUserStatusService: Setting all users offline');
    
    this.userStatuses.forEach((status, userId) => {
      if (userId !== this.currentUserId) {
        const updatedStatus: UserStatus = {
          ...status,
          isOnline: false,
          lastSeenAt: new Date().toISOString()
        };
        
        this.userStatuses.set(userId, updatedStatus);
      }
    });

    this.notifyStatusUpdate();
  }

  /**
   * Notify all registered callbacks
   */
  private notifyStatusUpdate(): void {
    this.statusUpdateCallbacks.forEach(callback => {
      try {
        callback(new Map(this.userStatuses));
      } catch (error) {
        console.error('Error in status update callback:', error);
      }
    });
  }

  /**
   * Get user status
   */
  getUserStatus(userId: string): UserStatus | undefined {
    return this.userStatuses.get(userId);
  }

  /**
   * Get all user statuses
   */
  getAllUserStatuses(): Map<string, UserStatus> {
    return new Map(this.userStatuses);
  }

  /**
   * Request status for a specific user
   */
  requestUserStatus(userId: string): void {
    console.log('📡 SimpleUserStatusService: Requesting status for user:', userId);
    
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      console.log('📡 SimpleUserStatusService: Socket connected, emitting get-user-status');
      socket.emit('get-user-status', { userId });
    } else {
      console.log('📡 SimpleUserStatusService: Socket not connected, cannot request status');
    }
  }

  /**
   * Request status for a specific user with retry logic
   */
  private requestUserStatusWithRetry(userId: string, retryCount: number = 0): void {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    console.log(`📡 SimpleUserStatusService: Requesting status for user ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      console.log('📡 SimpleUserStatusService: Socket connected, emitting get-user-status');
      socket.emit('get-user-status', { userId });
    } else {
      console.log('📡 SimpleUserStatusService: Socket not connected, will retry...');
      
      if (retryCount < maxRetries) {
        setTimeout(() => {
          this.requestUserStatusWithRetry(userId, retryCount + 1);
        }, retryDelay);
      } else {
        console.log(`📡 SimpleUserStatusService: Max retries reached for user ${userId}`);
      }
    }
  }

  /**
   * Add user to tracking
   */
  addUserToTracking(userId: string, initialStatus?: Partial<UserStatus>): void {
    if (this.userStatuses.has(userId)) {
      console.log('👤 SimpleUserStatusService: User already being tracked:', userId);
      // Still request status to ensure it's up to date
      this.requestUserStatus(userId);
      return;
    }

    const status: UserStatus = {
      userId,
      isOnline: false,
      lastSeenAt: undefined,
      isTyping: false,
      ...initialStatus
    };

    this.userStatuses.set(userId, status);
    console.log('👤 SimpleUserStatusService: Added user to tracking:', userId);

    // Request initial status with retry logic
    this.requestUserStatusWithRetry(userId);
  }

  /**
   * Remove user from tracking
   */
  removeUserFromTracking(userId: string): void {
    this.userStatuses.delete(userId);
    console.log('👤 SimpleUserStatusService: Removed user from tracking:', userId);
  }

  /**
   * Subscribe to status updates
   */
  subscribeToStatusUpdates(callback: (statuses: Map<string, UserStatus>) => void): () => void {
    this.statusUpdateCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusUpdateCallbacks.delete(callback);
    };
  }

  /**
   * Force refresh all user statuses (public method for debugging)
   */
  public forceRefreshAllStatuses(): void {
    console.log('🔄 SimpleUserStatusService: Force refreshing all statuses (public method)');
    this.refreshAllUserStatuses();
  }

  /**
   * Get debug information about tracked users
   */
  public getDebugInfo(): any {
    return {
      trackedUsers: Array.from(this.userStatuses.keys()),
      statuses: Object.fromEntries(this.userStatuses),
      callbacks: this.statusUpdateCallbacks.size,
      isInitialized: this.isInitialized,
      currentUserId: this.currentUserId
    };
  }

  /**
   * Cleanup and destroy the service
   */
  destroy(): void {
    console.log('🧹 SimpleUserStatusService: Destroying service...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear all callbacks
    this.statusUpdateCallbacks.clear();
    
    // Clear user statuses
    this.userStatuses.clear();
    
    this.isInitialized = false;
    console.log('✅ SimpleUserStatusService: Destroyed successfully');
  }
}

// Create singleton instance
const simpleUserStatusService = new SimpleUserStatusService();

export default simpleUserStatusService;

