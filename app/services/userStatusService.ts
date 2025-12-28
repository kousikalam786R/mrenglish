/**
 * User Status Service
 * 
 * UNIFIED USER STATUS SYSTEM - FRONTEND SERVICE
 * 
 * This service listens to Socket.IO events and updates the Redux store
 * with user status information. This is the ONLY way status should be updated.
 * 
 * Status Types:
 * - offline   → user not connected
 * - online    → user active in app, not calling
 * - on_call   → user currently in a call
 * - searching → user is searching for perfect partner
 */

import { store } from '../redux/store';
import { updateUserStatus, updateMultipleUserStatuses, removeUserStatus } from '../redux/slices/userStatusSlice';
import socketService from '../utils/socketService';
import type { UserStatusType } from '../redux/slices/userStatusSlice';

class UserStatusService {
  private static instance: UserStatusService;
  private isInitialized = false;
  private socketListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  private constructor() {}

  public static getInstance(): UserStatusService {
    if (!UserStatusService.instance) {
      UserStatusService.instance = new UserStatusService();
    }
    return UserStatusService.instance;
  }

  /**
   * Initialize the service and set up socket listeners
   * Should be called once when the app starts
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('📊 UserStatusService: Already initialized');
      return;
    }

    console.log('📊 UserStatusService: Initializing...');

    // Wait for socket to be ready
    const setupListeners = () => {
      const socket = socketService.getSocket();
      if (!socket) {
        console.warn('📊 UserStatusService: Socket not available, will retry...');
        setTimeout(setupListeners, 1000);
        return;
      }

      this.setupSocketListeners();
      this.isInitialized = true;
      console.log('✅ UserStatusService: Initialized successfully');
    };

    // Try to set up listeners immediately
    setupListeners();

    // Also set up listeners when socket connects
    socketService.socketOn('connect', () => {
      console.log('📊 UserStatusService: Socket connected, setting up listeners');
      if (!this.isInitialized) {
        this.setupSocketListeners();
        this.isInitialized = true;
      }
    });
  }

  /**
   * Set up Socket.IO event listeners
   */
  private setupSocketListeners(): void {
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('📊 UserStatusService: Cannot set up listeners - socket not available');
      return;
    }

    // Remove existing listeners to avoid duplicates
    this.cleanup();

    // Listen for single user status update
    const handleStatusUpdate = (data: { userId: string; status: UserStatusType; lastUpdated: string }) => {
      console.log('📊 UserStatusService: Received user:status:update', data);
      
      if (data.userId && data.status && data.lastUpdated) {
        const previousStatus = store.getState().userStatus.statuses[data.userId];
        console.log(`📊 UserStatusService: Updating status for ${data.userId}:`, {
          previous: previousStatus?.status || 'unknown',
          new: data.status,
          lastUpdated: data.lastUpdated
        });
        
        store.dispatch(
          updateUserStatus({
            userId: data.userId,
            status: data.status,
            lastUpdated: data.lastUpdated,
          })
        );
        
        // Verify the update was applied
        const updatedStatus = store.getState().userStatus.statuses[data.userId];
        console.log(`📊 UserStatusService: Status update verified for ${data.userId}:`, updatedStatus);
      } else {
        console.warn('📊 UserStatusService: Invalid status update data:', data);
      }
    };

    // Listen for status list (multiple users)
    const handleStatusList = (data: { statuses: Array<{ userId: string; status: UserStatusType; lastUpdated: string }> }) => {
      console.log('📊 UserStatusService: Received user:status:list', data);
      
      if (data.statuses && Array.isArray(data.statuses)) {
        store.dispatch(updateMultipleUserStatuses(data.statuses));
      }
    };

    // Register listeners
    socket.on('user:status:update', handleStatusUpdate);
    socket.on('user:status:list', handleStatusList);

    // Store listeners for cleanup
    this.socketListeners.push(
      { event: 'user:status:update', handler: handleStatusUpdate },
      { event: 'user:status:list', handler: handleStatusList }
    );

    console.log('✅ UserStatusService: Socket listeners set up');
  }

  /**
   * Request status for a single user
   */
  public requestUserStatus(userId: string): void {
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      console.warn('📊 UserStatusService: Cannot request status - socket not connected');
      return;
    }

    console.log(`📊 UserStatusService: Requesting status for user ${userId}`);
    socket.emit('user:status:request', { userId });
  }

  /**
   * Request status for multiple users
   */
  public requestMultipleUserStatuses(userIds: string[]): void {
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      console.warn('📊 UserStatusService: Cannot request statuses - socket not connected');
      return;
    }

    console.log(`📊 UserStatusService: Requesting statuses for ${userIds.length} users`);
    socket.emit('user:status:list', { userIds });
  }

  /**
   * Clean up socket listeners
   */
  private cleanup(): void {
    const socket = socketService.getSocket();
    if (socket) {
      this.socketListeners.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    }
    this.socketListeners = [];
  }

  /**
   * Destroy the service and clean up
   */
  public destroy(): void {
    console.log('📊 UserStatusService: Destroying...');
    this.cleanup();
    this.isInitialized = false;
  }
}

// Export singleton instance
const userStatusService = UserStatusService.getInstance();
export default userStatusService;

