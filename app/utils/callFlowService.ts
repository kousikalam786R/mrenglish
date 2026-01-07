/**
 * Call Flow Service
 * 
 * Manages the dual call-flow system:
 * - direct_call: Requires Accept/Decline
 * - match_call: Auto-connects after mutual match
 * 
 * This service handles the call state machine and coordinates with:
 * - Socket.IO for signaling
 * - WebRTC callService for actual media connection
 * - UI components for call screens
 */

import socketService from './socketService';
import { store } from '../redux/store';
import { setCallState, resetCallState, setInvitationState, resetInvitationState } from '../redux/slices/callSlice';
import callService, { CallStatus } from './callService';
import { Alert } from 'react-native';

// Call State Enum (matches backend)
export enum CallState {
  IDLE = 'idle',
  CALLING = 'calling',
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ENDED = 'ended',
  MISSED = 'missed'
}

// Call Type Enum
export enum CallType {
  DIRECT_CALL = 'direct_call',
  MATCH_CALL = 'match_call'
}

// Call Session Interface
export interface CallSession {
  callId: string;
  callerId: string;
  receiverId: string;
  callType: CallType;
  callState: CallState;
  callerName?: string;
  callerProfilePic?: string;
  metadata?: {
    isVideo?: boolean;
    topic?: string;
    level?: string;
    [key: string]: any;
  };
  callHistoryId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// INVITATION-FIRST ARCHITECTURE:
// Invitation Data (separate from call data)
export interface InvitationData {
  inviteId: string;
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  metadata?: {
    isVideo?: boolean;
    topic?: string;
    level?: string;
    [key: string]: any;
  };
  callHistoryId?: string;
  expiresAt: string; // ISO timestamp
}

// Incoming Call Data (deprecated - now use InvitationData for invitations)
export interface IncomingCallData {
  callId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  metadata?: {
    isVideo?: boolean;
    topic?: string;
    level?: string;
    [key: string]: any;
  };
  callHistoryId?: string;
  autoAccept?: boolean;
}

class CallFlowService {
  private static instance: CallFlowService;
  private currentCall: CallSession | null = null;
  private incomingCall: IncomingCallData | null = null;
  private currentInvitation: InvitationData | null = null;
  private initialized = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  // Guard to prevent duplicate call:start handling
  private handledCallIds: Set<string> = new Set();
  // Guard to prevent multiple WebRTC starts per call
  // ✅ REQUIREMENT 3: Track accepted invitations to prevent expiration from resetting active calls
  private acceptedInvitations: Map<string, string> = new Map(); // inviteId → callId mapping

  private constructor() {
    // No super() needed - we implement our own event system
  }
  
  // Event emitter methods (React Native compatible)
  public on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  public off(event: string, callback: (data: any) => void): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.delete(callback);
    }
  }

  public once(event: string, callback: (data: any) => void): void {
    const onceCallback = (data: any) => {
      callback(data);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  private emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  public static getInstance(): CallFlowService {
    if (!CallFlowService.instance) {
      CallFlowService.instance = new CallFlowService();
    }
    return CallFlowService.instance;
  }

  /**
   * Initialize the call flow service
   * Sets up Socket.IO event listeners
   */
  public initialize(): void {
    console.log('🔧 [CallFlowService] initialize() called');
    console.log('   Already initialized?', this.initialized);

    const socket = socketService.getSocket();
    console.log('   Socket exists?', !!socket);
    console.log('   Socket connected?', socket?.connected || false);
    console.log('   Socket ID:', socket?.id || 'N/A');

    // ✅ TASK 3 & 4: Listen to callService state changes to update Redux when CONNECTED
    // This ensures callFlowService owns Redux state, callService only handles WebRTC
    if (!this.initialized) {
      console.log('✅ [CallFlowService] Setting up callService state change listener');
      callService.addEventListener('call-state-changed', (state: any) => {
        // ✅ TASK 4: Update Redux when status transitions to CONNECTED
        // callFlowService is the single source of truth for Redux state
        if (state.status === CallStatus.CONNECTED) {
          console.log('🟢 [callFlowService] WebRTC connected - updating Redux to CONNECTED');
          console.log('   Previous Redux status:', store.getState().call.activeCall.status);
          
          // Update Redux state to CONNECTED (promote from CONNECTING)
          store.dispatch(setCallState({
            ...state,
            status: CallStatus.CONNECTED
          }));
          
          console.log('✅ [callFlowService] Redux state updated to CONNECTED');
          console.log('   ConnectingModal should now hide automatically');
          
          // ✅ REQUIREMENT 3: Emit navigation event when CONNECTED
          // This triggers CallScreen navigation (components listen to this)
          if (this.currentCall) {
            this.emit('call:navigate-to-callscreen', {
              callId: this.currentCall.callId,
              remoteUserId: state.remoteUserId,
              remoteUserName: state.remoteUserName,
              isVideoCall: state.isVideoEnabled || false,
              callType: CallType.DIRECT_CALL,
              isReceiver: store.getState().auth.userId !== this.currentCall.callerId
            });
            console.log('✅ [callFlowService] call:navigate-to-callscreen emitted (CONNECTED state)');
          }
          
          // ✅ TASK 4: Notify that WebRTC is connected (for any additional cleanup/setup)
          this.notifyWebRTCConnected(state);
        }
      });
      
      // Also listen for call-connected event (additional trigger for CONNECTED transition)
      callService.addEventListener('call-connected', (data: any) => {
        console.log('🟢 [callFlowService] call-connected event received:', data);
        const currentReduxState = store.getState().call.activeCall;
        if (currentReduxState.status === CallStatus.CONNECTING) {
          console.log('🟢 [callFlowService] Promoting Redux state from CONNECTING to CONNECTED');
          store.dispatch(setCallState({
            ...currentReduxState,
            status: CallStatus.CONNECTED,
            callStartTime: data.timestamp || currentReduxState.callStartTime || Date.now()
          }));
          
          // ✅ REQUIREMENT 3: Emit navigation event when CONNECTED
          if (this.currentCall) {
            this.emit('call:navigate-to-callscreen', {
              callId: this.currentCall.callId,
              remoteUserId: currentReduxState.remoteUserId,
              remoteUserName: currentReduxState.remoteUserName,
              isVideoCall: currentReduxState.isVideoEnabled || false,
              callType: CallType.DIRECT_CALL,
              isReceiver: store.getState().auth.userId !== this.currentCall.callerId
            });
            console.log('✅ [callFlowService] call:navigate-to-callscreen emitted (CONNECTED via call-connected event)');
          }
          
          this.notifyWebRTCConnected(currentReduxState);
        }
      });
    }

    // Always set up listeners if socket is ready (handles reconnections)
    // CRITICAL: Force setup listeners even if already initialized (handles reconnections)
    if (socket && socket.connected) {
      console.log('✅ [CallFlowService] Socket is ready, setting up socket listeners');
      console.log('   Socket ID:', socket.id);
      // Always setup listeners (even if initialized) to handle socket reconnections
      this.setupSocketListeners();
      this.initialized = true;
      console.log('✅ [CallFlowService] Initialization complete');
      return;
    }

    // Socket not ready yet, set up retry mechanism
    console.warn(`⚠️ [CallFlowService] Socket not ready yet (socket exists: ${!!socket}, connected: ${socket?.connected || false})`);
    console.log('   Will retry setting up listeners when socket becomes available');
    
    let retryCount = 0;
    const maxRetries = 30; // 15 seconds total (more time for mobile networks)
    const setupIfSocketReady = () => {
      retryCount++;
      const currentSocket = socketService.getSocket();
      
      if (currentSocket && currentSocket.connected) {
        console.log(`✅ [CallFlowService] Socket now ready (attempt ${retryCount}), setting up socket listeners`);
        console.log('   Socket ID:', currentSocket.id);
        this.setupSocketListeners();
        this.initialized = true;
        console.log('✅ [CallFlowService] Initialization complete after retry');
      } else if (retryCount < maxRetries) {
        // Retry after 500ms
        setTimeout(setupIfSocketReady, 500);
      } else {
        console.error(`❌ [CallFlowService] Failed to initialize after ${maxRetries} attempts`);
        console.error('   Socket listeners will NOT be set up - incoming calls will NOT be received!');
        console.error('   CRITICAL: Incoming call UI will NOT work without socket listeners!');
      }
    };

    // Start retrying immediately
    setupIfSocketReady();
  }
  
  /**
   * Re-initialize when socket reconnects
   * FIXED: This is called to ensure listeners are set up after reconnection
   */
  public reinitialize(): void {
    console.log('🔄 [CallFlowService] reinitialize() called - resetting and setting up listeners again');
    this.initialized = false;
    this.initialize();
  }

  /**
   * Setup Socket.IO event listeners for call flow
   * CRITICAL: This must be called when socket is connected for incoming calls to work
   */
  private setupSocketListeners(): void {
    const socket = socketService.getSocket();
    if (!socket) {
      console.error('❌ [CallFlowService] setupSocketListeners: Socket is null!');
      return;
    }

    if (!socket.connected) {
      console.error('❌ [CallFlowService] setupSocketListeners: Socket exists but is NOT connected!');
      console.error('   Socket ID:', socket.id, 'Connected:', socket.connected);
      return;
    }

    console.log('✅ [CallFlowService] Setting up socket listeners');
    console.log('   Socket ID:', socket.id, 'Connected:', socket.connected);

    // Remove any existing listeners first to prevent duplicates
    socket.off('call:invite:incoming');
    console.log('   Removed any existing call:invite:incoming listeners');

    // INVITATION-FIRST ARCHITECTURE: New invitation events
    // call:invite:incoming - Receiver receives invitation
    const inviteIncomingHandler = (data: InvitationData) => {
      console.log('📨 [RECEIVER] ============================================');
      console.log('📨 [RECEIVER] call:invite:incoming socket event received!');
      console.log('📨 [RECEIVER] ============================================');
      console.log('📨 [RECEIVER] Full event data:', JSON.stringify(data, null, 2));
      console.log('📨 [RECEIVER] inviteId:', data.inviteId);
      console.log('📨 [RECEIVER] callerId:', data.callerId);
      console.log('📨 [RECEIVER] callerName:', data.callerName);
      console.log('📨 [RECEIVER] Socket ID:', socket.id, 'Connected:', socket.connected);
      console.log('📨 [RECEIVER] Calling handleIncomingInvitation...');
      
      try {
        this.handleIncomingInvitation(data);
        console.log('✅ [RECEIVER] handleIncomingInvitation completed successfully');
      } catch (error) {
        console.error('❌ [RECEIVER] Error in handleIncomingInvitation:', error);
      }
    };
    
    socket.on('call:invite:incoming', inviteIncomingHandler);
    console.log('✅ [CallFlowService] call:invite:incoming listener registered on socket:', socket.id);
    console.log('   Listener count:', socket.listeners('call:invite:incoming').length);
    
    // call:start - Call starts after invitation acceptance (both users receive this)
    socket.on('call:start', (data: { callId: string; callerId: string; receiverId: string; metadata?: any; callHistoryId?: string }) => {
      console.log('🎬 [BOTH] call:start event received:', data);
      console.log('   callId:', data.callId);
      this.handleCallStart(data);
    });
    console.log('✅ [CallFlowService] call:start listener registered on socket:', socket.id);
    
    // Verify listener is actually registered
    const listenerCount = socket.listeners('call:invite:incoming').length;
    console.log('   Verified: call:invite:incoming has', listenerCount, 'listener(s)');
    
    if (listenerCount === 0) {
      console.error('❌ [CallFlowService] CRITICAL: call:invite:incoming listener was NOT registered!');
      console.error('   This means incoming invitations will NOT be received!');
    } else {
      console.log('   ✅ call:invite:incoming listener is active and ready to receive events');
      console.log('   📨 Receiver will see incoming invitations when call:invite:incoming event is received');
    }

    // INVITATION-FIRST ARCHITECTURE: Invitation response events
    // call:invite:declined - Invitation declined (for caller)
    socket.on('call:invite:declined', (data: { inviteId: string; receiverId?: string }) => {
      console.log('❌ [CALLER] ============================================');
      console.log('❌ [CALLER] call:invite:declined event received!');
      console.log('❌ [CALLER] ============================================');
      console.log('❌ [CALLER] Full event data:', JSON.stringify(data, null, 2));
      console.log('❌ [CALLER] inviteId:', data.inviteId);
      console.log('❌ [CALLER] receiverId:', data.receiverId);
      console.log('❌ [CALLER] Socket ID:', socket.id, 'Connected:', socket.connected);
      console.log('❌ [CALLER] Calling handleInvitationDeclined...');
      this.handleInvitationDeclined(data);
      console.log('✅ [CALLER] handleInvitationDeclined completed');
    });
    console.log('✅ [CallFlowService] call:invite:declined listener registered on socket:', socket.id);
    // Verify listener is registered
    const declinedListenerCount = socket.listeners('call:invite:declined').length;
    console.log('   Verified: call:invite:declined has', declinedListenerCount, 'listener(s)');
    if (declinedListenerCount === 0) {
      console.error('❌ [CallFlowService] CRITICAL: call:invite:declined listener was NOT registered!');
    }

    // call:invite:cancelled - Invitation cancelled (for receiver)
    socket.on('call:invite:cancelled', (data: { inviteId: string; cancelledBy?: string }) => {
      console.log('🚫 Invitation cancelled:', data);
      this.handleInvitationCancelled(data);
    });

    // call:invite:expired - Invitation expired (for both)
    socket.on('call:invite:expired', (data: { inviteId: string }) => {
      console.log('⏰ Invitation expired:', data);
      this.handleInvitationExpired(data);
    });

    // LEGACY: Keep old handlers for backwards compatibility during migration
    // These will be removed once frontend is fully migrated

    // call:end - Call ended
    socket.on('call:end', (data: { callId: string; callState: string; endedBy?: string; reason?: string }) => {
      console.log('📴 Call ended:', data);
      this.handleCallEnded(data);
    });

    // call:timeout - Call timed out
    socket.on('call:timeout', (data: { callId: string }) => {
      console.log('⏰ Call timed out:', data);
      this.handleCallTimeout(data);
    });

    // INVITATION-FIRST ARCHITECTURE: Invitation success/error
    // call:invite:success - Invitation sent successfully (for caller)
    socket.on('call:invite:success', (data: { inviteId: string; receiverId: string; callHistoryId?: string }) => {
      console.log('✅ Invitation sent successfully:', data);
      this.handleInvitationSent(data);
    });

    // call:invite:error - Invitation failed
    socket.on('call:invite:error', (data: { error: string }) => {
      console.error('❌ Invitation error:', data);
      this.handleInvitationError(data);
    });

    // call:accept:success - Call accept confirmed (for receiver)
    socket.on('call:accept:success', (data: { callId: string; callState: string }) => {
      console.log('✅ Call accept confirmed:', data);
      if (this.currentCall && this.currentCall.callId === data.callId) {
        this.updateCallState(data.callState as CallState);
      }
    });

    // call:accept:error - Call accept failed
    socket.on('call:accept:error', (data: { error: string }) => {
      console.error('❌ Call accept error:', data);
      this.emit('call:error', data);
    });

    // call:decline:success - Call decline confirmed (for receiver)
    socket.on('call:decline:success', (data: { callId: string; callState: string }) => {
      console.log('✅ Call decline confirmed:', data);
      this.clearCall();
    });

    // call:decline:error - Call decline failed
    socket.on('call:decline:error', (data: { error: string }) => {
      console.error('❌ Call decline error:', data);
      this.emit('call:error', data);
    });

    // call:cancel:success - Call cancel confirmed (for caller)
    socket.on('call:cancel:success', (data: { callId: string; callState: string }) => {
      console.log('✅ Call cancel confirmed:', data);
      this.clearCall();
    });

    // call:cancel:error - Call cancel failed
    socket.on('call:cancel:error', (data: { error: string }) => {
      console.error('❌ Call cancel error:', data);
      this.emit('call:error', data);
    });

    // call:end:success - Call end confirmed
    socket.on('call:end:success', (data: { callId: string; callState: string }) => {
      console.log('✅ Call end confirmed:', data);
      this.clearCall();
    });

    // call:end:error - Call end failed
    socket.on('call:end:error', (data: { error: string }) => {
      console.error('❌ Call end error:', data);
      this.emit('call:error', data);
    });

    console.log('✅ [CallFlowService] All socket listeners set up successfully');
    console.log('   Listening for: call:invite:incoming, call:invite:accept, call:invite:decline, call:invite:declined, call:invite:cancel, call:invite:cancelled, call:invite:expired, call:start, call:end');
  }

  /**
   * INVITATION-FIRST ARCHITECTURE
   * Send invitation (NOT a call)
   * Call starts ONLY after invitation acceptance via call:start event
   * 
   * @param receiverId - ID of the receiver
   * @param callType - 'direct_call' or 'match_call'
   * @param metadata - Additional metadata (isVideo, topic, etc.)
   * @param receiverName - Optional receiver name for UI display
   */
  public async sendInvitation(
    receiverId: string,
    callType: CallType,
    metadata: { isVideo?: boolean; topic?: string; level?: string; [key: string]: any } = {},
    receiverName?: string
  ): Promise<void> {
    try {
      console.log(`📨 [INVITATION-FIRST] Sending invitation to ${receiverId}`);

      // Ensure socket is connected
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        await socketService.initialize();
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Emit call:invite event (creates invitation, NOT call session)
      socketService.socketEmit('call:invite', {
        receiverId,
        metadata
      });

      // Update Redux invitation state for caller UI (OutgoingInvitationModal will show)
      const invitationStateUpdate = {
        status: 'inviting' as const,
        remoteUserId: receiverId,
        remoteUserName: receiverName || '',
        metadata,
        expiresAt: Date.now() + 30000 // 30 seconds from now
      };
      store.dispatch(setInvitationState(invitationStateUpdate));
      console.log('✅ [callFlowService] Invitation state updated - OutgoingInvitationModal should show');
      console.log('   Invitation state:', JSON.stringify(invitationStateUpdate, null, 2));
      
      // Verify Redux state was actually updated
      const updatedInvitationState = store.getState().call.invitation;
      console.log('   Verification - Redux invitation state after update:', {
        status: updatedInvitationState.status,
        remoteUserId: updatedInvitationState.remoteUserId,
        remoteUserName: updatedInvitationState.remoteUserName,
        inviteId: updatedInvitationState.inviteId
      });
      
      // DO NOT update call state here - invitation ≠ call
      // Call state will be set only after invitation acceptance via call:start event
    } catch (error) {
      console.error('❌ Error sending invitation:', error);
      store.dispatch(resetInvitationState());
      throw error;
    }
  }

  /**
   * DEPRECATED: Use sendInvitation instead
   * Kept for backwards compatibility during migration
   */
  /**
   * DEPRECATED: Use sendInvitation instead
   * Kept for backwards compatibility during migration
   */
  public async initiateCall(
    receiverId: string,
    callType: CallType,
    metadata: { isVideo?: boolean; topic?: string; level?: string; [key: string]: any } = {},
    receiverName?: string
  ): Promise<void> {
    // Call new invitation method
    return this.sendInvitation(receiverId, callType, metadata, receiverName);
  }

  /**
   * Accept an incoming call
   * @param callId - Call session ID
   * FIXED: Updates Redux state to CONNECTING (UI modal will hide, WebRTC will start)
   */
  public acceptCall(callId: string): void {
    try {
      console.log(`✅ [RECEIVER] Accepting call: ${callId}`);

      if (!this.incomingCall || this.incomingCall.callId !== callId) {
        console.warn('⚠️ No incoming call to accept');
        return;
      }

      // Update Redux state to CONNECTING (modal will hide, UI will prepare for WebRTC)
      const currentReduxState = store.getState().call.activeCall;
      store.dispatch(setCallState({
        ...currentReduxState,
        status: CallStatus.CONNECTING
      }));
      console.log('✅ [RECEIVER] Redux state updated to CONNECTING');

      // Emit call:accept event to server
      socketService.socketEmit('call:accept', { callId });
      console.log('✅ [RECEIVER] call:accept event emitted to server');

      // Update local state
      this.currentCall = {
        callId: this.incomingCall.callId,
        callerId: this.incomingCall.callerId,
        receiverId: '', // Will be set from current user
        callType: this.incomingCall.callType,
        callState: CallState.ACCEPTED,
        callerName: this.incomingCall.callerName,
        callerProfilePic: this.incomingCall.callerProfilePic,
        metadata: this.incomingCall.metadata,
        callHistoryId: this.incomingCall.callHistoryId
      };

      this.incomingCall = null;
      
      // DO NOT emit events - UI reads from Redux state
      // WebRTC will start when call:accepted event is received from server

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      // Reset state on error
      store.dispatch(resetCallState());
    }
  }

  /**
   * Decline an incoming call
   * @param callId - Call session ID
   * FIXED: Resets Redux state to IDLE (modal will hide)
   */
  public declineCall(callId: string): void {
    try {
      console.log(`❌ [RECEIVER] Declining call: ${callId}`);

      if (!this.incomingCall || this.incomingCall.callId !== callId) {
        console.warn('⚠️ No incoming call to decline');
        // Reset state anyway
        store.dispatch(resetCallState());
        return;
      }

      // Emit call:decline event to server
      socketService.socketEmit('call:decline', { callId });
      console.log('✅ [RECEIVER] call:decline event emitted to server');

      // Reset Redux state to IDLE (modal will hide)
      store.dispatch(resetCallState());
      console.log('✅ [RECEIVER] Redux state reset to IDLE');

      // Clear local state
      this.incomingCall = null;
      this.currentCall = null;
      
      // DO NOT emit events - UI reads from Redux state

    } catch (error) {
      console.error('❌ Error declining call:', error);
      // Reset state on error
      store.dispatch(resetCallState());
    }
  }

  /**
   * Cancel an outgoing call
   * @param callId - Call session ID
   */
  public cancelCall(callId: string): void {
    try {
      console.log(`🚫 Cancelling call: ${callId}`);

      if (!this.currentCall || this.currentCall.callId !== callId) {
        console.warn('⚠️ No active call to cancel');
        return;
      }

      // Emit call:cancel event
      socketService.socketEmit('call:cancel', { callId });

      this.emit('call:cancelled', { callId });
      this.clearCall();

    } catch (error) {
      console.error('❌ Error cancelling call:', error);
      this.emit('call:error', { error: error instanceof Error ? error.message : 'Failed to cancel call' });
    }
  }

  /**
   * End an active call
   * @param callId - Call session ID
   * @param reason - Reason for ending (optional)
   */
  public endCall(callId: string, reason?: string): void {
    try {
      console.log(`📴 Ending call: ${callId}, reason: ${reason || 'normal'}`);

      if (!this.currentCall || this.currentCall.callId !== callId) {
        console.warn('⚠️ No active call to end');
        return;
      }

      // Emit call:end event
      socketService.socketEmit('call:end', { callId, reason });

      this.emit('call:ended', { callId, reason });
      this.clearCall();

    } catch (error) {
      console.error('❌ Error ending call:', error);
      this.emit('call:error', { error: error instanceof Error ? error.message : 'Failed to end call' });
    }
  }

  /**
   * Get current call session
   */
  public getCurrentCall(): CallSession | null {
    return this.currentCall;
  }

  /**
   * Get incoming call data
   */
  public getIncomingCall(): IncomingCallData | null {
    return this.incomingCall;
  }

  /**
   * Debug method to verify socket listener is set up
   * Call this to check if listener is registered
   */
  public verifySocketListener(): void {
    const socket = socketService.getSocket();
    if (!socket) {
      console.error('❌ [CallFlowService] verifySocketListener: Socket is null');
      return;
    }
    
    const listeners = socket.listeners('call:incoming');
    console.log('🔍 [CallFlowService] Socket listener verification:');
    console.log('   Socket ID:', socket.id);
    console.log('   Socket connected:', socket.connected);
    console.log('   call:incoming listeners count:', listeners.length);
    console.log('   Initialized:', this.initialized);
    
    if (listeners.length === 0) {
      console.error('❌ [CallFlowService] NO LISTENERS FOUND! Incoming calls will NOT work!');
      console.error('   Call initialize() to set up listeners');
    } else {
      console.log('✅ [CallFlowService] Socket listener is registered');
    }
  }

  /**
   * Check if user is in a call
   */
  public isInCall(): boolean {
    return this.currentCall !== null && 
           (this.currentCall.callState === CallState.CALLING ||
            this.currentCall.callState === CallState.RINGING ||
            this.currentCall.callState === CallState.ACCEPTED ||
            this.currentCall.callState === CallState.CONNECTING ||
            this.currentCall.callState === CallState.CONNECTED);
  }

  /**
   * Handle incoming call
   * 
   * FIXED: Directly updates Redux store instead of emitting events
   * UI reads from Redux state (callState.status === RINGING) to show modal
   * 
   * WHY UI WASN'T SHOWING BEFORE:
   * - Previously emitted 'call:incoming' event and UI listened to it
   * - But IncomingCallModal in AppNavigator was checking Redux state (callState.status === RINGING)
   * - Redux state was NEVER updated, so modal condition was never true
   * - Now Redux store is the single source of truth - no event re-emission needed
   * 
   * PUBLIC: Can be called from notification handler as fallback if socket event not received
   */
  public handleIncomingCall(data: IncomingCallData): void {
    console.log('✅ [RECEIVER] handleIncomingCall called with:', data);
    console.log('   Setting incoming call state to ringing');
    
    // Store incoming call data locally (needed for accept/decline logic)
    this.incomingCall = data;
    
    console.log('✅ [RECEIVER] Incoming call data stored. CallId:', this.incomingCall.callId);
    console.log('   Caller:', this.incomingCall.callerId, this.incomingCall.callerName);

    // For match calls, auto-accept
    if (data.autoAccept || data.callType === CallType.MATCH_CALL) {
      console.log('🤝 Auto-accepting match call');
      this.acceptCall(data.callId);
      return;
    }

    // For direct calls, update Redux store directly (UI reads from Redux)
    console.log('📞 [RECEIVER] Updating Redux store with incoming call state (ringing)');
    
    // Map callFlowService data to Redux CallState format
    // NOTE: callType and remoteUserProfilePic are stored separately in incomingCall
    // Redux CallState doesn't include these fields, but IncomingCallCard can read from incomingCall
    const reduxCallState: any = {
      status: CallStatus.RINGING, // Use CallStatus from callService (matches Redux)
      remoteUserId: data.callerId,
      remoteUserName: data.callerName || '',
      isVideoEnabled: data.metadata?.isVideo || false,
      isAudioEnabled: true,
      callStartTime: null,
      callDuration: 0,
      callHistoryId: data.callHistoryId,
      callType: 'direct_call', // Store for UI to identify direct calls
      remoteUserProfilePic: data.callerProfilePic || undefined
    };
    
    // Update Redux store directly (single source of truth for UI)
    store.dispatch(setCallState(reduxCallState));
    console.log('✅ [RECEIVER] Redux store updated with ringing state');
    console.log('   Status:', reduxCallState.status);
    console.log('   Remote User:', reduxCallState.remoteUserId, reduxCallState.remoteUserName);
    console.log('   IncomingCallCard should now render (reads from Redux state)');
    
    // Verify Redux state was actually updated
    const updatedState = store.getState().call.activeCall;
    console.log('   Verification - Redux state after update:', {
      status: updatedState.status,
      remoteUserId: updatedState.remoteUserId,
      remoteUserName: updatedState.remoteUserName
    });
    
    // DO NOT emit events - UI subscribes to Redux state changes
  }

  /**
   * Handle call accepted - WebRTC can now start
   * This is called when call:accepted event is received from server
   * FIXED: Prevents duplicate handling by checking if already processed
   */
  private handleCallAccepted(data: { callId: string; callState: string; receiverId?: string; receiverName?: string; callerId?: string; callerName?: string }): void {
    console.log('✅ [callFlowService] Handling call:accepted event:', data);
    
    // Prevent duplicate processing - if currentCall already has this callId and state matches, skip
    if (this.currentCall && this.currentCall.callId === data.callId) {
      const currentState = this.currentCall.callState;
      const newState = data.callState as CallState;
      if (currentState === newState || currentState === CallState.CONNECTING || currentState === CallState.CONNECTED) {
        console.log('⚠️ [callFlowService] Call already processed (duplicate event), skipping');
        return;
      }
    }
    
    // For caller: currentCall should already be set from initiateCall
    // For receiver: currentCall should be set from acceptCall
    if (this.currentCall && this.currentCall.callId === data.callId) {
      console.log('✅ [callFlowService] Current call matches, updating state and emitting call:ready-for-webrtc');
      this.updateCallState(data.callState as CallState);
      this.emit('call:ready-for-webrtc', this.currentCall);
    } else {
      console.warn('⚠️ [callFlowService] No current call found or callId mismatch. Current call:', this.currentCall?.callId, 'Received:', data.callId);
      // For receiver, currentCall might not be set yet if they just accepted
      // Create it from incoming call data
      if (this.incomingCall && this.incomingCall.callId === data.callId) {
        console.log('✅ [callFlowService] Found incoming call, creating currentCall from incoming call data');
        this.currentCall = {
          callId: this.incomingCall.callId,
          callerId: data.callerId || this.incomingCall.callerId,
          receiverId: '', // Will be current user
          callType: this.incomingCall.callType,
          callState: data.callState as CallState,
          callerName: data.callerName || this.incomingCall.callerName,
          callerProfilePic: this.incomingCall.callerProfilePic,
          metadata: this.incomingCall.metadata,
          callHistoryId: this.incomingCall.callHistoryId
        };
        this.incomingCall = null;
        // WebRTC handled by callService (listens to call:start directly)
      }
    }
  }

  /**
   * Handle call declined
   */
  private handleCallDeclined(data: { callId: string; callState: string; receiverId?: string }): void {
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(CallState.DECLINED);
      this.clearCall();
    }
  }

  /**
   * Handle call cancelled (by caller)
   * FIXED: Resets Redux state to IDLE
   */
  private handleCallCancelled(data: { callId: string; callState: string; cancelledBy?: string }): void {
    console.log('🚫 [RECEIVER] Call cancelled by caller:', data.callId);
    if (this.incomingCall && this.incomingCall.callId === data.callId) {
      this.incomingCall = null;
      // Reset Redux state (modal will hide)
      store.dispatch(resetCallState());
      console.log('✅ [RECEIVER] Redux state reset to IDLE after call cancelled');
      // DO NOT emit events - UI reads from Redux state
    }
  }

  /**
   * Handle call ended
   * FIXED: Resets Redux state to IDLE when call ends
   */
  private handleCallEnded(data: { callId: string; callState: string; endedBy?: string; reason?: string }): void {
    console.log('📴 [RECEIVER] Call ended:', data.callId, 'Reason:', data.reason || 'normal');
    
    // Clear local state
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(CallState.ENDED);
      this.clearCall();
    }
    
    // Also clear if incoming call matches
    if (this.incomingCall && this.incomingCall.callId === data.callId) {
      this.incomingCall = null;
    }
    
    // Reset Redux state to IDLE (clears call state so new calls can be made)
    store.dispatch(resetCallState());
    console.log('✅ [RECEIVER] Redux state reset to IDLE after call ended');
    
    // UNIFIED USER STATUS SYSTEM - Request fresh status updates for both users
    // This ensures status is updated even if the socket event was missed
    const currentUserId = store.getState().auth.userId;
    const callState = store.getState().call.activeCall;
    const remoteUserId = callState.remoteUserId;
    
    if (currentUserId || remoteUserId) {
      import('../services/userStatusService').then(({ default: userStatusService }) => {
        const userIds: string[] = [];
        if (currentUserId) userIds.push(currentUserId);
        if (remoteUserId && remoteUserId !== currentUserId) userIds.push(remoteUserId);
        
        if (userIds.length > 0) {
          console.log(`📊 [CallFlowService] Requesting fresh status updates after call end for:`, userIds);
          userStatusService.requestMultipleUserStatuses(userIds);
        }
      });
    }
  }

  /**
   * Handle call timeout
   * FIXED: Resets Redux state to IDLE
   */
  private handleCallTimeout(data: { callId: string }): void {
    console.log('⏰ [RECEIVER] Call timed out:', data.callId);
    
    // Handle timeout during connecting phase
    const currentCallState = store.getState().call.activeCall;
    if (currentCallState.status === CallStatus.CONNECTING) {
      console.log('🔴 [BOTH] Resetting connecting state due to call timeout');
      console.log('   Showing "Call failed" feedback to user');
      store.dispatch(resetCallState());
      // Note: Toast notification can be shown here or at App level
    }
    
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(CallState.MISSED);
      this.clearCall();
    }
    if (this.incomingCall && this.incomingCall.callId === data.callId) {
      this.incomingCall = null;
      // Reset Redux state (modal will hide)
      store.dispatch(resetCallState());
      console.log('✅ [RECEIVER] Redux state reset to IDLE after call timeout');
    }
  }

  /**
   * Handle call initiated
   */
  private handleCallInitiated(data: { callId: string; callType: string; callState: string; receiverId: string; callHistoryId?: string }): void {
    if (this.currentCall) {
      this.currentCall.callId = data.callId;
      // NOTE: Server sends callState='ringing' to indicate receiver is ringing, but caller should stay CALLING
      // Only update internal callState, but Redux should remain CALLING for caller
      this.currentCall.callState = data.callState as CallState;
      this.currentCall.callHistoryId = data.callHistoryId;
      
      // CRITICAL: Caller should ALWAYS stay in CALLING state (not RINGING)
      // RINGING state is only for the receiver when they receive call:incoming
      const currentReduxState = store.getState().call.activeCall;
      store.dispatch(setCallState({
        ...currentReduxState,
        status: CallStatus.CALLING, // Caller always stays in CALLING state
        callHistoryId: data.callHistoryId
      }));
      console.log('✅ [callFlowService] handleCallInitiated - Redux state updated to CALLING (caller stays in CALLING state)');
      console.log('   Server sent callState:', data.callState, '(this is receiver state, not caller state)');
      
      this.emit('call:state-changed', this.currentCall);
    }
  }

  /**
   * Update call state
   */
  private updateCallState(newState: CallState): void {
    if (this.currentCall) {
      this.currentCall.callState = newState;
      this.emit('call:state-changed', this.currentCall);
    }
  }

  /**
   * Clear current call
   */
  private clearCall(): void {
      // Clean up call tracking guards when call ends
      if (this.currentCall?.callId) {
        const callId = this.currentCall.callId;
        this.handledCallIds.delete(callId);
        console.log('🧹 [callFlowService] Cleaned up guards for callId:', callId);
      
      // ✅ REQUIREMENT 3: Clean up accepted invitations mapping
      // Find and remove any inviteId linked to this callId
      for (const [inviteId, mappedCallId] of this.acceptedInvitations.entries()) {
        if (mappedCallId === callId) {
          this.acceptedInvitations.delete(inviteId);
          console.log('🧹 [callFlowService] Removed invitation mapping:', inviteId, '→', callId);
        }
      }
    }
    
    this.currentCall = null;
    this.incomingCall = null;
    this.emit('call:state-changed', null);
  }

  /**
   * INVITATION-FIRST ARCHITECTURE HANDLERS
   */

  /**
   * Handle incoming invitation
   * Updates invitation state (NOT call state)
   * PUBLIC: Can be called from notification handler as fallback
   */
  public handleIncomingInvitation(data: InvitationData): void {
    console.log('📨 [RECEIVER] ============================================');
    console.log('📨 [RECEIVER] handleIncomingInvitation called with:', data);
    console.log('📨 [RECEIVER] ============================================');
    
    // Store invitation locally
    this.currentInvitation = data;
    
    // Get current Redux state BEFORE update
    const beforeState = store.getState().call.invitation;
    console.log('📨 [RECEIVER] Redux state BEFORE update:', {
      status: beforeState.status,
      inviteId: beforeState.inviteId
    });
    
    // Update Redux invitation state (UI reads from this)
    // IMPORTANT: Receiver should have status 'incoming', NOT 'inviting'
    const invitationStateUpdate = {
      inviteId: data.inviteId,
      status: 'incoming' as const, // RECEIVER status is 'incoming'
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserProfilePic: data.callerProfilePic,
      expiresAt: new Date(data.expiresAt).getTime(),
      metadata: data.metadata,
      callHistoryId: data.callHistoryId
    };
    
    console.log('📨 [RECEIVER] Dispatching setInvitationState with:', JSON.stringify(invitationStateUpdate, null, 2));
    store.dispatch(setInvitationState(invitationStateUpdate));
    
    // Verify Redux state was actually updated IMMEDIATELY
    const updatedInvitationState = store.getState().call.invitation;
    console.log('✅ [RECEIVER] Redux state AFTER update:', {
      status: updatedInvitationState.status,
      inviteId: updatedInvitationState.inviteId,
      remoteUserId: updatedInvitationState.remoteUserId,
      remoteUserName: updatedInvitationState.remoteUserName
    });
    
    if (updatedInvitationState.status !== 'incoming') {
      console.error('❌ [RECEIVER] CRITICAL: Redux state status is NOT "incoming"!', {
        expected: 'incoming',
        actual: updatedInvitationState.status
      });
    } else {
      console.log('✅ [RECEIVER] Invitation state updated correctly - status is "incoming"');
      console.log('   IncomingInvitationModal should now render');
    }
  }

  /**
   * Handle invitation sent successfully (caller side)
   */
  private handleInvitationSent(data: { inviteId: string; receiverId: string; callHistoryId?: string }): void {
    console.log('✅ [CALLER] Invitation sent successfully:', data.inviteId);
    
    // Update invitation state with inviteId
    const currentInvitation = store.getState().call.invitation;
    store.dispatch(setInvitationState({
      ...currentInvitation,
      inviteId: data.inviteId,
      callHistoryId: data.callHistoryId
    }));
  }

  /**
   * Handle invitation error
   */
  private handleInvitationError(data: { error: string }): void {
    console.error('❌ Invitation error:', data.error);
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.emit('invitation:error', data);
  }

  /**
   * Handle invitation declined (caller side)
   */
  private handleInvitationDeclined(data: { inviteId: string; receiverId?: string }): void {
    console.log('❌ [CALLER] handleInvitationDeclined called with:', data);
    console.log('   Current invitation:', this.currentInvitation);
    console.log('   InviteId match:', this.currentInvitation?.inviteId === data.inviteId);
    
    // Reset invitation state first (this will close the OutgoingInvitationModal)
    console.log('🔄 [CALLER] Resetting invitation state to close modal');
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
    console.log('✅ [CALLER] Invitation state reset complete');
    
    // Show modal/alert to the sender after a brief delay to ensure modal is closed
    console.log('📱 [CALLER] Scheduling Alert modal for declined invitation');
    setTimeout(() => {
      console.log('📱 [CALLER] Showing Alert modal now');
      Alert.alert(
        'Call Declined',
        'The person you called declined your invitation.',
        [{ text: 'OK' }],
        { cancelable: true }
      );
      console.log('✅ [CALLER] Alert.alert called');
    }, 300); // Small delay to ensure modal closes first
  }

  /**
   * Handle invitation cancelled (receiver side)
   * ✅ REQUIREMENT 2: Don't cancel active calls - only reset invitation UI
   */
  private handleInvitationCancelled(data: { inviteId: string; cancelledBy?: string }): void {
    console.log('🚫 [RECEIVER] Invitation cancelled:', data.inviteId);
    
    // ✅ REQUIREMENT 2: Check if invitation is linked to an active call
    const linkedCallId = this.acceptedInvitations.get(data.inviteId);
    const currentCallState = store.getState().call.activeCall;
    const hasActiveCall = currentCallState.status === CallStatus.CONNECTING ||
                         currentCallState.status === CallStatus.CONNECTED ||
                         currentCallState.status === CallStatus.CALLING ||
                         currentCallState.status === CallStatus.RINGING;
    
    // ✅ REQUIREMENT 2: If invitation is linked to active call, ignore cancellation
    if (linkedCallId && hasActiveCall) {
      console.log('✅ [RECEIVER] Ignoring invitation cancellation because call is active');
      console.log('   inviteId:', data.inviteId);
      console.log('   linkedCallId:', linkedCallId);
      console.log('   currentCallState:', currentCallState.status);
      console.log('   Call will continue - invitation cancellation does not affect active calls');
      return; // Don't reset anything - call is active
    }
    
    // ✅ REQUIREMENT 2: If call:start was already received, invitation cancellation is irrelevant
    if (this.currentCall && this.currentCall.callId) {
      console.log('✅ [RECEIVER] Ignoring invitation cancellation - call:start already received');
      console.log('   callId:', this.currentCall.callId);
      console.log('   Call state:', currentCallState.status);
      console.log('   Invitation cancellation cannot cancel an active call session');
      
      // Reset invitation UI only
      if (this.currentInvitation?.inviteId === data.inviteId) {
        this.currentInvitation = null;
      }
      store.dispatch(resetInvitationState());
      return;
    }
    
    // ✅ REQUIREMENT 2: Only reset call state if cancellation happened before acceptance
    // Normal cancellation flow - no active call yet
    if (currentCallState.status === CallStatus.CONNECTING && !this.currentCall) {
      console.log('⚠️ [RECEIVER] Invitation cancelled during CONNECTING (before call:start)');
      console.log('   Resetting call state');
      store.dispatch(resetCallState());
    }
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    if (this.currentInvitation?.inviteId === data.inviteId) {
      this.currentInvitation = null;
    }
  }

  /**
   * Handle invitation expired (both sides)
   * ✅ REQUIREMENT 1 & 2: Only reset invitation UI, NOT active calls
   */
  private handleInvitationExpired(data: { inviteId: string }): void {
    console.log('⏰ Invitation expired:', data.inviteId);
    
    // ✅ REQUIREMENT 2: Check if invitation is linked to an active call
    const linkedCallId = this.acceptedInvitations.get(data.inviteId);
    const currentCallState = store.getState().call.activeCall;
    const hasActiveCall = currentCallState.status === CallStatus.CONNECTING ||
                         currentCallState.status === CallStatus.CONNECTED ||
                         currentCallState.status === CallStatus.CALLING ||
                         currentCallState.status === CallStatus.RINGING;
    
    // ✅ REQUIREMENT 2: If invitation is linked to active call, ignore expiration
    if (linkedCallId && hasActiveCall) {
      console.log('✅ [BOTH] Ignoring invitation expiration because call is active');
      console.log('   inviteId:', data.inviteId);
      console.log('   linkedCallId:', linkedCallId);
      console.log('   currentCallState:', currentCallState.status);
      console.log('   Call will continue - invitation expiration does not affect active calls');
      
      // Clean up the mapping (call is active, invitation is no longer relevant)
      this.acceptedInvitations.delete(data.inviteId);
      return; // Don't reset anything - call is active
    }
    
    // ✅ REQUIREMENT 3: If call is in connecting state but invitation wasn't accepted, still ignore
    // Once call:start is received, invitation is irrelevant
    if (this.currentCall && this.currentCall.callId) {
      console.log('✅ [BOTH] Ignoring invitation expiration - call:start already received');
      console.log('   callId:', this.currentCall.callId);
      console.log('   Call state:', currentCallState.status);
      console.log('   Invitation expiration cannot cancel an active call session');
      
      // Reset invitation UI only (don't touch call state)
      if (this.currentInvitation?.inviteId === data.inviteId) {
        this.currentInvitation = null;
      }
      store.dispatch(resetInvitationState());
      return;
    }
    
    // ✅ REQUIREMENT 3: Only reset if invitation expired BEFORE acceptance
    // This handles case where invitation times out before user accepts
    console.log('⚠️ [BOTH] Invitation expired before acceptance');
    console.log('   No active call linked to this invitation');
    console.log('   Resetting invitation UI only (no call state changes)');
    
    // Reset invitation state (UI only - no call state reset)
    if (this.currentInvitation?.inviteId === data.inviteId) {
      this.currentInvitation = null;
    }
    store.dispatch(resetInvitationState());
    
    // ✅ REQUIREMENT 2: Only reset call state if there's no active call
    // If call state is CONNECTING but no call:start was received, it means acceptance failed
    if (currentCallState.status === CallStatus.CONNECTING && !this.currentCall) {
      console.log('⚠️ [BOTH] Call state is CONNECTING but no call session found');
      console.log('   This might indicate acceptance failed - resetting call state');
      store.dispatch(resetCallState());
    }
  }

  /**
   * Handle call:start - Call actually starts after invitation acceptance
   * This is when WebRTC should be initialized
   * 
   * IDEMPOTENT: Only handles each callId once to prevent duplicate processing
   */
  private handleCallStart(data: { callId: string; callerId: string; receiverId: string; metadata?: any; callHistoryId?: string }): void {
    // ✅ TASK 1: Make call:start idempotent - ignore duplicate events
    if (this.handledCallIds.has(data.callId)) {
      console.warn('⚠️ [callFlowService] Duplicate call:start ignored for callId:', data.callId);
      console.warn('   This call has already been processed. Ignoring duplicate event.');
      return;
    }
    
    // Mark this callId as handled
    this.handledCallIds.add(data.callId);
    console.log('🎬 [BOTH] call:start received - Call session created, WebRTC can now start');
    console.log('   callId:', data.callId);
    console.log('   callerId:', data.callerId);
    console.log('   receiverId:', data.receiverId);
    
    // Get current user ID from Redux to determine if we're caller or receiver
    const currentUserId = store.getState().auth.userId;
    const isCaller = currentUserId === data.callerId;
    const isReceiver = currentUserId === data.receiverId;
    
    console.log('   Current user ID:', currentUserId);
    console.log('   Is caller?', isCaller);
    console.log('   Is receiver?', isReceiver);
    
    // Get invitation data before resetting (contains user names)
    const invitationState = store.getState().call.invitation;
    const remoteUserId = isCaller ? data.receiverId : data.callerId;
    const remoteUserName = invitationState.remoteUserName || '';
    
    console.log('   Remote user ID:', remoteUserId);
    console.log('   Remote user name:', remoteUserName);
    
    // Create call session with proper names
    this.currentCall = {
      callId: data.callId,
      callerId: data.callerId,
      receiverId: data.receiverId,
      callType: CallType.DIRECT_CALL,
      callState: CallState.CONNECTING,
      callerName: isReceiver ? invitationState.remoteUserName : undefined, // For receiver, caller name is in invitation
      metadata: data.metadata,
      callHistoryId: data.callHistoryId
    };
    
    // ✅ REQUIREMENT 3: Link accepted invitation to callId (if invitation was accepted)
    // This prevents invitation expiration from resetting the active call
    const invitationStateForMapping = store.getState().call.invitation;
    
    // Check both invitation state and currentInvitation (one might be reset already)
    const inviteIdToLink = invitationStateForMapping.inviteId || this.currentInvitation?.inviteId;
    
    if (inviteIdToLink) {
      // Update pending mapping to actual callId, or create new mapping
      this.acceptedInvitations.set(inviteIdToLink, data.callId);
      console.log('✅ [BOTH] Linked accepted invitation to callId');
      console.log('   inviteId:', inviteIdToLink);
      console.log('   callId:', data.callId);
      console.log('   Invitation expiration will now be ignored for this call');
    }
    
    // ✅ TASK 4: callFlowService owns Redux state - update it here
    // Update call state to CONNECTING with correct remote user info
    // This ensures connecting state is set even if acceptInvitation didn't set it
    // (e.g., for caller side or if receiver missed the immediate update)
    console.log('🔵 [BOTH] Call state → connecting (from call:start)');
    store.dispatch(setCallState({
      status: CallStatus.CONNECTING,
      remoteUserId: remoteUserId,
      remoteUserName: remoteUserName,
      isVideoEnabled: data.metadata?.isVideo || false,
      isAudioEnabled: true,
      callStartTime: null,
      callDuration: 0,
      callHistoryId: data.callHistoryId
    }));
    
    console.log('✅ [BOTH] Call state updated to CONNECTING');
    console.log('   Remote user:', remoteUserId, remoteUserName);
    console.log('   ConnectingModal should now be visible');
    
    // ✅ FIX #1 & #4: Sync Redux state to callService for receiver side
    // This ensures when call-offer arrives, callService knows state is CONNECTING
    const reduxState = store.getState().call.activeCall;
    if (isReceiver) {
      console.log('🔄 [RECEIVER] Syncing Redux state to callService in handleCallStart');
      // Sync state immediately (don't wait for initialize - it's already done in acceptInvitation)
      callService.syncStateFromRedux(reduxState);
      // Ensure callService is initialized (should already be done, but safety check)
      callService.initialize();
      console.log('✅ [RECEIVER] State synced to callService, status should be:', reduxState.status);
    }
    
    // Reset invitation state (invitation is now converted to call)
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
    
    // ✅ REQUIREMENT 1: callFlowService ONLY updates call state, NO WebRTC side-effects
    // WebRTC is handled entirely by callService, which listens directly to call:start socket event
    console.log('✅ [BOTH] Call state updated to CONNECTING');
    console.log('   WebRTC will be started by callService (listens to call:start directly)');
    console.log('   Role: ' + (isCaller ? 'CALLER (will create offer)' : 'RECEIVER (will wait for offer)'));
    
    // ✅ REQUIREMENT 3: Navigation happens ONLY when CONNECTED
    // Don't emit navigation here - wait for CONNECTED state
    // Navigation will be triggered by components listening to CONNECTED state change
    console.log('⏳ [BOTH] Waiting for CONNECTED state before navigation');
    console.log('   CallScreen will be navigated when callState.status === CONNECTED');
  }

  /**
   * Accept invitation (receiver side)
   * 
   * Sets connecting state immediately for instant UI feedback.
   * WebRTC setup will happen after call:start event is received.
   */
  public acceptInvitation(inviteId: string): void {
    console.log('✅ [RECEIVER] Accepting invitation:', inviteId);
    console.log('🔵 [RECEIVER] Call state → connecting (immediate UI feedback)');
    
    // ✅ REQUIREMENT 1: Mark invitation as accepted (will link to callId when call:start is received)
    // Store inviteId temporarily - callId will be added in handleCallStart
    this.acceptedInvitations.set(inviteId, 'pending'); // Will be updated to actual callId in handleCallStart
    
    // ✅ REQUIREMENT 1: Clear any invitation expiration timers (if any)
    // Note: Timers are in UI components, they should stop when invitation state is reset
    // But we mark invitation as accepted here so expiration handler knows to ignore it
    
    // Get invitation state to preserve remote user info
    const invitationState = store.getState().call.invitation;
    
    // Set call state to CONNECTING immediately for instant UI feedback
    // This shows ConnectingModal while waiting for call:start and WebRTC setup
    store.dispatch(setCallState({
      status: CallStatus.CONNECTING,
      remoteUserId: invitationState.remoteUserId || '',
      remoteUserName: invitationState.remoteUserName || '',
      isVideoEnabled: invitationState.metadata?.isVideo || false,
      isAudioEnabled: true,
      callStartTime: null,
      callDuration: 0,
      callHistoryId: invitationState.callHistoryId
    }));
    
    console.log('   Remote user:', invitationState.remoteUserId, invitationState.remoteUserName);
    console.log('   ConnectingModal should now be visible');
    console.log('✅ [RECEIVER] Invitation marked as accepted - expiration will be ignored');
    
    // ✅ FIX #1: Sync Redux state to callService so handleCallOffer can detect CONNECTING status
    // This is critical - when offer arrives, callService needs to know state is CONNECTING
    const reduxCallState = store.getState().call.activeCall;
    callService.syncStateFromRedux(reduxCallState);
    console.log('✅ [RECEIVER] callService state synced with Redux (CONNECTING)');
    
    // Ensure callService is initialized (sets up socket listeners)
    callService.initialize();
    console.log('✅ [RECEIVER] callService initialized, ready to receive call-offer');
    
    // Emit call:invite:accept (server will respond with call:start)
    socketService.socketEmit('call:invite:accept', { inviteId });
    
    // Note: Invitation state will be reset when call:start is received
    // The connecting state set above provides immediate feedback
  }

  /**
   * Decline invitation (receiver side)
   */
  public declineInvitation(inviteId: string): void {
    console.log('❌ [RECEIVER] Declining invitation:', inviteId);
    
    // If call is in connecting state, reset it (closes ConnectingModal)
    // This handles edge case where user declines after accidentally accepting
    const currentCallState = store.getState().call.activeCall;
    if (currentCallState.status === CallStatus.CONNECTING) {
      console.log('🔴 [RECEIVER] Resetting connecting state due to invitation decline');
      store.dispatch(resetCallState());
    }
    
    // Emit call:invite:decline
    socketService.socketEmit('call:invite:decline', { inviteId });
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
  }

  /**
   * Cancel invitation (caller side)
   */
  public cancelInvitation(inviteId: string): void {
    console.log('🚫 [CALLER] Cancelling invitation:', inviteId);
    
    // If call is in connecting state, reset it (closes ConnectingModal)
    // This handles edge case where caller cancels after receiver accepts
    const currentCallState = store.getState().call.activeCall;
    if (currentCallState.status === CallStatus.CONNECTING) {
      console.log('🔴 [CALLER] Resetting connecting state due to invitation cancellation');
      store.dispatch(resetCallState());
    }
    
    // Emit call:invite:cancel
    socketService.socketEmit('call:invite:cancel', { inviteId });
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
  }

  /**
   * Get current invitation
   */
  public getCurrentInvitation(): InvitationData | null {
    return this.currentInvitation;
  }

  /**
   * Re-initialize if socket reconnects
   */
  public reinitialize(): void {
    this.initialized = false;
    this.initialize();
  }

  /**
   * ✅ TASK 4: Notify that WebRTC is connected
   * Called when WebRTC connection is established
   * Redux state should already be updated to CONNECTED
   */
  private notifyWebRTCConnected(callState: any): void {
    console.log('🟢 [callFlowService] notifyWebRTCConnected called');
    console.log('   Call is now fully connected');
    console.log('   ConnectingModal should hide, CallScreen should appear');
    
    // Emit event for any components that need to know connection is ready
    this.emit('webrtc:connected', {
      callId: this.currentCall?.callId,
      remoteUserId: callState.remoteUserId,
      remoteUserName: callState.remoteUserName
    });
  }
}

// Export singleton instance
const callFlowService = CallFlowService.getInstance();
export default callFlowService;

// Export invitation-related types for use in components
export type { InvitationData };



