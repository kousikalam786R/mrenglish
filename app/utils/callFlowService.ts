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

// Simple EventEmitter implementation for React Native (no Node.js events module needed)
class SimpleEventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      return;
    }
    if (callback) {
      const callbacks = this.events.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.events.delete(event);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events.has(event)) {
      return;
    }
    const callbacks = this.events.get(event)!;
    // Create a copy to avoid issues if callbacks modify the array
    [...callbacks].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

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

// Incoming Call Data
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

class CallFlowService extends SimpleEventEmitter {
  private static instance: CallFlowService;
  private currentCall: CallSession | null = null;
  private incomingCall: IncomingCallData | null = null;
  private initialized = false;

  private constructor() {
    super();
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
    if (this.initialized) {
      console.log('CallFlowService already initialized');
      return;
    }

    console.log('🔧 Initializing CallFlowService...');

    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('⚠️ Socket not available, will initialize when socket connects');
      return;
    }

    this.setupSocketListeners();
    this.initialized = true;
  }

  /**
   * Setup Socket.IO event listeners for call flow
   */
  private setupSocketListeners(): void {
    const socket = socketService.getSocket();
    if (!socket) return;

    // call:incoming - Receiver receives incoming call notification
    socket.on('call:incoming', (data: IncomingCallData) => {
      console.log('📞 Incoming call received:', data);
      this.handleIncomingCall(data);
    });

    // call:accept - Call accepted (for caller)
    socket.on('call:accept', (data: { callId: string; callState: string; receiverId?: string; receiverName?: string }) => {
      console.log('✅ Call accepted:', data);
      this.handleCallAccepted(data);
    });

    // call:decline - Call declined (for caller)
    socket.on('call:decline', (data: { callId: string; callState: string; receiverId?: string }) => {
      console.log('❌ Call declined:', data);
      this.handleCallDeclined(data);
    });

    // call:cancel - Call cancelled by caller (for receiver)
    socket.on('call:cancel', (data: { callId: string; callState: string; cancelledBy?: string }) => {
      console.log('🚫 Call cancelled:', data);
      this.handleCallCancelled(data);
    });

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

    // call:initiate:success - Call initiated successfully (for caller)
    socket.on('call:initiate:success', (data: { callId: string; callType: string; callState: string; receiverId: string; callHistoryId?: string }) => {
      console.log('✅ Call initiated successfully:', data);
      this.handleCallInitiated(data);
    });

    // call:initiate:error - Call initiation failed
    socket.on('call:initiate:error', (data: { error: string }) => {
      console.error('❌ Call initiation error:', data);
      this.emit('call:error', data);
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

    // call:connected - Call connected (BOTH users receive this after acceptance)
    // This is when WebRTC should be initialized
    socket.on('call:connected', (data: { 
      callId: string; 
      callState: string; 
      callerId?: string;
      callerName?: string;
      callerProfilePic?: string;
      receiverId?: string;
      receiverName?: string;
      callHistoryId?: string;
      metadata?: any;
    }) => {
      console.log('✅ Call connected - ready for WebRTC:', data);
      
      // Update current call if it matches
      if (this.currentCall && this.currentCall.callId === data.callId) {
        this.currentCall.callState = CallState.ACCEPTED;
        this.currentCall.callHistoryId = data.callHistoryId;
        if (data.receiverName) {
          // Caller received this - update receiver info
          this.currentCall.receiverName = data.receiverName;
        }
        if (data.callerName) {
          // Receiver received this - update caller info
          this.currentCall.callerName = data.callerName;
          this.currentCall.callerProfilePic = data.callerProfilePic;
        }
        this.emit('call:state-changed', this.currentCall);
      } else if (!this.currentCall) {
        // Might be a reconnect scenario - create call session
        this.currentCall = {
          callId: data.callId,
          callerId: data.callerId || '',
          receiverId: data.receiverId || '',
          callType: CallType.DIRECT_CALL,
          callState: CallState.ACCEPTED,
          callerName: data.callerName,
          callerProfilePic: data.callerProfilePic,
          callHistoryId: data.callHistoryId,
          metadata: data.metadata || {}
        };
        this.emit('call:state-changed', this.currentCall);
      }
      
      // Emit ready-for-webrtc event - WebRTC should initialize NOW
      this.emit('call:ready-for-webrtc', this.currentCall);
    });

    // call:unavailable - Receiver is offline/busy (for caller)
    socket.on('call:unavailable', (data: { error: string; receiverId: string }) => {
      console.log('❌ Call unavailable:', data);
      if (this.currentCall && this.currentCall.receiverId === data.receiverId) {
        this.updateCallState(CallState.ENDED);
        this.clearCall();
        this.emit('call:error', { error: data.error, receiverId: data.receiverId });
      }
    });

    // call:ended - Call ended (for both users)
    socket.on('call:ended', (data: { 
      callId: string; 
      callState: string; 
      reason?: string;
      endedBy?: string;
      cancelledBy?: string;
      declinedBy?: string;
    }) => {
      console.log('📴 Call ended:', data);
      if (this.currentCall && this.currentCall.callId === data.callId) {
        this.handleCallEnded(data);
      }
      if (this.incomingCall && this.incomingCall.callId === data.callId) {
        this.handleCallCancelled(data);
      }
    });

    console.log('✅ CallFlowService socket listeners set up');
  }

  /**
   * Initiate a call
   * @param receiverId - ID of the receiver
   * @param callType - 'direct_call' or 'match_call'
   * @param metadata - Additional metadata (isVideo, topic, etc.)
   */
  public async initiateCall(
    receiverId: string,
    callType: CallType,
    metadata: { isVideo?: boolean; topic?: string; level?: string; [key: string]: any } = {}
  ): Promise<void> {
    try {
      console.log(`📞 Initiating ${callType} call to ${receiverId}`);

      // Ensure socket is connected
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        await socketService.initialize();
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Emit call:initiate event
      socketService.socketEmit('call:initiate', {
        receiverId,
        callType,
        metadata
      });

      // Create local call session (will be updated by server response)
      this.currentCall = {
        callId: '', // Will be set by server
        callerId: '', // Will be set by server
        receiverId,
        callType,
        callState: CallState.CALLING,
        metadata
      };

      this.emit('call:state-changed', this.currentCall);

    } catch (error) {
      console.error('❌ Error initiating call:', error);
      this.emit('call:error', { error: error instanceof Error ? error.message : 'Failed to initiate call' });
      throw error;
    }
  }

  /**
   * Accept an incoming call
   * @param callId - Call session ID
   */
  public acceptCall(callId: string): void {
    try {
      console.log(`✅ Accepting call: ${callId}`);

      if (!this.incomingCall || this.incomingCall.callId !== callId) {
        console.warn('⚠️ No incoming call to accept');
        return;
      }

      // Emit call:accept event
      socketService.socketEmit('call:accept', { callId });

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
      this.emit('call:accepted', this.currentCall);
      this.emit('call:state-changed', this.currentCall);

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      this.emit('call:error', { error: error instanceof Error ? error.message : 'Failed to accept call' });
    }
  }

  /**
   * Decline an incoming call
   * @param callId - Call session ID
   */
  public declineCall(callId: string): void {
    try {
      console.log(`❌ Declining call: ${callId}`);

      if (!this.incomingCall || this.incomingCall.callId !== callId) {
        console.warn('⚠️ No incoming call to decline');
        return;
      }

      // Emit call:decline event
      socketService.socketEmit('call:decline', { callId });

      // Clear local state
      this.incomingCall = null;
      this.emit('call:declined', { callId });
      this.clearCall();

    } catch (error) {
      console.error('❌ Error declining call:', error);
      this.emit('call:error', { error: error instanceof Error ? error.message : 'Failed to decline call' });
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
   */
  private handleIncomingCall(data: IncomingCallData): void {
    this.incomingCall = data;

    // For match calls, auto-accept
    if (data.autoAccept || data.callType === CallType.MATCH_CALL) {
      console.log('🤝 Auto-accepting match call');
      this.acceptCall(data.callId);
    } else {
      // For direct calls, emit event for UI to show incoming call modal
      this.emit('call:incoming', data);
    }
  }

  /**
   * Handle call accepted
   */
  private handleCallAccepted(data: { callId: string; callState: string; receiverId?: string; receiverName?: string }): void {
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(data.callState as CallState);
      this.emit('call:ready-for-webrtc', this.currentCall);
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
   * Handle call cancelled
   */
  private handleCallCancelled(data: { callId: string; callState: string; cancelledBy?: string }): void {
    if (this.incomingCall && this.incomingCall.callId === data.callId) {
      this.incomingCall = null;
      this.emit('call:cancelled', data);
    }
  }

  /**
   * Handle call ended
   */
  private handleCallEnded(data: { callId: string; callState: string; endedBy?: string; reason?: string }): void {
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(CallState.ENDED);
      this.clearCall();
    }
  }

  /**
   * Handle call timeout
   */
  private handleCallTimeout(data: { callId: string }): void {
    if (this.currentCall && this.currentCall.callId === data.callId) {
      this.updateCallState(CallState.MISSED);
      this.clearCall();
    }
    if (this.incomingCall && this.incomingCall.callId === data.callId) {
      this.incomingCall = null;
    }
  }

  /**
   * Handle call initiated
   */
  private handleCallInitiated(data: { callId: string; callType: string; callState: string; receiverId: string; callHistoryId?: string }): void {
    if (this.currentCall) {
      this.currentCall.callId = data.callId;
      this.currentCall.callState = data.callState as CallState;
      this.currentCall.callHistoryId = data.callHistoryId;
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

