import socketService from '../utils/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
  isTyping?: boolean;
  typingInChat?: string;
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

    // Listen for user status updates
    socketService.socketOn('user-status', (data: UserStatusUpdate) => {
      console.log('📡 SimpleUserStatusService: Received user-status event:', data);
      this.updateUserStatus(data);
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

    // Listen for connection status changes
    socketService.socketOn('connect', () => {
      console.log('🔗 SimpleUserStatusService: Socket connected');
      this.requestAllUserStatuses();
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
   * Request status for all users we're tracking
   */
  private requestAllUserStatuses(): void {
    console.log('📡 SimpleUserStatusService: Requesting status for all tracked users');
    
    this.userStatuses.forEach((status, userId) => {
      if (userId !== this.currentUserId) {
        const socket = socketService.getSocket();
        if (socket && socket.connected) {
          socket.emit('get-user-status', { userId });
        }
      }
    });
  }

  /**
   * Update user status and notify callbacks
   */
  private updateUserStatus(data: UserStatusUpdate): void {
    const { userId, isOnline, lastSeenAt } = data;
    
    const currentStatus = this.userStatuses.get(userId);
    const newStatus: UserStatus = {
      userId,
      isOnline,
      lastSeenAt,
      isTyping: currentStatus?.isTyping || false,
      typingInChat: currentStatus?.typingInChat
    };

    this.userStatuses.set(userId, newStatus);

    console.log('📊 SimpleUserStatusService: Updated status for user:', {
      userId,
      isOnline,
      lastSeenAt,
      hasCallbacks: this.statusUpdateCallbacks.size > 0
    });

    // Notify all callbacks
    this.notifyStatusUpdate();
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
      socket.emit('get-user-status', { userId });
    }
  }

  /**
   * Add user to tracking
   */
  addUserToTracking(userId: string, initialStatus?: Partial<UserStatus>): void {
    if (this.userStatuses.has(userId)) return;

    const status: UserStatus = {
      userId,
      isOnline: false,
      lastSeenAt: undefined,
      isTyping: false,
      ...initialStatus
    };

    this.userStatuses.set(userId, status);
    console.log('👤 SimpleUserStatusService: Added user to tracking:', userId);

    // Request initial status
    this.requestUserStatus(userId);
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
