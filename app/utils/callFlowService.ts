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
import { CallStatus } from './callService';

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
  private initialized = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

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
      console.log('📨 [RECEIVER] call:invite:incoming socket event received:', data);
      console.log('   inviteId:', data.inviteId);
      console.log('   callerId:', data.callerId);
      console.log('   callerName:', data.callerName);
      console.log('   Socket ID:', socket.id, 'Connected:', socket.connected);
      this.handleIncomingInvitation(data);
    };
    
    socket.on('call:invite:incoming', inviteIncomingHandler);
    console.log('✅ [CallFlowService] call:invite:incoming listener registered on socket:', socket.id);
    
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
      console.log('❌ Invitation declined:', data);
      this.handleInvitationDeclined(data);
    });

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
    console.log('   Listening for: call:invite:incoming, call:invite:accept, call:invite:decline, call:invite:cancel, call:invite:expired, call:start, call:end');
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
        this.emit('call:ready-for-webrtc', this.currentCall);
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
  }

  /**
   * Handle call timeout
   * FIXED: Resets Redux state to IDLE
   */
  private handleCallTimeout(data: { callId: string }): void {
    console.log('⏰ [RECEIVER] Call timed out:', data.callId);
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
    console.log('📨 [RECEIVER] handleIncomingInvitation called with:', data);
    
    // Store invitation locally
    this.currentInvitation = data;
    
    // Update Redux invitation state (UI reads from this)
    const invitationStateUpdate = {
      inviteId: data.inviteId,
      status: 'incoming' as const,
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserProfilePic: data.callerProfilePic,
      expiresAt: new Date(data.expiresAt).getTime(),
      metadata: data.metadata,
      callHistoryId: data.callHistoryId
    };
    store.dispatch(setInvitationState(invitationStateUpdate));
    
    console.log('✅ [RECEIVER] Invitation state updated - IncomingInvitationModal should render');
    console.log('   Invitation state:', JSON.stringify(invitationStateUpdate, null, 2));
    
    // Verify Redux state was actually updated
    const updatedInvitationState = store.getState().call.invitation;
    console.log('   Verification - Redux invitation state after update:', {
      status: updatedInvitationState.status,
      remoteUserId: updatedInvitationState.remoteUserId,
      remoteUserName: updatedInvitationState.remoteUserName,
      inviteId: updatedInvitationState.inviteId
    });
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
    console.log('❌ [CALLER] Invitation declined:', data.inviteId);
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
  }

  /**
   * Handle invitation cancelled (receiver side)
   */
  private handleInvitationCancelled(data: { inviteId: string; cancelledBy?: string }): void {
    console.log('🚫 [RECEIVER] Invitation cancelled:', data.inviteId);
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
  }

  /**
   * Handle invitation expired (both sides)
   */
  private handleInvitationExpired(data: { inviteId: string }): void {
    console.log('⏰ Invitation expired:', data.inviteId);
    
    // Reset invitation state
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
  }

  /**
   * Handle call:start - Call actually starts after invitation acceptance
   * This is when WebRTC should be initialized
   */
  private handleCallStart(data: { callId: string; callerId: string; receiverId: string; metadata?: any; callHistoryId?: string }): void {
    console.log('🎬 [BOTH] call:start received - Call session created, WebRTC can now start');
    console.log('   callId:', data.callId);
    console.log('   callerId:', data.callerId);
    console.log('   receiverId:', data.receiverId);
    
    // Create call session
    this.currentCall = {
      callId: data.callId,
      callerId: data.callerId,
      receiverId: data.receiverId,
      callType: CallType.DIRECT_CALL,
      callState: CallState.CONNECTING,
      metadata: data.metadata,
      callHistoryId: data.callHistoryId
    };
    
    // Reset invitation state (invitation is now converted to call)
    store.dispatch(resetInvitationState());
    this.currentInvitation = null;
    
    // Update call state to CONNECTING
    store.dispatch(setCallState({
      status: CallStatus.CONNECTING,
      remoteUserId: data.callerId, // TODO: Determine if we're caller or receiver
      remoteUserName: '', // Will be set from invitation data
      isVideoEnabled: data.metadata?.isVideo || false,
      isAudioEnabled: true,
      callStartTime: null,
      callDuration: 0,
      callHistoryId: data.callHistoryId
    }));
    
    // Emit event for WebRTC initialization (this is when WebRTC should start)
    this.emit('call:ready-for-webrtc', this.currentCall);
    console.log('✅ [BOTH] call:ready-for-webrtc emitted - WebRTC can now start');
  }

  /**
   * Accept invitation (receiver side)
   */
  public acceptInvitation(inviteId: string): void {
    console.log('✅ [RECEIVER] Accepting invitation:', inviteId);
    
    // Emit call:invite:accept
    socketService.socketEmit('call:invite:accept', { inviteId });
    
    // Update invitation state (UI will show connecting)
    store.dispatch(setInvitationState({
      status: 'idle' // Will be reset when call:start is received
    }));
  }

  /**
   * Decline invitation (receiver side)
   */
  public declineInvitation(inviteId: string): void {
    console.log('❌ [RECEIVER] Declining invitation:', inviteId);
    
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
}

// Export singleton instance
const callFlowService = CallFlowService.getInstance();
export default callFlowService;

// Export invitation-related types for use in components
export type { InvitationData };



