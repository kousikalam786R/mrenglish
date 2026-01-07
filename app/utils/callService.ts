import { Platform, NativeModules } from 'react-native';
import socketService from './socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices
} from 'react-native-webrtc';
import { getMeteredIceServers } from './turnService';

// Type definitions
export interface CallOptions {
  audio?: boolean;
  video?: boolean;
  isPartnerMatching?: boolean;
}

export enum CallStatus {
  IDLE = 'idle',
  CALLING = 'calling',       // Outgoing call in progress
  RINGING = 'ringing',       // Incoming call ringing
  CONNECTING = 'connecting', // Call accepted, WebRTC connecting
  CONNECTED = 'connected',   // Call is active
  RECONNECTING = 'reconnecting',
  ENDED = 'ended'
}

export interface CallState {
  status: CallStatus;
  remoteUserId: string;
  remoteUserName: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  callStartTime: number | null;
  callDuration: number;
  sdp?: string;              // Session description for signaling
  type?: string;             // SDP type (offer/answer)
  callHistoryId?: string;    // ID of the call in the database
}

// Default call state
export const initialCallState: CallState = {
  status: CallStatus.IDLE,
  remoteUserId: '',
  remoteUserName: '',
  isVideoEnabled: false,
  isAudioEnabled: true,
  callStartTime: null,
  callDuration: 0,
  callHistoryId: undefined
};

class CallService {
  private static instance: CallService;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private callState: CallState = { ...initialCallState };
  private durationTimer: NodeJS.Timeout | null = null;
  private connectionStateMonitor: NodeJS.Timeout | null = null;
  private connectingTimeout: NodeJS.Timeout | null = null; // Timeout for stuck CONNECTING state

  // Clear the duration timer
  private clearDurationTimer(): void {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  /**
   * 🔒 TERMINAL STATE GUARD: Check if call is in CONNECTED state
   * 
   * CONNECTED is a TERMINAL LOCKED STATE until call ends.
   * Once CONNECTED, status MUST NOT be downgraded by:
   * - syncStateFromRedux
   * - persisted state restore
   * - connection monitor
   * - socket state sync
   * 
   * Only endCall() may change CONNECTED → ENDED
   * 
   * @returns true if callService.callState.status === CONNECTED
   */
  private isTerminalConnected(): boolean {
    return this.callState.status === CallStatus.CONNECTED;
  }

  // Start monitoring connection state actively
  // 
  // 🔒 CONNECTED STATE LOCK:
  // - If status === CONNECTED, do not set RECONNECTING unless connectionState === 'failed'
  // - This prevents CONNECTED from being downgraded by transient connection state changes
  private startConnectionStateMonitor(): void {
    // Clear any existing monitor
    if (this.connectionStateMonitor) {
      clearInterval(this.connectionStateMonitor);
    }

    // Immediate check: Sometimes connection happens before monitor starts
    const checkConnection = () => {
      if (!this.pc) return false;
      
      const connState = this.pc.connectionState;
      const iceState = this.pc.iceConnectionState;
      
      // If already connected, update status immediately
      if (connState === 'connected' && (iceState === 'connected' || iceState === 'completed')) {
        if (this.callState.status === CallStatus.CONNECTING ||
            this.callState.status === CallStatus.CALLING ||
            this.callState.status === CallStatus.RECONNECTING) {
          console.log('✅ [Connection Monitor] Immediate check: Already connected!');
          const startTime = this.callState.callStartTime || Date.now();
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: startTime,
            callDuration: 0
          };
          
          this.startDurationTracking();
          this.emitCallStateChange();
          this.emitEvent('call-connected', {
            remoteUserId: this.callState.remoteUserId,
            timestamp: startTime
          });
          
          this.stopConnectionStateMonitor();
          this.stopConnectingTimeout();
          return true; // Connection detected
        }
      }
      return false; // Not connected yet
    };

    // Do immediate check
    if (checkConnection()) {
      return; // Already connected, no need to monitor
    }

    // Monitor connection state every 2 seconds
    this.connectionStateMonitor = setInterval(() => {
      if (!this.pc || this.callState.status === CallStatus.IDLE || this.callState.status === CallStatus.ENDED) {
        this.stopConnectionStateMonitor();
        return;
      }

      const connState = this.pc.connectionState;
      const iceState = this.pc.iceConnectionState;

      // Log current states for debugging
      if (connState !== 'connected' || iceState !== 'connected') {
        console.log(`🔍 Connection monitor: connState=${connState}, iceState=${iceState}, callStatus=${this.callState.status}`);
      }
      
      // 🔒 CONNECTED STATE LOCK: If currently CONNECTED, only allow downgrade to RECONNECTING if connection actually failed
      if (this.isTerminalConnected()) {
        // Only downgrade CONNECTED to RECONNECTING if WebRTC connection actually failed
        if (connState === 'failed' || iceState === 'failed') {
          console.log('🔒 [Connection Monitor] CONNECTED → RECONNECTING (WebRTC failed)');
          this.callState = {
            ...this.callState,
            status: CallStatus.RECONNECTING
          };
          this.emitCallStateChange();
          // Continue monitoring to try to recover
        } else {
          // CONNECTED state is locked - ignore transient 'connecting' or 'disconnected' states
          // These are normal during active calls (brief network hiccups)
          console.log('🔒 [Connection Monitor] CONNECTED state locked - ignoring transient state:', connState);
          return;
        }
      }
      
      // If we're actually connected but state says calling/reconnecting/connecting, update it
      // This is a fallback in case onconnectionstatechange event didn't fire properly
      if (connState === 'connected' && (iceState === 'connected' || iceState === 'completed')) {
        if (this.callState.status === CallStatus.CALLING || 
            this.callState.status === CallStatus.RECONNECTING ||
            this.callState.status === CallStatus.CONNECTING) {
          console.log('✅ Connection state monitor detected connected state - updating from', this.callState.status);
          console.log('   This is a fallback detection (onconnectionstatechange may not have fired)');
          
          const startTime = this.callState.callStartTime || Date.now();
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: startTime,
            callDuration: 0
          };
          
          this.startDurationTracking();
          this.emitCallStateChange();
          this.emitEvent('call-connected', {
            remoteUserId: this.callState.remoteUserId,
            timestamp: startTime
          });
          
          // Stop connection state monitor since we're connected
          this.stopConnectionStateMonitor();
          
          // Stop connecting timeout since we're now connected
          this.stopConnectingTimeout();
        }
      } else if (connState === 'failed' || iceState === 'failed') {
        console.log('❌ Connection failed according to monitor');
        // Only downgrade if not already CONNECTED (CONNECTED case handled above)
        if (!this.isTerminalConnected()) {
          this.stopConnectionStateMonitor();
        }
      } else if (connState === 'connecting' || iceState === 'checking') {
        // Still connecting, keep monitoring
        // 🔒 CONNECTED STATE LOCK: Do not downgrade CONNECTED to RECONNECTING here
        if (this.callState.status === CallStatus.CALLING && !this.isTerminalConnected()) {
          // Update to reconnecting if we're still in calling state (but not if already CONNECTED)
          this.callState = {
            ...this.callState,
            status: CallStatus.RECONNECTING
          };
          this.emitCallStateChange();
        }
      }
    }, 2000);
  }

  // Stop monitoring connection state
  private stopConnectionStateMonitor(): void {
    if (this.connectionStateMonitor) {
      clearInterval(this.connectionStateMonitor);
      this.connectionStateMonitor = null;
    }
  }

  // Start timeout for CONNECTING state - if stuck in CONNECTING for too long, end the call
  private startConnectingTimeout(): void {
    // Clear any existing timeout
    this.stopConnectingTimeout();

    // Set timeout to end call if stuck in CONNECTING for 30 seconds
    this.connectingTimeout = setTimeout(() => {
      if (this.callState.status === CallStatus.CONNECTING) {
        console.error('⏰ [callService] Connection timeout - stuck in CONNECTING state for 30 seconds');
        console.error('   Ending call due to connection failure');
        this.endCall();
      }
    }, 30000); // 30 seconds
  }

  // Stop the connecting timeout
  private stopConnectingTimeout(): void {
    if (this.connectingTimeout) {
      clearTimeout(this.connectingTimeout);
      this.connectingTimeout = null;
    }
  }

  // ICE server configuration fallbacks and base policies
  private readonly fallbackIceServers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    }
  ];

  private readonly rtcBaseConfiguration = {
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' as const,
    bundlePolicy: 'max-bundle' as const,
    rtcpMuxPolicy: 'require' as const
  };

  // State sync interval in milliseconds
  private syncInterval: number = 5000;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncAttempt: number = 0;
  private syncRetryCount: number = 0;
  private readonly MAX_SYNC_RETRIES: number = 3;

  private constructor() {
    // Load persisted call state on initialization
    this.loadPersistedCallState();
  }

  private async createPeerConnection(): Promise<RTCPeerConnection> {
    // Pass empty array to ensure TURN servers are fetched and used
    // Fallback STUN servers will be added by getMeteredIceServers if TURN fails
    const iceServers = await getMeteredIceServers([]);
    console.log(
      'Using ICE servers:',
      iceServers.map((server) => ({
        urls: server.urls,
        hasCredential: Boolean(server.credential),
        hasUsername: Boolean(server.username),
        isTURN: Boolean(server.credential && server.username) // TURN servers have credentials
      }))
    );

    // Log TURN server availability
    const hasTURN = iceServers.some(server => server.credential && server.username);
    if (hasTURN) {
      console.log('✅ TURN relay servers available - connection will work across all networks');
    } else {
      console.warn('⚠️ No TURN servers available - connection may fail on WiFi→Mobile or Mobile→Mobile');
    }

    return new RTCPeerConnection({
      ...this.rtcBaseConfiguration,
      iceServers
    });
  }

  // Track ICE candidates as they're generated
  private iceCandidateCount = 0;
  private relayCandidateCount = 0;
  private hostCandidateCount = 0;
  private srflxCandidateCount = 0;
  private candidateTypes: { host: number; srflx: number; relay: number } = {
    host: 0,
    srflx: 0,
    relay: 0
  };

  // Wait for ICE candidates to be gathered, especially TURN relay candidates
  private waitForIceCandidates(maxWaitMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc) {
        resolve();
        return;
      }

      const startTime = Date.now();
      let checkInterval: NodeJS.Timeout;
      let gatheringStarted = false;
      
      // Reset counters (but don't reset if we're already gathering)
      if (this.pc.iceGatheringState === 'new') {
        this.iceCandidateCount = 0;
        this.relayCandidateCount = 0;
        this.hostCandidateCount = 0;
        this.srflxCandidateCount = 0;
        this.candidateTypes = { host: 0, srflx: 0, relay: 0 };
      }

      const checkCandidates = () => {
        if (!this.pc) {
          clearInterval(checkInterval);
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        const gatheringState = this.pc.iceGatheringState;

        // Wait for gathering to actually start
        if (gatheringState === 'gathering' && !gatheringStarted) {
          gatheringStarted = true;
          console.log('✅ ICE gathering started, waiting for candidates...');
        }

        // Only log if gathering has started or we've waited a while
        if (gatheringStarted || elapsed > 1000) {
         // console.log(`🔍 ICE gathering check: state=${gatheringState}, candidates=${this.iceCandidateCount}, relay=${this.relayCandidateCount}, elapsed=${elapsed}ms`);
        }

        // If gathering is complete, we're done
        if (gatheringState === 'complete') {
          console.log(`✅ ICE gathering completed: ${this.iceCandidateCount} total candidates, ${this.relayCandidateCount} relay candidates`);
          if (this.relayCandidateCount > 0) {
            console.log('✅ TURN relay candidates will be included in SDP');
          } else {
            console.log('⚠️ No TURN relay candidates found - connection may fail on mobile data');
          }
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // If we've waited long enough, proceed (even if gathering isn't complete)
        if (elapsed >= maxWaitMs) {
          console.log(`⏱️ ICE gathering timeout (${maxWaitMs}ms) - proceeding with ${this.iceCandidateCount} candidates (${this.relayCandidateCount} relay)`);
          if (this.relayCandidateCount > 0) {
            console.log('✅ TURN relay candidates were gathered, proceeding with offer');
          } else if (elapsed >= 3000) {
            // If we've waited at least 3 seconds and still no relay, proceed anyway
            // (might work with host/srflx candidates if on same network)
            console.log('⚠️ Proceeding without TURN relay candidates - may work if both users on same network');
          }
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // If we have relay candidates and have waited at least 2 seconds, wait a bit more for completion
        if (this.relayCandidateCount > 0 && gatheringState === 'gathering' && elapsed >= 2000) {
          // Give it a bit more time to complete gathering
          if (elapsed >= maxWaitMs - 1000) {
            console.log('✅ TURN relay candidates found, proceeding with offer');
            clearInterval(checkInterval);
            resolve();
          }
        }
      };

      // Start checking candidates
      checkInterval = setInterval(checkCandidates, 100);
    });
  }

  /**
   * Determine and log the connection type (P2P vs TURN relay)
   * Uses WebRTC stats API to check which candidate pair is actually being used
   */
  private async logConnectionType(): Promise<void> {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      let connectionType: 'P2P (Direct)' | 'P2P (STUN)' | 'TURN Relay' | 'Unknown' = 'Unknown';
      let localCandidateType = '';
      let remoteCandidateType = '';
      let candidatePair: any = null;

      // Find the active candidate pair
      stats.forEach((report: any) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          candidatePair = report;
        }
      });

      if (candidatePair) {
        // Get local and remote candidate types
        stats.forEach((report: any) => {
          if (report.type === 'local-candidate' && report.id === candidatePair.localCandidateId) {
            localCandidateType = report.candidateType || '';
          }
          if (report.type === 'remote-candidate' && report.id === candidatePair.remoteCandidateId) {
            remoteCandidateType = report.candidateType || '';
          }
        });

        // Determine connection type based on candidate types
        const isRelay = localCandidateType === 'relay' || remoteCandidateType === 'relay';
        const isSrflx = localCandidateType === 'srflx' || remoteCandidateType === 'srflx';
        const isHost = localCandidateType === 'host' && remoteCandidateType === 'host';

        if (isRelay) {
          connectionType = 'TURN Relay';
        } else if (isHost) {
          connectionType = 'P2P (Direct)';
        } else if (isSrflx) {
          connectionType = 'P2P (STUN)';
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 CONNECTION TYPE ANALYSIS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔗 Connection Type: ${connectionType === 'TURN Relay' ? '🔄 TURN RELAY' : connectionType === 'P2P (STUN)' ? '🌐 P2P (STUN)' : '🏠 P2P (Direct)'}`);
        console.log(`   Local Candidate: ${localCandidateType || 'unknown'}`);
        console.log(`   Remote Candidate: ${remoteCandidateType || 'unknown'}`);
        console.log(`   RTT: ${candidatePair.currentRoundTripTime ? (candidatePair.currentRoundTripTime * 1000).toFixed(2) + 'ms' : 'N/A'}`);
        console.log(`   Bytes Sent: ${candidatePair.bytesSent || 0}`);
        console.log(`   Bytes Received: ${candidatePair.bytesReceived || 0}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (connectionType === 'TURN Relay') {
          console.log('✅ Using TURN RELAY - Connection works across all networks (WiFi, Mobile Data, NAT)');
        } else if (connectionType === 'P2P (STUN)') {
          console.log('✅ Using P2P with STUN - Direct connection through NAT (faster, lower latency)');
        } else if (connectionType === 'P2P (Direct)') {
          console.log('✅ Using DIRECT P2P - Same network connection (fastest, lowest latency)');
        }
      } else {
        // Fallback: use candidate counts to estimate
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 CONNECTION TYPE (Estimated from candidates)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (this.relayCandidateCount > 0) {
          console.log('🔄 Likely using TURN RELAY (relay candidates available)');
        } else if (this.srflxCandidateCount > 0) {
          console.log('🌐 Likely using P2P with STUN (srflx candidates available)');
        } else if (this.hostCandidateCount > 0) {
          console.log('🏠 Likely using DIRECT P2P (host candidates only)');
        }
        console.log(`   Candidate Summary: Host=${this.hostCandidateCount}, STUN=${this.srflxCandidateCount}, TURN=${this.relayCandidateCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (error) {
      console.warn('⚠️ Could not determine connection type from stats:', error);
      // Fallback to candidate counts
      console.log('📊 Connection Type (Estimated):');
      if (this.relayCandidateCount > 0) {
        console.log('   🔄 TURN RELAY candidates were generated');
      } else if (this.srflxCandidateCount > 0) {
        console.log('   🌐 STUN (srflx) candidates were generated');
      } else {
        console.log('   🏠 Only HOST candidates (direct P2P)');
      }
    }
  }

  public static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
      
      // Initialize socket listeners as part of the singleton creation
      // This ensures the instance will have all methods before it's used
      setTimeout(() => {
        CallService.instance.initialize();
      }, 0);
    }
    return CallService.instance;
  }
  
  // Force a reset of the singleton for testing/development
  public static resetInstance(): void {
    if (CallService.instance) {
      try {
        // End any ongoing call
        CallService.instance.endCall();
      } catch (e) {
        console.error('Error ending call during reset:', e);
      }
      
      // Clear instance
      CallService.instance = new CallService();
      
      // Reset socket listeners flag
      CallService.instance.socketListenersSetup = false;
      
      // Re-initialize
      CallService.instance.initialize();
      console.log('CallService instance has been reset');
    }
  }

  // Initialize the call service and set up event listeners
  private socketListenersSetup = false;
  // ✅ REQUIREMENT 2: Track processed call:start events by callId to prevent duplicate WebRTC starts
  private processedReadyForWebRTCCallIds: Set<string> = new Set();

  public initialize(): void {
    const socket = socketService.getSocket();
    
    // CRITICAL: Socket must be connected for listeners to work
    if (!socket) {
      console.warn('⚠️ [callService] Cannot initialize - socket is null');
      console.warn('   Will retry when socket is available');
      // Don't mark as setup, allow retry
      return;
    }
    
    if (!socket.connected) {
      console.warn('⚠️ [callService] Cannot initialize - socket is not connected');
      console.warn('   Socket ID:', socket.id, 'Connected:', socket.connected);
      console.warn('   Will retry when socket connects');
      // Don't mark as setup, allow retry
      return;
    }
    
    // ✅ FIX #3: Prevent duplicate socket listeners
    if (this.socketListenersSetup) {
      console.log('⚠️ [callService] Socket listeners already setup, skipping duplicate initialization');
      return;
    }
    
    console.log('🔧 [callService] Setting up socket listeners for WebRTC signaling');
    console.log('   Socket ID:', socket.id);
    console.log('   Socket connected:', socket.connected);
    
    // Register socket event listeners for call signaling
    socket.on('call-offer', this.handleCallOffer);
    socket.on('call-answer', this.handleCallAnswer);
    socket.on('call-ice-candidate', this.handleIceCandidate);
    socket.on('call-end', this.handleCallEnd);
    
    // Register video upgrade event listeners
    socket.on('video-upgrade-request', this.handleVideoUpgradeRequest);
    socket.on('video-upgrade-accepted', this.handleVideoUpgradeAccepted);
    socket.on('video-upgrade-rejected', this.handleVideoUpgradeRejected);
    
    // Register state sync listener
    socket.on('call-state-sync', this.handleStateSync);
    
    // Register internal event listeners
    this.addEventListener('call-connected', this.handleCallConnected);
    
    // ✅ REQUIREMENT 2: callService listens to call:start directly (not via callFlowService)
    // This ensures callService is the ONLY place that starts WebRTC
    socket.on('call:start', this.handleCallStartForWebRTC);
    console.log('✅ [callService] call:start listener registered (direct socket listener)');
    console.log('   This is CRITICAL for WebRTC to start!');
    
    // Mark as setup
    this.socketListenersSetup = true;
    console.log('✅ [callService] Socket listeners setup complete');
    
    // ✅ FIX: Load persisted state ASYNC but don't let it override active calls
    // This runs after all syncs, so it won't override CONNECTING state
    this.loadPersistedCallState().catch((error) => {
      console.error('❌ [callService] Error loading persisted state:', error);
    });
  }

  /**
   * ✅ REQUIREMENT 2: Handle call:start socket event directly
   * This is the ONLY place WebRTC starts - callFlowService no longer emits events
   * - Caller: Creates offer and sends
   * - Receiver: Waits for offer (handled by handleCallOffer)
   */
  private handleCallStartForWebRTC = async (data: { callId: string; callerId: string; receiverId: string; metadata?: any; callHistoryId?: string }): Promise<void> => {
    console.log('🎬 [callService] ========== call:start socket event received ==========');
    console.log('   Data:', JSON.stringify(data, null, 2));
    
    const callId = data.callId;
    if (!callId) {
      console.error('❌ [callService] call:start received without callId');
      return;
    }
    
    // ✅ REQUIREMENT 2: Guard WebRTC start by callId - only one PeerConnection per call
    if (this.processedReadyForWebRTCCallIds.has(callId)) {
      console.warn('⚠️ [callService] Duplicate call:start ignored for callId:', callId);
      console.warn('   WebRTC already started for this call');
      return; // Already processed, ignore duplicate
    }
    
    // Mark as processed immediately to prevent race conditions
    this.processedReadyForWebRTCCallIds.add(callId);
    console.log('✅ [callService] call:start processing started for callId:', callId);
    console.log('   Current callService state:', this.callState.status);
    
    // Determine role (caller or receiver)
    const { store } = require('../redux/store');
    const currentUserId = store.getState().auth.userId;
    const isCaller = data.callerId === currentUserId;
    const isReceiver = data.receiverId === currentUserId;
    
    console.log('🎬 [callService] call:start received - Starting WebRTC');
    console.log('   Role:', isCaller ? 'CALLER (will create offer)' : 'RECEIVER (will wait for offer)');
    console.log('   Current callService state:', this.callState.status);
    
    // ✅ REQUIREMENT 4: Always sync state from Redux (source of truth)
    // This ensures state is correct even if loadPersistedCallState reset it
    try {
      const reduxState = store.getState().call.activeCall;
      console.log('🔄 [callService] Syncing state from Redux (source of truth)');
      console.log('   Redux state:', reduxState.status);
      console.log('   callService state before sync:', this.callState.status);
      
      // Always sync from Redux - it's the source of truth
      this.syncStateFromRedux(reduxState);
      console.log('✅ [callService] State synced from Redux:', this.callState.status);
    } catch (error) {
      console.error('❌ [callService] Failed to sync from Redux:', error);
    }
    
    if (isCaller) {
      // Caller creates offer
      try {
        const receiverId = data.receiverId;
        const reduxState = store.getState().call.activeCall;
        const receiverName = reduxState.remoteUserName || 'User';
        const isVideo = data.metadata?.isVideo || false;
        
        console.log('📞 [callService] CALLER: Creating WebRTC offer...');
        await this.startCall(receiverId, receiverName, {
          audio: true,
          video: isVideo
        }, true); // isCaller = true
        console.log('✅ [callService] CALLER: WebRTC offer created and sent');
      } catch (error: any) {
        console.error('❌ [callService] CALLER: Error starting WebRTC:', error);
        this.emitEvent('webrtc-error', { error: error.message });
        // Remove from processed set on error so it can be retried
        this.processedReadyForWebRTCCallIds.delete(callId);
      }
    } else if (isReceiver) {
      // Receiver waits for offer (handled by handleCallOffer)
      console.log('📞 [callService] RECEIVER: Waiting for WebRTC offer from caller');
      console.log('   State:', this.callState.status);
      console.log('   Offer will be processed by handleCallOffer when received');
      
      // Ensure callService is ready to receive offer
      if (this.callState.status !== CallStatus.CONNECTING) {
        console.warn('⚠️ [callService] RECEIVER: State is not CONNECTING:', this.callState.status);
        console.warn('   Re-syncing from Redux to ensure correct state...');
        try {
          const reduxState = store.getState().call.activeCall;
          if (reduxState.status === CallStatus.CONNECTING) {
            this.syncStateFromRedux(reduxState);
            console.log('✅ [callService] State corrected to CONNECTING');
          }
        } catch (error) {
          console.error('❌ [callService] Failed to re-sync state:', error);
        }
      }
    }
  };

  // Create an outgoing call
  public async startCall(userId: string, userName: string, options: CallOptions = { audio: true, video: false }, isCaller: boolean = true): Promise<void> {
    try {
      // ✅ TASK 2: Guard against multiple WebRTC starts
      // Check if we already have a peer connection for this user
      if (this.pc && this.callState.remoteUserId === userId) {
        console.warn('⚠️ [callService] WebRTC already started for this user:', userId);
        console.warn('   Skipping duplicate startCall() call');
        return; // Already started, don't start again
      }
      
      // Check if already in a call
      // Allow CONNECTING status for lazy-loading phase (WebRTC initialization)
      if (this.callState.status !== CallStatus.IDLE && this.callState.status !== CallStatus.CONNECTING) {
        throw new Error('Already in a call');
      }
      
      // If already CONNECTING, we're just continuing WebRTC setup (lazy-loading)
      if (this.callState.status === CallStatus.CONNECTING) {
        console.log('🔄 [callService] Continuing WebRTC setup from CONNECTING state (lazy-loading phase)');
      }

      console.log(`Starting call to ${userName} (${userId}) with options:`, options);
      
      // Reset ICE candidate counters
      this.iceCandidateCount = 0;
      this.relayCandidateCount = 0;
      
      // Mark if this is a partner matching call
      if (options.isPartnerMatching) {
        console.log('🤝 This is a partner matching call - will auto-accept on receiver end');
      }

      // ✅ TASK 4: Don't reset state if already CONNECTING (preserve Redux state from callFlowService)
      // Only update internal callService state, don't override CONNECTING from Redux
      const preserveConnecting = this.callState.status === CallStatus.CONNECTING;

      // Update call state
      this.callState = {
        ...(preserveConnecting ? this.callState : initialCallState),
        status: preserveConnecting ? CallStatus.CONNECTING : CallStatus.CALLING,
        remoteUserId: userId,
        remoteUserName: userName,
        isVideoEnabled: options.video || false,
        isAudioEnabled: options.audio !== false, // Default to true if not specified
      };
      
      if (preserveConnecting) {
        console.log('✅ [callService] Preserving CONNECTING status (Redux owns this state)');
      }
      
      this.emitCallStateChange();

      // Initialize WebRTC - this will create the peer connection and set up media
      await this.initializeWebRTC(options);

      if (!this.pc) {
        throw new Error('Failed to initialize peer connection');
      }

      // Create offer with appropriate constraints
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: options.video || false,
        voiceActivityDetection: true
      };

      // Double-check peer connection is still valid before creating offer
      if (!this.pc) {
        throw new Error('Peer connection was closed during initialization');
      }

      console.log('Creating offer with signaling state:', this.pc.signalingState);
      const offer = await this.pc.createOffer(offerOptions);
      console.log('Offer created successfully');

      // Triple-check peer connection is still valid before setting local description
      if (!this.pc) {
        throw new Error('Peer connection was closed after creating offer');
      }

      // Set local description - THIS STARTS ICE GATHERING
      await this.pc.setLocalDescription(offer);
      console.log('Local description (offer) set successfully - ICE gathering started');
      
      // Give ICE gathering a moment to actually start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // CRITICAL: Wait for ICE candidates to be gathered (especially TURN relay candidates)
      // This is critical for mobile data users who need TURN servers
      // We wait AFTER setting local description because that's when ICE gathering actually starts
      console.log('Waiting for ICE candidates to be gathered (especially TURN relay candidates)...');
      await this.waitForIceCandidates(8000); // Wait up to 8 seconds for candidates
      
      // Get the updated SDP with all gathered candidates
      const finalOffer = this.pc.localDescription;
      if (!finalOffer) {
        throw new Error('Local description not available after ICE gathering');
      }
      
      // Verify SDP was updated with candidates
      const originalSdpLength = offer.sdp.length;
      const finalSdpLength = finalOffer.sdp.length;
      const sdpUpdated = finalSdpLength > originalSdpLength;
      
      console.log(`✅ Using updated SDP with ${this.iceCandidateCount} total candidates (${this.relayCandidateCount} relay)`);
      console.log(`   SDP size: ${originalSdpLength} → ${finalSdpLength} bytes (${sdpUpdated ? 'updated ✓' : 'not updated ✗'})`);
      
      if (this.relayCandidateCount > 0) {
        console.log('✅ TURN relay candidates included in SDP - cross-network connection should work!');
        
        // Verify relay candidates are in the SDP
        const hasRelayInSdp = finalOffer.sdp.includes('typ relay');
        if (hasRelayInSdp) {
          console.log('✅ Verified: TURN relay candidates found in SDP string');
        } else {
          console.warn('⚠️ Warning: TURN relay candidates not found in SDP string (may be in candidate events only)');
        }
      } else {
        console.warn('⚠️ No TURN relay candidates in SDP - connection may fail on mobile data');
      }

      // Send offer to remote user with updated SDP that includes all ICE candidates
      console.log(`Sending call offer to ${userId}`);
      socketService.getSocket()?.emit('call-offer', {
        targetUserId: userId,
        sdp: finalOffer.sdp, // Use updated SDP with all candidates
        type: finalOffer.type,
        isVideo: options.video || false,
        isPartnerMatching: options.isPartnerMatching || false
      });

      // Set a timeout for call answer
      setTimeout(() => {
        if (this.callState.status === CallStatus.CALLING) {
          console.log('Call offer timeout - no answer received');
          this.endCall();
        }
      }, 30000); // 30 seconds timeout for call answer

    } catch (error) {
      console.error('Error starting call:', error);
      this.endCall();
      throw error;
    }
  }

  // Handle incoming call
  private handleCallOffer = async (data: any) => {
    try {
      console.log('🔍 CALL OFFER RECEIVED:', JSON.stringify(data, null, 2));
      const { callerId, callerName, sdp, type, isVideo, callHistoryId, renegotiation, isPartnerMatching } = data;
      
      // ✅ REQUIREMENT 2: Receiver must ALWAYS process call-offer (remove state-based blocking)
      // Sync state from Redux first (source of truth) before checking
      try {
        const { store } = require('../redux/store');
        const reduxState = store.getState().call.activeCall;
        
        // If Redux says CONNECTING but callService says IDLE, sync immediately
        if (reduxState.status === CallStatus.CONNECTING && 
            (this.callState.status === CallStatus.IDLE || this.callState.status === CallStatus.ENDED)) {
          console.warn('⚠️ [handleCallOffer] State mismatch detected!');
          console.warn('   Redux state:', reduxState.status);
          console.warn('   callService state:', this.callState.status);
          console.warn('   Syncing from Redux (source of truth)...');
          this.syncStateFromRedux(reduxState);
          console.log('✅ [handleCallOffer] State synced, new state:', this.callState.status);
        }
      } catch (error) {
        console.error('❌ [handleCallOffer] Failed to sync from Redux:', error);
      }
      
      // ✅ REQUIREMENT 2: Allow processing offers in CONNECTING state (receiver waiting for offer)
      // Only block if we're in CONNECTED state (unless renegotiation)
      if (!renegotiation && this.callState.status === CallStatus.CONNECTED) {
        console.warn('⚠️ Ignoring call offer: Already in CONNECTED call. Current status:', this.callState.status);
        // If this is a partner matching call and we're already in a call, end the current call first
        if (isPartnerMatching) {
          console.log('🤝 Ending current call to accept partner matching call');
          this.endCall();
          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          return; // Ignore regular call offers when already in CONNECTED call
        }
      }
      
      // ✅ REQUIREMENT 2: Always log offer reception - receiver should process it
      if (this.callState.status === CallStatus.CONNECTING) {
        console.log('✅ [handleCallOffer] Received WebRTC offer during CONNECTING phase (lazy-loading)');
        console.log('   This is expected - receiver accepted invitation and is waiting for offer');
      } else if (this.callState.status === CallStatus.IDLE || this.callState.status === CallStatus.ENDED) {
        console.log('⚠️ [handleCallOffer] Received offer but state is:', this.callState.status);
        console.log('   Processing anyway - receiver should always accept offers after invitation acceptance');
        // Update state to CONNECTING if it was reset
        try {
          const { store } = require('../redux/store');
          const reduxState = store.getState().call.activeCall;
          if (reduxState.status === CallStatus.CONNECTING) {
            this.syncStateFromRedux(reduxState);
            console.log('✅ [handleCallOffer] State updated to CONNECTING from Redux');
          }
        } catch (error) {
          console.error('❌ [handleCallOffer] Failed to sync state:', error);
        }
      }
      
      console.log('🔍 EXTRACTED VALUES:', {
        callerId,
        callerName,
        isVideo,
        callHistoryId,
        renegotiation,
        isPartnerMatching: isPartnerMatching,
        isPartnerMatchingType: typeof isPartnerMatching
      });
      
      // Check if this is a partner matching call (auto-accept)
      if (isPartnerMatching) {
        console.log('🤝 Partner matching call detected - auto-accepting');
        console.log('🤝 PARTNER MATCHING FLOW ACTIVATED');
      } else {
        console.log('📞 Regular call detected - showing incoming call modal');
        console.log('📞 isPartnerMatching value:', isPartnerMatching);
      }
      
      // Handle renegotiation during an active call
      if (renegotiation === true && this.pc && this.callState.status === CallStatus.CONNECTED) {
        console.log('Handling renegotiation offer during active call');
        
        try {
          // Apply the remote description for the renegotiation
          const remoteDesc = new RTCSessionDescription({
            type: 'offer',
            sdp
          });
          
          await this.pc.setRemoteDescription(remoteDesc);
          console.log('Set remote description for renegotiation');
          
          // Create answer for the renegotiation
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          console.log('Created and set local answer for renegotiation');
          
          // Send the answer back
          socketService.getSocket()?.emit('call-answer', {
            targetUserId: callerId,
            sdp: answer.sdp,
            type: answer.type,
            accepted: true,
            callHistoryId: this.callState.callHistoryId,
            renegotiation: true
          });
          
          // Update video state if needed
          if (isVideo) {
            this.callState = {
              ...this.callState,
              isVideoEnabled: true
            };
            this.emitCallStateChange();
          }
        } catch (error) {
          console.error('Error handling renegotiation:', error);
        }
        
        return;
      }
      
      // Normal call offer handling for new calls
      // If status is already CONNECTING (lazy-loading phase), keep it and auto-accept
      // Otherwise, set to RINGING (legacy flow)
      const shouldAutoAccept = this.callState.status === CallStatus.CONNECTING || isPartnerMatching;
      
      const previousStatus = this.callState.status;
      const newStatus = shouldAutoAccept ? CallStatus.CONNECTING : CallStatus.RINGING;
      
      this.callState = {
        ...this.callState.status === CallStatus.CONNECTING ? this.callState : initialCallState,
        status: newStatus,
        remoteUserId: callerId,
        remoteUserName: callerName || 'Unknown Caller',
        isVideoEnabled: isVideo || false,
        isAudioEnabled: true,
        sdp: sdp,
        type: type,
        callHistoryId: callHistoryId || this.callState.callHistoryId
      };
      
      console.log('Updated call state with offer SDP data and callHistoryId:', callHistoryId || this.callState.callHistoryId);
      if (this.callState.status === CallStatus.CONNECTING) {
        console.log('✅ [handleCallOffer] Keeping CONNECTING status (lazy-loading phase)');
        // Start connecting timeout if status just became CONNECTING
        if (previousStatus !== CallStatus.CONNECTING) {
          console.log('⏰ [handleCallOffer] Starting connecting timeout (30 seconds)');
          this.startConnectingTimeout();
        }
      }
      this.emitCallStateChange();
      
      // Auto-accept partner matching calls OR if we're in CONNECTING phase (invitation already accepted)
      if (shouldAutoAccept) {
        if (this.callState.status === CallStatus.CONNECTING) {
          console.log('✅ [handleCallOffer] Auto-accepting WebRTC offer IMMEDIATELY (invitation already accepted, lazy-loading)');
          console.log('   RECEIVER: Will create answer and send to caller');
        } else {
        console.log('🤝 Auto-accepting partner matching call');
        }
        (this as any).wasPartnerMatchingCall = isPartnerMatching; // Mark as partner matching call only if it actually is
        
        // ✅ TASK 2 & 3: For CONNECTING phase, accept immediately (no delay needed)
        // The invitation was already accepted, so we can proceed right away
        const acceptCallAsync = async () => {
          try {
            // ✅ REQUIREMENT 2: Always process offer - don't block on state checks
            // Sync state from Redux first to ensure it's correct
            try {
              const { store } = require('../redux/store');
              const reduxState = store.getState().call.activeCall;
              if (reduxState.status === CallStatus.CONNECTING) {
                this.syncStateFromRedux(reduxState);
                console.log('✅ [acceptCallAsync] State synced from Redux:', this.callState.status);
              }
            } catch (error) {
              console.error('❌ [acceptCallAsync] Failed to sync from Redux:', error);
            }
            
            // Verify we have the SDP offer
            if (!this.callState.sdp && !sdp) {
              console.error('❌ No SDP offer available for auto-accept');
              console.error('   Current call state:', this.callState);
              console.error('   Received data:', { sdp: !!sdp, sdpLength: sdp?.length });
              return;
            }
            
            // Use SDP from received data if callState doesn't have it
            if (!this.callState.sdp && sdp) {
              this.callState.sdp = sdp;
              this.callState.type = type;
            }
            
            if (this.callState.status === CallStatus.CONNECTING) {
              console.log('📞 [handleCallOffer] RECEIVER: Creating answer for WebRTC offer (CONNECTING phase)...');
            } else {
              console.log('📞 [handleCallOffer] Creating answer for offer (auto-accept)...');
            }
            
            await this.acceptCall({ audio: true, video: isVideo || false });
            
            console.log('✅ WebRTC offer accepted - answer created and sent');
            console.log('   Call state:', this.callState.status);
            
            // Emit navigation event for partner matching calls
            if (isPartnerMatching) {
            console.log('📤 EMITTING partner-call-auto-accepted event with data:', {
              callerId,
              callerName,
              isVideo: isVideo || false,
              callHistoryId
            });
            
            this.emitEvent('partner-call-auto-accepted', {
              callerId,
              callerName,
              isVideo: isVideo || false,
              callHistoryId
            });
            
            console.log('📤 partner-call-auto-accepted event EMITTED');
            }
          } catch (error: any) {
            console.error('❌ Error auto-accepting call:', error);
            this.endCall();
          }
        };
        
        // ✅ REQUIREMENT 3: Receiver must ALWAYS process offers
        // Process immediately regardless of state (after syncing from Redux)
        acceptCallAsync(); // Immediate execution
      } else {
        // Only emit incoming-call event for regular calls
        this.emitEvent('incoming-call', data);
      }

    } catch (error) {
      console.error('Error handling call offer:', error);
      this.endCall();
    }
  }

  // Accept an incoming call
  public async acceptCall(options: CallOptions = { audio: true, video: false }): Promise<void> {
    try {
      // Allow accepting when RINGING (legacy) or CONNECTING (lazy-loading phase)
      if (this.callState.status !== CallStatus.RINGING && this.callState.status !== CallStatus.CONNECTING) {
        throw new Error('No incoming call to accept');
      }
      
      if (this.callState.status === CallStatus.CONNECTING) {
        console.log('✅ [acceptCall] Accepting WebRTC offer during CONNECTING phase (lazy-loading)');
      }

      // Store the SDP offer we received earlier
      const offerSdp = this.callState.sdp;
      if (!offerSdp) {
        throw new Error('No offer SDP available to accept call');
      }

      // Start state sync for reliability
      this.startStateSync();

      // Reset ICE candidate counters for receiver side
      this.iceCandidateCount = 0;
      this.relayCandidateCount = 0;

      // Initialize WebRTC
      await this.initializeWebRTC(options);

      if (!this.pc) {
        throw new Error('Failed to initialize peer connection');
      }

      // Verify peer connection is in a valid state
      if (!this.pc.signalingState) {
        throw new Error('Peer connection signaling state is not available');
      }

      console.log('Setting remote description (offer) with signaling state:', this.pc.signalingState);
      
      // Check if peer connection is already in use (should be 'stable' for a new connection)
      if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'have-local-offer') {
        console.warn('⚠️ Peer connection is not in expected state:', this.pc.signalingState);
        // If it's in an invalid state, we need to reset it
        if (this.pc.signalingState === 'have-remote-offer' || this.pc.signalingState === 'have-local-pranswer') {
          console.log('Peer connection already has an offer, attempting to continue...');
        } else {
          throw new Error(`Peer connection is in invalid state for accepting call: ${this.pc.signalingState}`);
        }
      }

      // Set remote description (the offer)
      const remoteDesc = new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      });
      
      await this.pc.setRemoteDescription(remoteDesc);
      console.log('Successfully set remote description (offer) - ICE gathering will start after local description');
      
      // Verify peer connection state after setting remote description
      if (!this.pc || !this.pc.signalingState) {
        throw new Error('Peer connection became invalid after setting remote description');
      }
      
      const currentState = this.pc.signalingState;
      console.log('Peer connection state after setRemoteDescription:', currentState);
      
      // Verify we're in the correct state to create an answer
      if (currentState !== 'have-remote-offer' && currentState !== 'have-local-pranswer') {
        throw new Error(`Cannot create answer: peer connection is in state '${currentState}', expected 'have-remote-offer' or 'have-local-pranswer'`);
      }

      // Create answer
      console.log('Creating answer with signaling state:', currentState);
      const answer = await this.pc.createAnswer();
      console.log('Answer created successfully');
      
      // Set local description - THIS STARTS ICE GATHERING on receiver side
      await this.pc.setLocalDescription(answer);
      console.log('Successfully set local description (answer) - ICE gathering started');
      
      // CRITICAL: Wait for ICE candidates to be gathered (especially TURN relay candidates)
      // This is essential when BOTH users are on mobile data - receiver also needs TURN
      console.log('Waiting for ICE candidates to be gathered (especially TURN relay candidates)...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Give ICE gathering a moment to start
      await this.waitForIceCandidates(8000); // Wait up to 8 seconds for candidates
      
      // Get the updated SDP with all gathered candidates
      const finalAnswer = this.pc.localDescription;
      if (!finalAnswer) {
        throw new Error('Local description not available after ICE gathering');
      }
      
      // Verify SDP was updated with candidates
      const originalSdpLength = answer.sdp.length;
      const finalSdpLength = finalAnswer.sdp.length;
      const sdpUpdated = finalSdpLength > originalSdpLength;
      
      console.log(`✅ Using updated answer SDP with ${this.iceCandidateCount} total candidates (${this.relayCandidateCount} relay)`);
      console.log(`   SDP size: ${originalSdpLength} → ${finalSdpLength} bytes (${sdpUpdated ? 'updated ✓' : 'not updated ✗'})`);
      
      if (this.relayCandidateCount > 0) {
        console.log('✅ TURN relay candidates included in answer SDP - mobile-to-mobile connection should work!');
        
        // Verify relay candidates are in the SDP
        const hasRelayInSdp = finalAnswer.sdp.includes('typ relay');
        if (hasRelayInSdp) {
          console.log('✅ Verified: TURN relay candidates found in answer SDP string');
        } else {
          console.warn('⚠️ Warning: TURN relay candidates not found in SDP string (may be in candidate events only)');
        }
      } else {
        console.warn('⚠️ No TURN relay candidates in answer SDP - mobile-to-mobile connection may fail');
      }

      // Set call start time and update state
      const callStartTime = Date.now();
      console.log('Setting and sending call start time:', callStartTime);

      // Create the answer payload with updated SDP that includes all ICE candidates
      const answerPayload = {
        targetUserId: this.callState.remoteUserId,
        sdp: finalAnswer.sdp, // Use updated SDP with all candidates
        type: finalAnswer.type,
        accepted: true,
        callHistoryId: this.callState.callHistoryId,
        callStartTime: callStartTime
      };

      // ✅ TASK 3: Send answer to caller (RECEIVER creates and sends answer)
      console.log('📤 [RECEIVER] Sending answer to caller:', this.callState.remoteUserId);
      console.log('   Answer payload:', {
        targetUserId: answerPayload.targetUserId,
        accepted: answerPayload.accepted,
        callHistoryId: answerPayload.callHistoryId,
        sdpLength: answerPayload.sdp.length
      });
      
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.error('❌ [RECEIVER] Cannot send answer: Socket not connected!');
        console.error('   Socket exists:', !!socket);
        console.error('   Socket connected:', socket?.connected);
        throw new Error('Socket not connected - cannot send answer');
      }
      
      socket.emit('call-answer', answerPayload);
      console.log('✅ [RECEIVER] Answer sent successfully via call-answer socket event');
      console.log('   Caller should receive answer and complete WebRTC connection');

      // Store call start time but don't set CONNECTED yet - let WebRTC connection handler do that
      console.log('Storing receiver call start time:', callStartTime);
      this.callState = {
        ...this.callState,
        callStartTime: callStartTime,
        callDuration: 0
      };
      
      // Don't emit state change yet - wait for WebRTC connection to establish

    } catch (error) {
      console.error('Error accepting call:', error);
      this.endCall();
      throw error;
    }
  }

  // Reject an incoming call
  public rejectCall(): void {
    if (this.callState.status !== CallStatus.RINGING) {
      return;
    }

    // Send rejection to caller
    socketService.getSocket()?.emit('call-answer', {
      targetUserId: this.callState.remoteUserId,
      accepted: false
    });

    this.resetCallState();
  }

  // Handle call answer (accept/reject)
  private handleCallAnswer = async (data: any) => {
    try {
      console.log('Handling call answer:', data);
      const { accepted, sdp, type, callHistoryId, renegotiation, callStartTime } = data;

      // Store callHistoryId if provided
      if (callHistoryId) {
        console.log('Setting callHistoryId:', callHistoryId);
        this.callState.callHistoryId = callHistoryId;
      }

      if (!accepted) {
        console.log('Call was rejected');
        this.emitEvent('call-rejected', data);
        this.resetCallState();
        return;
      }

      // Make sure we have a valid peer connection
      if (!this.pc) {
        console.error("Cannot process answer: peer connection not initialized");
        return;
      }

      // Store call start time for the caller when we receive an answer (only once, not during renegotiation)
      // Don't set CONNECTED status yet - let the WebRTC connection handler do that
      if (!renegotiation && callStartTime) {
        console.log("Storing call start time for caller:", callStartTime);
        this.callState = {
          ...this.callState,
          callStartTime: callStartTime,
          callDuration: 0
        };
      }

      // Handle renegotiation answer (e.g., when adding video to an existing call)
      if (renegotiation === true && this.callState.status === CallStatus.CONNECTED) {
        console.log("Handling answer for renegotiation");
        
        try {
          // Parse SDP to check m-line order before applying
          console.log("Checking SDP m-line structure for renegotiation answer");
          
          // Set the remote description with the answer
          const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp
          });
          
          console.log("Applying renegotiation answer...");
          await this.pc.setRemoteDescription(remoteDesc);
          console.log("Successfully applied renegotiation answer");
          
          // Verify all transceivers and tracks
          if (this.pc.getTransceivers) {
            const transceivers = this.pc.getTransceivers();
            console.log(`Current transceivers after renegotiation: ${transceivers.length}`);
            
            transceivers.forEach((transceiver, idx) => {
              console.log(`Transceiver ${idx}: mid=${transceiver.mid}, kind=${transceiver.receiver.track?.kind || 'none'}, direction=${transceiver.direction}`);
            });
          }
          
          // Update video state if needed
          if (this.callState.isVideoEnabled) {
            this.emitCallStateChange();
          }
        } catch (err) {
          console.error("Error setting remote description for renegotiation:", err);
          
          // Log specific error information and recover if possible
          if (err instanceof Error) {
            console.error("Renegotiation error details:", err.message);
            
            // Check if this is an m-line order issue
            if (err.message.includes('m-lines')) {
              console.error("This appears to be an m-line order mismatch in SDP - attempting recovery");
              
              // Try to enable video locally despite renegotiation failure
              this.callState = {
                ...this.callState,
                isVideoEnabled: true
              };
              this.emitCallStateChange();
              this.emitEvent('local-stream-updated', this.localStream);
            }
          }
        }
        
        return;
      }

      // Log the current state for debugging
      console.log("Current call status:", this.callState.status);
      console.log("Current signaling state before processing answer:", this.pc.signalingState);
      
      // If we're already connected, this might be a duplicate answer
      if (this.callState.status === CallStatus.CONNECTED) {
        console.log("Already in CONNECTED state, ignoring answer message");
        return;
      }

      // Handle case where peer connection is in stable state - no need to set remote description again
      if (this.pc.signalingState === "stable") {
        console.log("Peer connection already in stable state, possibly already processed answer");
        return;
      }
      
      // Only proceed if we're in the right state for accepting an answer
      const currentState = this.pc.signalingState;
      if (currentState !== "have-local-offer") {
        console.error("Cannot set remote answer: invalid signaling state:", currentState);
         
        // Handle specific invalid states
        console.log("Attempting to recover from invalid state...");
        if (currentState === "have-remote-offer") {
          console.log("We have a remote offer but received an answer - possible race condition");
          // Don't update state here, let the connection state handler do it
          return;
        }
        
        throw new Error("Failed to set remote answer sdp: Called in wrong state: " + currentState);
      }

      // Set remote description (the answer)
      try {
        const remoteDesc = new RTCSessionDescription({
          type: 'answer',
          sdp
        });
        
        console.log("Setting remote description (answer)...");
        console.log("SDP length:", sdp.length, "bytes");
        
        // Set remote description with timeout
        const setRemoteDescPromise = this.pc.setRemoteDescription(remoteDesc);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('setRemoteDescription timeout after 15 seconds')), 15000);
        });
        
        await Promise.race([setRemoteDescPromise, timeoutPromise]);
        console.log("✅ Successfully set remote description (answer)");
        console.log("   New signaling state:", this.pc.signalingState);
        console.log("   ICE connection state:", this.pc.iceConnectionState);
        console.log("   Connection state:", this.pc.connectionState);
        
        // Process any queued ICE candidates now that remote description is set
        console.log("📋 Remote description set - queued ICE candidates should be processed automatically");
        
        // Check connection state after a brief delay
        setTimeout(() => {
          if (this.pc) {
            console.log("🔍 Post-remote-description check:");
            console.log("   Signaling state:", this.pc.signalingState);
            console.log("   ICE connection state:", this.pc.iceConnectionState);
            console.log("   Connection state:", this.pc.connectionState);
            console.log("   ICE gathering state:", this.pc.iceGatheringState);
            
            // If we're connected, update state immediately
            if (this.pc.connectionState === 'connected' && this.callState.status !== CallStatus.CONNECTED) {
              console.log("✅ Connection detected - updating state");
              (this.pc as any).onconnectionstatechange?.();
            }
          }
        }, 1000);
        
        // Start connection state monitor to detect when connection is established
        this.startConnectionStateMonitor();
      } catch (err) {
        console.error("Error setting remote description:", err);
        
        // If we get a stable state error, it means the connection is established
        // This can happen if the answer was processed twice or we hit a race condition
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("Called in wrong state: stable")) {
          console.log("Ignoring stable state error - connection appears to be established");
          return;
        }
        
        throw err;
      }

    } catch (error: any) {
      console.error('Error handling call answer:', error);
      // Don't end the call for SDP errors related to stable state
      if (error && typeof error.toString === 'function' && !error.toString().includes("Failed to set remote answer sdp: Called in wrong state: stable")) {
        this.endCall();
      } else {
        console.log("Ignoring stable state error and attempting to continue the call");
        // Connection is likely already established, just continue
      }
    }
  }

  // Handle state sync from remote peer
  private handleStateSync = (data: any) => {
    try {
      const {
        status,
        callStartTime,
        callDuration,
        isVideoEnabled,
        isAudioEnabled,
        timestamp
      } = data;

      // Only accept updates that are newer than our last sync
      if (timestamp <= this.lastSyncAttempt) {
        console.log('Ignoring outdated state sync');
        return;
      }

      // 🔒 CONNECTED STATE LOCK: Do not downgrade CONNECTED via state sync
      // Only allow sync if current state is not CONNECTED, or if remote also says CONNECTED or ENDED
      if (this.isTerminalConnected()) {
        const remoteStatus = status as CallStatus;
        // Only allow sync if remote also says CONNECTED (normal case) or ENDED (call ended)
        if (remoteStatus !== CallStatus.CONNECTED && remoteStatus !== CallStatus.ENDED) {
          console.log('🔒 [handleStateSync] CONNECTED state locked - ignoring state sync:', remoteStatus);
          console.log('   CONNECTED cannot be downgraded by socket state sync');
          console.log('   Only CONNECTED or ENDED from remote are allowed');
          // Still sync other fields (not status)
          const newState = {
            ...this.callState,
            isVideoEnabled,
            isAudioEnabled
          };
          
          // Use the earlier start time between local and remote
          if (callStartTime && (!this.callState.callStartTime || callStartTime < this.callState.callStartTime)) {
            newState.callStartTime = callStartTime;
            newState.callDuration = callDuration;
          }
          
          this.callState = newState;
          this.lastSyncAttempt = timestamp;
          return;
        }
      }

      // Update our state with remote values
      const newState = {
        ...this.callState,
        status,
        isVideoEnabled,
        isAudioEnabled
      };

      // Use the earlier start time between local and remote
      if (callStartTime && (!this.callState.callStartTime || callStartTime < this.callState.callStartTime)) {
        newState.callStartTime = callStartTime;
        newState.callDuration = callDuration;
      }

      this.callState = newState;
      this.emitCallStateChange();
      
      // Reset sync retry count since we got an update
      this.syncRetryCount = 0;
    } catch (error) {
      console.error('Error handling state sync:', error);
    }
  };

  // Handle ICE candidate from remote peer
  private handleIceCandidate = async (data: any) => {
    try {
      if (!this.pc || this.callState.status === CallStatus.IDLE) {
        console.log('Cannot handle ICE candidate: no connection or idle state');
        return;
      }

      const { candidate, sdpMid, sdpMLineIndex } = data;
      
      if (candidate) {
        // Log candidate information for network debugging
        console.log('Processing ICE candidate:', {
          type: candidate.includes('typ relay') ? 'relay' :
                candidate.includes('typ srflx') ? 'srflx' :
                candidate.includes('typ host') ? 'host' : 'unknown',
          protocol: candidate.includes('udp') ? 'UDP' : 
                   candidate.includes('tcp') ? 'TCP' : 'unknown',
          address: candidate.match(/(?:\d{1,3}\.){3}\d{1,3}/)?.at(0) || 'unknown'
        });

        // If remote description isn't set yet, queue the candidate
        if (!this.pc.remoteDescription) {
          console.log('Remote description not set, queueing ICE candidate (will retry when remote description is set)');
          
          // Store candidate for later processing
          const queuedCandidate = { candidate, sdpMid, sdpMLineIndex };
          
          // Retry with exponential backoff
          let retryCount = 0;
          const maxRetries = 10;
          const retryInterval = 500; // Start with 500ms
          
          const tryAddQueuedCandidate = async () => {
            if (!this.pc) return;
            
            if (this.pc.remoteDescription) {
              try {
                const iceCandidate = new RTCIceCandidate(queuedCandidate);
                await this.pc.addIceCandidate(iceCandidate);
                console.log('✅ Added queued ICE candidate successfully');
              } catch (error) {
                console.error('❌ Error adding queued ICE candidate:', error);
              }
            } else if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(tryAddQueuedCandidate, retryInterval * retryCount);
            } else {
              console.warn('⚠️ Failed to add queued ICE candidate after max retries');
            }
          };
          
          setTimeout(tryAddQueuedCandidate, retryInterval);
          return;
        }

        // Add the candidate immediately if we're ready
        try {
          const iceCandidate = new RTCIceCandidate({
            candidate,
            sdpMid,
            sdpMLineIndex
          });
          
          await this.pc.addIceCandidate(iceCandidate);
          console.log('Added ICE candidate successfully');
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Handle call end from remote peer
   handleCallEnd = (data?: any) => {
    if (this.callState.status === CallStatus.IDLE) {
      return;
    }

    // Capture remote user ID before ending call
    const remoteUserId = this.callState.remoteUserId;
    
    // Emit call-ended event with userId for immediate status update
    this.emitEvent('call-ended', { 
      remoteEnded: true,
      userId: remoteUserId,
      remoteUserId: remoteUserId,
      endedBy: data?.endedBy
    });
    this.endCall();
  }

  // Start tracking call duration with local fallback
  private startDurationTracking(): void {
    console.log('Starting duration tracking. Current state:', {
      status: this.callState.status,
      startTime: this.callState.callStartTime,
      currentDuration: this.callState.callDuration
    });
    
    // Clear any existing timer
    if (this.durationTimer) {
      console.log('Clearing existing timer');
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }

    // Ensure we have a valid start time
    const now = Date.now();
    if (!this.callState.callStartTime || this.callState.callStartTime > now) {
      console.log('Invalid or missing start time, initializing with current time');
      this.callState = {
        ...this.callState,
        callStartTime: now,
        callDuration: 0
      };
      
      // Store locally as fallback
      try {
        AsyncStorage.setItem('lastCallStartTime', now.toString());
      } catch (error) {
        console.error('Failed to save call start time to storage:', error);
      }
    } else {
      // Verify stored time matches or use as fallback
      AsyncStorage.getItem('lastCallStartTime')
        .then(storedTime => {
          if (storedTime) {
            const parsedTime = parseInt(storedTime, 10);
            if (!isNaN(parsedTime)) {
              // If stored time is earlier, use it as the true start time
              const currentStartTime = this.callState.callStartTime;
              if (currentStartTime && parsedTime < currentStartTime) {
                console.log('Using stored start time as it predates current time');
                this.callState = {
                  ...this.callState,
                  callStartTime: parsedTime,
                };
                this.emitCallStateChange();
              }
            }
          }
        })
        .catch(error => {
          console.error('Error reading stored call start time:', error);
        });
    }

    // Initialize duration immediately using the most accurate start time
    // Initialize duration with null check
    if (this.callState.callStartTime) {
      const initialDuration = Math.floor((Date.now() - this.callState.callStartTime) / 1000);
      this.callState = {
        ...this.callState,
        callDuration: initialDuration
      };
      this.emitCallStateChange();
      console.log('Initial duration set to:', initialDuration, 'seconds');
    }

    // Start a new timer with drift compensation
    let lastUpdate = Date.now();
    this.durationTimer = setInterval(() => {
      const now = Date.now();
      const actualInterval = now - lastUpdate;
      
      // Compensate for timer drift
      if (Math.abs(actualInterval - 1000) > 100) {
        console.log('Timer drift detected:', actualInterval - 1000, 'ms');
      }
      
      if (this.callState.callStartTime) {
        const currentDuration = Math.floor((now - this.callState.callStartTime) / 1000);
        if (currentDuration !== this.callState.callDuration) {
          this.callState = {
            ...this.callState,
            callDuration: currentDuration
          };
          this.emitCallStateChange();
        }
      } else {
        // Try to recover from AsyncStorage if we lost the start time
        AsyncStorage.getItem('lastCallStartTime')
          .then(storedTime => {
            if (storedTime) {
              const parsedTime = parseInt(storedTime, 10);
              if (!isNaN(parsedTime)) {
                console.log('Recovered call start time from storage');
                this.callState = {
                  ...this.callState,
                  callStartTime: parsedTime,
                  callDuration: Math.floor((now - parsedTime) / 1000)
                };
                this.emitCallStateChange();
              } else {
                this.clearDurationTimer();
              }
            } else {
              this.clearDurationTimer();
            }
          })
          .catch(error => {
            console.error('Failed to recover call start time:', error);
            this.clearDurationTimer();
          });
      }
      
      lastUpdate = now;
    }, 1000);
  }

  // End the current call
  public endCall(): void {
    console.log('📞 [callService.endCall] Starting WebRTC cleanup, current state:', this.callState.status);
    
    // Stop connection state monitor
    this.stopConnectionStateMonitor();
    
    // Stop connecting timeout
    this.stopConnectingTimeout();
    
    // Stop duration tracking
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    
    // Log peer connection state before cleanup
    if (this.pc) {
      console.log('📞 [callService.endCall] Peer connection exists, state:', {
        signalingState: this.pc.signalingState,
        connectionState: this.pc.connectionState,
        iceConnectionState: this.pc.iceConnectionState
      });
    } else {
      console.log('📞 [callService.endCall] No peer connection to clean up');
    }
    
    // Capture remoteUserId before cleanup
    const remoteUserId = this.callState.remoteUserId;
    const callHistoryId = this.callState.callHistoryId;
    
    // Calculate final duration if there was an active call
    let finalDuration = 0;
    if (this.callState.callStartTime && this.callState.status === CallStatus.CONNECTED) {
      finalDuration = Math.floor((Date.now() - this.callState.callStartTime) / 1000);
      console.log('📞 [callService.endCall] Call lasted', finalDuration, 'seconds');
    }
    
    // Send call end to remote user if we're in a call
    if (this.callState.status !== CallStatus.IDLE && remoteUserId) {
      try {
        socketService.getSocket()?.emit('call-end', {
          targetUserId: remoteUserId,
          callHistoryId: callHistoryId,
          duration: finalDuration
        });
        console.log('📞 [callService.endCall] Sent call-end signal to:', remoteUserId, 
                    'with callHistoryId:', callHistoryId,
                    'duration:', finalDuration);
      } catch (error) {
        console.error('📞 [callService.endCall] Error sending call-end signal:', error);
      }
    }

    // Stop media streams
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log('📞 [callService.endCall] Stopped', track.kind, 'track');
          } catch (trackError) {
            console.error('📞 [callService.endCall] Error stopping', track.kind, 'track:', trackError);
          }
        });
      } catch (streamError) {
        console.error('📞 [callService.endCall] Error stopping local stream:', streamError);
      }
      this.localStream = null;
    }

    // Close peer connection
    if (this.pc) {
      try {
        // Remove all event listeners first
        try {
          (this.pc as any).oniceconnectionstatechange = null;
          (this.pc as any).onicegatheringstatechange = null;
          (this.pc as any).onsignalingstatechange = null;
          (this.pc as any).ontrack = null;
          (this.pc as any).onicecandidate = null;
          (this.pc as any).onconnectionstatechange = null;
        } catch (eventError) {
          console.error('📞 [callService.endCall] Error removing event listeners:', eventError);
        }
        
        // Then close the connection
        this.pc.close();
        console.log('📞 [callService.endCall] Closed peer connection');
      } catch (pcError) {
        console.error('📞 [callService.endCall] Error closing peer connection:', pcError);
      }
      this.pc = null;
    }

    // NOTE: Status updates are handled by backend via socket events (call:end)
    // Backend automatically emits user:status:update for both users when call ends
    // No need to request status updates here - this was causing infinite loops
    
    console.log('📞 [callService.endCall] WebRTC cleanup complete');
    // NOTE: Do NOT mutate callState or emit state changes here
    // Redux is the single source of truth - endActiveCall thunk handles state updates
  }

  // Reset call state to idle
  private resetCallState(): void {
    // Stop duration tracking
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }

    // ✅ REQUIREMENT 1: Clean up processed call:ready-for-webrtc tracking
    // Get callId from callState before resetting
    const callHistoryId = this.callState.callHistoryId;
    // Clear all processed callIds (call has ended, no longer need tracking)
    if (this.processedReadyForWebRTCCallIds.size > 0) {
      console.log('🧹 [callService] Clearing processed call:ready-for-webrtc tracking');
      this.processedReadyForWebRTCCallIds.clear();
    }

    // Reset state
    this.callState = { ...initialCallState };
    this.emitCallStateChange();
    
    // Clear partner matching session if this was a partner matching call
    if ((this as any).wasPartnerMatchingCall) {
      console.log('🤝 Clearing partner matching session');
      (this as any).wasPartnerMatchingCall = false;
      
      // Emit event to clear matched pairs on server
      socketService.getSocket()?.emit('call-ended', {
        wasPartnerMatching: true
      });
    }
  }

  // Initialize WebRTC peer connection and media streams
  private async initializeWebRTC(options: CallOptions): Promise<void> {
    try {
      console.log('Initializing WebRTC with options:', options);
      
      // ✅ REQUIREMENT 4: Check if peer connection already exists and is active
      // If it exists and is in a valid state, reuse it (idempotent)
      if (this.pc && this.pc.signalingState !== 'closed') {
        console.log('⚠️ [initializeWebRTC] Peer connection already exists and is active, reusing it');
        console.log('   Signaling state:', this.pc.signalingState);
        console.log('   Connection state:', this.pc.connectionState);
        // Peer connection already exists and is active, no need to create new one
        return;
      }
      
      // Clean up any existing peer connection first (if closed or invalid)
      if (this.pc) {
        console.log('Cleaning up existing peer connection before creating new one');
        try {
          // Remove all event listeners first
          try {
            (this.pc as any).oniceconnectionstatechange = null;
            (this.pc as any).onicegatheringstatechange = null;
            (this.pc as any).onsignalingstatechange = null;
            (this.pc as any).ontrack = null;
            (this.pc as any).onicecandidate = null;
            (this.pc as any).onconnectionstatechange = null;
          } catch (eventError) {
            console.error("Error removing event listeners:", eventError);
          }
          
          // Then close the connection
          this.pc.close();
          console.log("Closed existing peer connection");
        } catch (pcError) {
          console.error("Error closing existing peer connection:", pcError);
        }
        this.pc = null;
      }
      
      // Create peer connection
      try {
        this.pc = await this.createPeerConnection();
        if (!this.pc) {
          throw new Error('createPeerConnection returned null');
        }
        console.log('RTCPeerConnection created with dynamic configuration');
      } catch (error) {
        console.error('❌ [initializeWebRTC] Failed to create peer connection:', error);
        this.pc = null;
        throw new Error(`Failed to create peer connection: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Set up event handlers using proper properties
      // For TypeScript, we need to use the 'any' type to bypass type checking for these properties
      // This is because react-native-webrtc's TypeScript definitions don't match the actual API
      (this.pc as any).oniceconnectionstatechange = this.handleIceConnectionStateChange;
      
      (this.pc as any).onicegatheringstatechange = () => {
        const gatheringState = this.pc?.iceGatheringState;
        console.log('🔍 ICE gathering state:', gatheringState);
        
        if (gatheringState === 'complete') {
          // Check if we have relay candidates
          this.pc?.getStats().then((stats: any) => {
            let hasRelay = false;
            stats.forEach((report: any) => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.remoteCandidateId) {
                  const remoteCandidate = stats.get(report.remoteCandidateId);
                  if (remoteCandidate && remoteCandidate.candidateType === 'relay') {
                    hasRelay = true;
                  }
                }
                if (report.localCandidateId) {
                  const localCandidate = stats.get(report.localCandidateId);
                  if (localCandidate && localCandidate.candidateType === 'relay') {
                    hasRelay = true;
                  }
                }
              }
            });
            if (hasRelay) {
              console.log('✅ TURN relay candidate pair detected in stats');
            } else {
              console.log('⚠️ No TURN relay candidate pairs found - may have connection issues');
            }
          }).catch((err: any) => {
            console.warn('Could not get WebRTC stats:', err);
          });
        }
      };
      
      (this.pc as any).onsignalingstatechange = () => {
        console.log('Signaling state:', this.pc?.signalingState);
      };

      try {
        // Get local media stream
        const mediaConstraints: any = {
          audio: options.audio === false ? false : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16
          },
          video: options.video || false
        };
        
        console.log('Requesting media with constraints:', mediaConstraints);
        this.localStream = await mediaDevices.getUserMedia(mediaConstraints);
        console.log('Media stream obtained successfully');
        
        // Verify audio tracks
        const audioTracks = this.localStream.getAudioTracks();
        console.log('Audio tracks obtained:', audioTracks.length);
        audioTracks.forEach(track => {
          console.log('Audio track:', track.id, 'enabled:', track.enabled, 'muted:', track.muted);
          // Ensure track is enabled
          track.enabled = true;
        });

        // Add local tracks to peer connection
        this.localStream.getTracks().forEach((track) => {
          console.log('Adding track to peer connection:', track.kind, track.id, 'enabled:', track.enabled);
          
          // Ensure audio track is enabled
          if (track.kind === 'audio') {
            track.enabled = true;
            console.log('Ensuring audio track is enabled');
          }
          
          if (this.pc && this.localStream) {
            // Check if track is already added
            const senders = this.pc.getSenders();
            const existingSender = senders.find(sender => sender.track?.id === track.id);
            
            if (!existingSender) {
              this.pc.addTrack(track, this.localStream);
              console.log('Added track to peer connection');
            } else {
              console.log('Track already exists in peer connection');
            }
          }
        });

        // Create remote stream
        this.remoteStream = new MediaStream();
        console.log('Remote stream created');

        // Handle incoming tracks with type assertion for TypeScript
        (this.pc as any).ontrack = (event: any) => {
          console.log('Received remote track:', event.track.kind, event.track.id, 'enabled:', event.track.enabled);
          
          // Ensure track is enabled and unmuted
          event.track.enabled = true;
          if (event.track.kind === 'audio') {
            event.track.enabled = true;
            console.log('Ensuring remote audio track is enabled:', event.track.id);
            // Try to set audio output to speaker
            try {
              const globalAudioConstructor =
                typeof globalThis !== 'undefined' ? (globalThis as any).Audio : undefined;

              if (typeof globalAudioConstructor === 'function') {
                const audioEl = new globalAudioConstructor();
                if (typeof audioEl.setSinkId === 'function') {
                  audioEl
                    .setSinkId('default')
                    .then(() => {
                      console.log('Set audio output to system default');
                    })
                    .catch((audioSinkError: unknown) => {
                      console.warn('Could not set audio output:', audioSinkError);
                    });
                }
              }
            } catch (audioOutputError: unknown) {
              console.warn('Audio output device selection not supported', audioOutputError);
            }
          }
          
          if (event.streams && event.streams.length > 0) {
            // Get the remote stream from the event
            const remoteStream = event.streams[0];
            console.log('Remote stream tracks before adding:', this.remoteStream?.getTracks().length || 0);
            
            // Create new MediaStream if it doesn't exist
            if (!this.remoteStream) {
              this.remoteStream = new MediaStream();
              console.log('Created new remote MediaStream');
            }
            
            // Check if track already exists
            const existingTrack = this.remoteStream.getTracks().find(
              (t: any) => t.id === event.track.id
            );
            
            if (!existingTrack) {
              this.remoteStream.addTrack(event.track);
              console.log('Added new remote track:', event.track.kind, 'enabled:', event.track.enabled);
            } else {
              console.log('Track already exists:', event.track.kind);
            }
            
            // Log all tracks for debugging
            this.remoteStream.getTracks().forEach((track: any) => {
              console.log('Current remote track:', track.kind, 'enabled:', track.enabled);
            });
            
            this.emitEvent('remote-stream-updated', this.remoteStream);
          } else {
            console.warn('Received track without stream');
          }
        };

        // Enhanced ICE candidate handling with retry logic
        (this.pc as any).onicecandidate = (event: any) => {
          if (event.candidate) {
            // Parse candidate string to determine type
            const candidateStr = event.candidate.candidate || '';
            const isRelay = candidateStr.includes('typ relay');
            const isSrflx = candidateStr.includes('typ srflx');
            const isHost = candidateStr.includes('typ host');
            
            // Determine candidate type
            let candidateType: 'host' | 'srflx' | 'relay' | 'unknown' = 'unknown';
            if (isHost) {
              candidateType = 'host';
              this.hostCandidateCount++;
              this.candidateTypes.host++;
            } else if (isSrflx) {
              candidateType = 'srflx';
              this.srflxCandidateCount++;
              this.candidateTypes.srflx++;
            } else if (isRelay) {
              candidateType = 'relay';
              this.relayCandidateCount++;
              this.candidateTypes.relay++;
            }
            
            // Track candidate counts
            this.iceCandidateCount++;
            
            const typeLabel = candidateType === 'relay' ? 'RELAY (TURN)' : 
                             candidateType === 'srflx' ? 'SRFLX (STUN)' : 
                             candidateType === 'host' ? 'HOST (P2P)' : 'UNKNOWN';
            
            console.log(`🔵 ICE Candidate [${typeLabel}] #${this.iceCandidateCount}`, {
              type: candidateType,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
              port: event.candidate.port,
              summary: `Total: ${this.iceCandidateCount} | Host: ${this.hostCandidateCount} | STUN: ${this.srflxCandidateCount} | TURN: ${this.relayCandidateCount}`
            });
            
            if (isRelay) {
              console.log('✅ TURN RELAY candidate detected - cross-network connection should work!');
            } else if (isHost) {
              console.log('🏠 HOST candidate (direct P2P) - fastest connection if on same network');
            } else if (isSrflx) {
              console.log('🌐 SRFLX candidate (STUN-reflexive) - works for most NAT scenarios');
            }

            const sendCandidate = (retryCount = 0) => {
              if (!this.pc || this.callState.status === CallStatus.ENDED) {
                console.log('Call ended, not sending ICE candidate');
                return;
              }

              const socket = socketService.getSocket();
              if (!socket?.connected) {
                if (retryCount < 3) {
                  console.log('Socket not connected, retrying ICE candidate send in 1s');
                  setTimeout(() => sendCandidate(retryCount + 1), 1000);
                  return;
                }
                console.error('Failed to send ICE candidate after retries - socket not connected');
                return;
              }

              socket.emit('call-ice-candidate', {
                targetUserId: this.callState.remoteUserId,
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
              }, (acknowledgement: any) => {
                if (!acknowledgement?.received) {
                  if (retryCount < 3) {
                    console.log('ICE candidate not acknowledged, retrying');
                    setTimeout(() => sendCandidate(retryCount + 1), 1000);
                  } else {
                    console.error('Failed to send ICE candidate after retries');
                  }
                } else {
                  console.log('ICE candidate acknowledged by server');
                }
              });
            };

            // Start sending with retry logic
            sendCandidate();
          } else {
            console.log('✅ Finished gathering ICE candidates');
            console.log(`📊 ICE Candidate Summary:`, {
              total: this.iceCandidateCount,
              host: this.hostCandidateCount,
              srflx: this.srflxCandidateCount,
              relay: this.relayCandidateCount,
              breakdown: this.candidateTypes
            });
            
            // After ICE gathering completes, check connection state
            // Sometimes connectionState doesn't fire immediately
            setTimeout(() => {
              if (this.pc && this.callState.status === CallStatus.RECONNECTING) {
                const connState = this.pc.connectionState;
                const iceState = this.pc.iceConnectionState;
                
                console.log(`🔍 Post-ICE-gathering check: connectionState=${connState}, iceConnectionState=${iceState}`);
                
                if (connState === 'connected' && iceState === 'connected') {
                  console.log('✅ Connection established but state not updated - forcing update');
                  // Force connection state update
                  (this.pc as any).onconnectionstatechange?.();
                } else if (connState === 'connecting' || iceState === 'checking') {
                  console.log('⏳ Still connecting, will check again in 3s...');
                  // Check again after a delay
                  setTimeout(() => {
                    if (this.pc) {
                      const finalState = this.pc.connectionState;
                      const finalIceState = this.pc.iceConnectionState;
                      console.log(`🔍 Final check: connectionState=${finalState}, iceConnectionState=${finalIceState}`);
                      
                      if (finalState === 'connected' && this.callState.status === CallStatus.RECONNECTING) {
                        console.log('✅ Connection established - updating state');
                        (this.pc as any).onconnectionstatechange?.();
                      }
                    }
                  }, 3000);
                }
              }
            }, 2000);
          }
        };

        // Handle connection state changes with type assertion for TypeScript
        (this.pc as any).onconnectionstatechange = () => {
          if (!this.pc) {
            console.warn('⚠️ [WebRTC] onconnectionstatechange fired but pc is null');
            return;
          }
          
          const connectionState = this.pc.connectionState;
          const iceConnectionState = this.pc.iceConnectionState;
          console.log('🔍 [WebRTC] Connection state changed:', {
            connectionState,
            iceConnectionState,
            currentCallStatus: this.callState.status
          });
          
          switch (connectionState) {
            case 'connected':
              console.log('🟢 [WebRTC] Connection state is "connected"');
              console.log('   ICE Connection State:', iceConnectionState);
              
              // Determine connection type (P2P vs TURN relay)
              this.logConnectionType();
              
              // Update call state to CONNECTED when connection is actually established
              // Handles CONNECTING status (lazy-loading phase after invitation acceptance)
              if (this.callState.status === CallStatus.CALLING || 
                  this.callState.status === CallStatus.RINGING ||
                  this.callState.status === CallStatus.RECONNECTING ||
                  this.callState.status === CallStatus.CONNECTING) {
                console.log("🟢 [WebRTC] WebRTC ready → switching to connected");
                console.log("   Previous status:", this.callState.status);
                console.log("   New status: CONNECTED");
                
                // Use stored call start time or create one if not available
                const startTime = this.callState.callStartTime || Date.now();
                
                this.callState = {
                  ...this.callState,
                  status: CallStatus.CONNECTED,
                  callStartTime: startTime,
                  callDuration: 0
                };
                
                // Start duration tracking now that connection is established
                console.log('Starting duration tracking on connection with start time:', startTime);
                this.startDurationTracking();
                
                this.emitCallStateChange();
                
                // Notify about connection for timer sync
                this.emitEvent('call-connected', {
                  remoteUserId: this.callState.remoteUserId,
                  timestamp: startTime
                });
                
                // Stop connection state monitor since we're connected
                this.stopConnectionStateMonitor();
                
                // Stop connecting timeout since we're now connected
                this.stopConnectingTimeout();
                
                console.log('✅ [WebRTC] Successfully transitioned to CONNECTED state');
              } else if (this.callState.status === CallStatus.CONNECTED) {
                // Already connected, just log
                console.log('✅ [WebRTC] Already in CONNECTED state (connection confirmed)');
              } else {
                console.warn('⚠️ [WebRTC] Connection is "connected" but status is:', this.callState.status);
                console.warn('   This may indicate a state sync issue');
              }
              break;

            case 'disconnected':
              console.log('WebRTC connection temporarily disconnected');
              // 🔒 CONNECTED STATE LOCK: Do not downgrade CONNECTED to RECONNECTING on temporary disconnect
              // Temporary disconnects are normal during active calls (brief network hiccups)
              // Only downgrade if not already CONNECTED (connection monitor will handle recovery)
              if (!this.isTerminalConnected()) {
                this.callState = {
                  ...this.callState,
                  status: CallStatus.RECONNECTING
                };
                this.emitCallStateChange();
              } else {
                console.log('🔒 [WebRTC] CONNECTED state locked - ignoring temporary disconnect');
                console.log('   Connection monitor will handle recovery if needed');
              }
              break;

            case 'failed':
              console.log('WebRTC connection failed - attempting restart');
              // 🔒 CONNECTED STATE LOCK: Only downgrade to RECONNECTING if we were CONNECTED
              // If we're in CONNECTING (initial connection), failed means the call failed, not reconnection
              if (this.isTerminalConnected()) {
                // We were CONNECTED, connection failed - attempt reconnection
                console.log('🔄 [WebRTC] CONNECTED → RECONNECTING (connection failed, attempting recovery)');
                this.callState = {
                  ...this.callState,
                  status: CallStatus.RECONNECTING
                };
                this.emitCallStateChange();
              } else {
                // Initial connection failed - this is a call failure, not reconnection
                console.log('❌ [WebRTC] Initial connection failed - call cannot be established');
                // Don't set RECONNECTING for initial connection failures
                // The connection monitor or timeout will handle this
              }
              
              setTimeout(() => {
                if (this.pc && this.pc.connectionState === 'failed') {
                  try {
                    this.pc.restartIce();
                    console.log('Attempted ICE restart for failed connection');
                    
                    setTimeout(() => {
                      if (this.pc?.connectionState !== 'connected') {
                        console.log('Failed to reconnect after timeout - ending call');
                        this.endCall();
                      }
                    }, 8000);
                  } catch (err) {
                    console.error('Error restarting failed connection:', err);
                    this.endCall();
                  }
                }
              }, 1000);
              break;

            case 'closed':
              console.log('WebRTC connection closed');
              this.endCall();
              break;
            
            case 'connecting':
              console.log('🔄 WebRTC connection in progress...');
              console.log(`   ICE Connection State: ${this.pc.iceConnectionState}`);
              console.log(`   ICE Gathering State: ${this.pc.iceGatheringState}`);
              
              // 🔒 CONNECTED STATE LOCK: Do not downgrade CONNECTED to RECONNECTING during initial connection
              // RECONNECTING should only be set if we were previously CONNECTED
              // If we're in CONNECTING state (initial connection), keep it as CONNECTING
              // Only set RECONNECTING if we were already CONNECTED (reconnection scenario)
              if (this.isTerminalConnected()) {
                // We were CONNECTED, now reconnecting - this is a reconnection scenario
                console.log('🔄 [WebRTC] CONNECTED → RECONNECTING (connection lost, attempting recovery)');
                this.callState = {
                  ...this.callState,
                  status: CallStatus.RECONNECTING
                };
                this.emitCallStateChange();
              } else if (this.callState.status === CallStatus.CONNECTING) {
                // We're in initial CONNECTING phase - keep it as CONNECTING, don't change to RECONNECTING
                console.log('⏳ [WebRTC] Initial connection in progress - keeping CONNECTING status');
                console.log('   Connection monitor will detect when connection completes');
                // Don't change status, just start monitoring
                // The connection monitor will detect when connState becomes 'connected' and update status
              } else {
                // Other states (CALLING, RINGING) - can transition to RECONNECTING if needed
                this.callState = {
                  ...this.callState,
                  status: CallStatus.RECONNECTING
                };
                this.emitCallStateChange();
              }
              
              // Start connection state monitor
              this.startConnectionStateMonitor();
              
              // Set timeout for connection attempt (30 seconds)
              setTimeout(() => {
                if (this.pc && this.pc.connectionState === 'connecting') {
                  console.warn('⚠️ Connection stuck in connecting state for 30s - checking ICE candidates');
                  this.pc.getStats().then((stats: any) => {
                    let relayCount = 0;
                    let hostCount = 0;
                    let srflxCount = 0;
                    
                    stats.forEach((report: any) => {
                      if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
                        if (report.candidateType === 'relay') relayCount++;
                        else if (report.candidateType === 'host') hostCount++;
                        else if (report.candidateType === 'srflx') srflxCount++;
                      }
                    });
                    
                    console.log(`📊 ICE Candidate Summary: ${relayCount} relay, ${srflxCount} srflx, ${hostCount} host`);
                    
                    if (relayCount === 0) {
                      console.error('❌ No TURN relay candidates found! This may cause cross-network connection failures.');
                    }
                  }).catch((err: any) => {
                    console.warn('Could not get stats for diagnostics:', err);
                  });
                }
              }, 30000);
              break;
              
            default:
              console.log('Unhandled WebRTC connection state:', connectionState);
              break;
          }
        };

        // Emit local stream
        this.emitEvent('local-stream-updated', this.localStream);
        
      } catch (mediaError: unknown) {
        console.error('Error accessing media devices:', mediaError);
        
        // Provide more specific error message based on error type
        const err = mediaError as Error;
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied. Please allow microphone access to make calls.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error('No microphone found. Please connect a microphone to make calls.');
        } else {
          throw new Error(`Failed to access audio: ${err.message}`);
        }
      }

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      
      // Clean up if initialization fails
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      if (this.pc) {
        this.pc.close();
        this.pc = null;
      }
      
      throw error;
    }
  }

  // Toggle audio mute
  public toggleAudio(): boolean {
    if (!this.localStream) {
      throw new Error('No local stream available. Call may not be connected.');
    }
    
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio tracks found in local stream.');
    }
    
    try {
      // Get current state from the first track
      const currentEnabled = audioTracks[0].enabled;
      const isEnabled = !currentEnabled;
      
      console.log(`🎤 Toggling audio: ${currentEnabled ? 'enabled' : 'muted'} -> ${isEnabled ? 'enabled' : 'muted'} (Platform: ${Platform.OS})`);
      
      // Toggle all audio tracks
      audioTracks.forEach((track, index) => {
        const previousState = track.enabled;
        track.enabled = isEnabled;
        
        // Log detailed info for Android debugging
        if (Platform.OS === 'android') {
          console.log(`Android Audio Track ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            previousState: previousState
          });
        }
        
        // Verify the change was applied
        if (track.enabled !== isEnabled) {
          console.warn(`⚠️ Warning: Track ${track.id} enabled state may not have changed. Expected: ${isEnabled}, Actual: ${track.enabled}`);
        }
      });
      
      // Update call state
      this.callState = {
        ...this.callState,
        isAudioEnabled: isEnabled
      };
      
      this.emitCallStateChange();
      
      // Verify the state was updated correctly
      const verifyTracks = this.localStream.getAudioTracks();
      const allTracksEnabled = verifyTracks.every(track => track.enabled === isEnabled);
      
      if (!allTracksEnabled && Platform.OS === 'android') {
        console.warn('⚠️ Android: Some audio tracks may not have been toggled correctly');
        verifyTracks.forEach((track, index) => {
          if (track.enabled !== isEnabled) {
            console.warn(`  Track ${index} (${track.id}): expected ${isEnabled}, got ${track.enabled}`);
          }
        });
      }
      
      console.log(`✅ Audio ${isEnabled ? 'enabled' : 'muted'} successfully (${verifyTracks.length} track(s))`);
      return isEnabled;
    } catch (error) {
      console.error('❌ Error toggling audio track:', error);
      throw new Error(`Failed to toggle audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Toggle video
  public async toggleVideo(): Promise<boolean> {
    try {
      if (!this.localStream) return false;
      
      // Check if we already have video tracks
      let videoTracks = this.localStream.getVideoTracks();
      
      // If we're trying to enable video but have no video tracks
      if (videoTracks.length === 0 && !this.callState.isVideoEnabled) {
        // If we're in a call, use the upgrade flow instead of direct toggle
        if (this.callState.status === CallStatus.CONNECTED) {
          this.requestVideoUpgrade();
          return false; // Will be updated once accepted
        }
        
        // Otherwise (e.g., during call setup), directly enable video
        return await this.enableVideo();
      }
      
      // If we have video tracks, just toggle their enabled state
      if (videoTracks.length > 0) {
        const isEnabled = !videoTracks[0].enabled;
        
        videoTracks.forEach(track => {
          track.enabled = isEnabled;
          console.log(`Video track ${track.id} enabled: ${isEnabled}`);
        });
        
        this.callState = {
          ...this.callState,
          isVideoEnabled: isEnabled
        };
        
        // Notify listeners about the state change
        this.emitCallStateChange();
        return isEnabled;
      }
      
      return false;
    } catch (error) {
      console.error('Error in toggleVideo:', error);
      throw error;
    }
  }

  // Toggle speaker
  public async toggleSpeaker(enable: boolean): Promise<void> {
    try {
      console.log(`🔊 Toggling speaker to: ${enable} (Platform: ${Platform.OS})`);
      
      if (Platform.OS === 'ios') {
        // iOS: Use RTCAudioSession
        const { RTCAudioSession } = require('react-native-webrtc');
        RTCAudioSession.setCategory('AVAudioSessionCategoryPlayAndRecord', {
          mode: 'AVAudioSessionModeVoiceChat',
          options: {
            'defaultToSpeaker': enable,
            'allowBluetooth': true,
            'allowBluetoothA2DP': true,
          }
        });
        console.log('✅ Speaker toggled to:', enable, '(iOS)');
      } else if (Platform.OS === 'android') {
        // Android: Use WebRTCModule's setSpeakerphoneOn
        // Try multiple possible module names
        const possibleModules = [
          NativeModules.WebRTCModule,
          NativeModules.RTCModule,
          NativeModules.RTCAudioManager,
        ];
        
        let speakerSet = false;
        for (const module of possibleModules) {
          if (module && typeof module.setSpeakerphoneOn === 'function') {
            try {
              await module.setSpeakerphoneOn(enable);
              console.log(`✅ Speaker toggled to: ${enable} using ${module.constructor.name} (Android)`);
              speakerSet = true;
              break;
            } catch (moduleError) {
              console.warn(`Failed to use ${module.constructor.name}:`, moduleError);
            }
          }
        }
        
        if (!speakerSet) {
          // Try alternative method: directly access the native module from react-native-webrtc
          try {
            const webrtc = require('react-native-webrtc');
            if (webrtc && webrtc.default && typeof webrtc.default.setSpeakerphoneOn === 'function') {
              await webrtc.default.setSpeakerphoneOn(enable);
              console.log('✅ Speaker toggled using react-native-webrtc default export');
              speakerSet = true;
            }
          } catch (webrtcError) {
            console.warn('Failed to use react-native-webrtc default export:', webrtcError);
          }
        }
        
        if (!speakerSet) {
          throw new Error('Speaker control not available on Android - no compatible module found');
        }
      }
    } catch (error) {
      console.error('❌ Error in toggleSpeaker:', error);
      throw error;
    }
  }

  // Get current call state
  public getCallState(): CallState {
    return { ...this.callState };
  }

  /**
   * ✅ FIX #1: Sync state from Redux to callService
   * This ensures callService.callState matches Redux state
   * Critical for receiver to detect CONNECTING status when offer arrives
   * 
   * 🔒 CONNECTED STATE LOCK:
   * - If callService.status === CONNECTED, ignore Redux updates unless Redux also says CONNECTED or ENDED
   * - Never allow IDLE / CONNECTING / CALLING to override CONNECTED
   * - This prevents state instability where CONNECTED flips back to other states
   */
  public syncStateFromRedux(reduxState: any): void {
    console.log('🔄 [callService] Syncing state from Redux:', reduxState?.status);
    console.log('   Previous callService state:', this.callState.status);
    
    if (!reduxState) {
      console.warn('⚠️ [callService] No Redux state provided for sync');
      return;
    }
    
    // 🔒 CONNECTED STATE LOCK: Do not downgrade CONNECTED unless Redux also says CONNECTED or ENDED
    if (this.isTerminalConnected()) {
      const reduxStatus = reduxState.status as CallStatus;
      // Only allow sync if Redux also says CONNECTED (normal case) or ENDED (call ended)
      if (reduxStatus !== CallStatus.CONNECTED && reduxStatus !== CallStatus.ENDED) {
        console.log('🔒 [callService] CONNECTED state locked - ignoring Redux update:', reduxStatus);
        console.log('   CONNECTED cannot be downgraded by Redux sync');
        console.log('   Only CONNECTED or ENDED from Redux are allowed');
        // Still sync other fields (not status)
        this.callState = {
          ...this.callState,
          remoteUserId: reduxState.remoteUserId || this.callState.remoteUserId,
          remoteUserName: reduxState.remoteUserName || this.callState.remoteUserName,
          isVideoEnabled: reduxState.isVideoEnabled ?? this.callState.isVideoEnabled,
          isAudioEnabled: reduxState.isAudioEnabled ?? this.callState.isAudioEnabled,
          callHistoryId: reduxState.callHistoryId || this.callState.callHistoryId,
          callStartTime: reduxState.callStartTime || this.callState.callStartTime,
          callDuration: reduxState.callDuration ?? this.callState.callDuration
          // status remains CONNECTED
        };
        return;
      }
    }
    
    const previousStatus = this.callState.status;
    const newStatus = reduxState.status as CallStatus || this.callState.status;
    
    this.callState = {
      ...this.callState,
      status: newStatus,
      remoteUserId: reduxState.remoteUserId || this.callState.remoteUserId,
      remoteUserName: reduxState.remoteUserName || this.callState.remoteUserName,
      isVideoEnabled: reduxState.isVideoEnabled ?? this.callState.isVideoEnabled,
      isAudioEnabled: reduxState.isAudioEnabled ?? this.callState.isAudioEnabled,
      callHistoryId: reduxState.callHistoryId || this.callState.callHistoryId,
      callStartTime: reduxState.callStartTime || this.callState.callStartTime,
      callDuration: reduxState.callDuration ?? this.callState.callDuration
    };
    
    // Start connecting timeout if status just became CONNECTING
    if (newStatus === CallStatus.CONNECTING && previousStatus !== CallStatus.CONNECTING) {
      console.log('⏰ [callService] Starting connecting timeout (30 seconds)');
      this.startConnectingTimeout();
    }
    
    // Stop connecting timeout if status changed from CONNECTING to something else
    if (previousStatus === CallStatus.CONNECTING && newStatus !== CallStatus.CONNECTING) {
      console.log('✅ [callService] Stopping connecting timeout - status changed from CONNECTING');
      this.stopConnectingTimeout();
    }
    
    console.log('✅ [callService] State synced. New status:', this.callState.status);
    console.log('   Remote user:', this.callState.remoteUserId, this.callState.remoteUserName);
  }

  // Get local media stream
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote media stream
  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Add event listener
  public addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  // Remove event listener
  public removeEventListener(event: string, callback: (data: any) => void): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.delete(callback);
    }
  }

  // Emit event to listeners
  private emitEvent(event: string, data: any): void {
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

  // Emit call state change event and persist state
  private emitCallStateChange(): void {
    this.emitEvent('call-state-changed', { ...this.callState });
    this.persistCallState();
  }

  // Persist call state to AsyncStorage
  private async persistCallState(): Promise<void> {
    try {
      const stateToStore = {
        ...this.callState,
        lastUpdated: Date.now()
      };
      await AsyncStorage.setItem('callState', JSON.stringify(stateToStore));
      // Only log for important state changes, not every duration update
      if (this.callState.status !== 'connected' || !this.callState.callStartTime) {
        console.log('Call state persisted:', this.callState.status);
      }
    } catch (error) {
      console.error('Failed to persist call state:', error);
    }
  }

  // Load persisted call state from AsyncStorage
  // FIXED: Only restore on cold app start, not during active socket connections
  // This prevents persisted state from overriding live incoming calls
  // 
  // 🔒 CONNECTED STATE LOCK:
  // - If current callService.status === CONNECTED, DO NOT restore persisted state
  // - Log and skip restore to prevent downgrading CONNECTED state
  private async loadPersistedCallState(): Promise<void> {
    try {
      // 🔒 CONNECTED STATE LOCK: Do not restore persisted state if currently CONNECTED
      if (this.isTerminalConnected()) {
        console.log('🔒 [loadPersistedCallState] CONNECTED state locked - skipping persisted state restore');
        console.log('   CONNECTED cannot be downgraded by persisted state restoration');
        console.log('   Current call remains CONNECTED, persisted state ignored');
        return;
      }
      
      const storedState = await AsyncStorage.getItem('callState');
      if (!storedState) {
        console.log('ℹ️ [loadPersistedCallState] No persisted state found');
        return;
      }
      
      const parsedState = JSON.parse(storedState);
      const lastUpdated = parsedState.lastUpdated || 0;
      const now = Date.now();
      const stateAge = now - lastUpdated;
      
      // CRITICAL FIX: Only restore if state is very recent (within 1 minute)
      // This ensures we only restore on cold app start, not during active socket events
      // Older persisted state likely means the app was closed and we shouldn't restore
      const MAX_RESTORE_AGE = 60000; // 1 minute
      
      if (stateAge > MAX_RESTORE_AGE) {
        console.log(`⚠️ [loadPersistedCallState] Persisted state too old (${Math.round(stateAge / 1000)}s), not restoring`);
        await AsyncStorage.removeItem('callState');
        return;
      }
      
      // ✅ REQUIREMENT 3: Don't restore if call or invitation is active
      // Check both callService state and Redux state (Redux is source of truth)
      try {
        const { store } = require('../redux/store');
        const reduxState = store.getState().call.activeCall;
        const invitationState = store.getState().call.invitation;
        
        // ✅ REQUIREMENT 3: Skip restore if Redux shows active call or invitation
        const hasActiveCall = reduxState.status === CallStatus.CONNECTING ||
                             reduxState.status === CallStatus.CALLING ||
                             reduxState.status === CallStatus.RINGING ||
                             reduxState.status === CallStatus.CONNECTED;
        const hasActiveInvitation = invitationState.status === 'inviting' || 
                                   invitationState.status === 'incoming';
        
        if (hasActiveCall || hasActiveInvitation) {
          console.log(`⚠️ [loadPersistedCallState] Active call or invitation detected, not restoring persisted state`);
          console.log(`   Redux call state: ${reduxState.status}`);
          console.log(`   Invitation state: ${invitationState.status}`);
          console.log(`   Persisted state will be ignored to prevent overriding active calls`);
          await AsyncStorage.removeItem('callState');
          return;
        }
      } catch (error) {
        console.error('❌ [loadPersistedCallState] Error checking Redux state:', error);
        // Continue with local check as fallback
      }
      
      // ✅ REQUIREMENT 3: Also check local callService state (fallback)
      // CRITICAL: Don't restore if status is CONNECTING, CALLING, RINGING, CONNECTED, etc.
      if (this.callState.status !== CallStatus.IDLE && this.callState.status !== CallStatus.ENDED) {
        console.log(`⚠️ [loadPersistedCallState] Call already active (status: ${this.callState.status}), not restoring persisted state`);
        console.log(`   Current state will be preserved, persisted state ignored`);
        await AsyncStorage.removeItem('callState');
        return;
      }
      
      // Safe to restore - state is recent and we're idle (both Redux and callService)
      delete parsedState.lastUpdated;
      this.callState = {
        ...parsedState,
        // Ensure we don't restore ended calls
        status: parsedState.status === CallStatus.ENDED ? CallStatus.IDLE : parsedState.status
      };
      console.log('✅ [loadPersistedCallState] Restored persisted call state:', this.callState);
      this.emitCallStateChange();
      
      // If we restored an active call state, start sync
      if (this.callState.status !== CallStatus.IDLE) {
        this.startStateSync();
      }
    } catch (error) {
      console.error('❌ [loadPersistedCallState] Failed to load persisted call state:', error);
    }
  }

  // Start state synchronization
  private startStateSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.lastSyncAttempt = Date.now();
    this.syncRetryCount = 0;

    this.syncTimer = setInterval(() => {
      this.syncCallState();
    }, this.syncInterval);

    // Initial sync
    this.syncCallState();
  }

  // Stop state synchronization
  private stopStateSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.syncRetryCount = 0;
  }

  // Synchronize call state with server
  private async syncCallState(): Promise<void> {
    if (this.callState.status === CallStatus.IDLE || 
        this.callState.status === CallStatus.ENDED) {
      this.stopStateSync();
      return;
    }

    // Don't sync too frequently
    const now = Date.now();
    if (now - this.lastSyncAttempt < 2000) {
      return;
    }

    this.lastSyncAttempt = now;

    try {
      // Send state update to remote peer through socket
      socketService.getSocket()?.emit('call-state-sync', {
        targetUserId: this.callState.remoteUserId,
        callHistoryId: this.callState.callHistoryId,
        status: this.callState.status,
        callStartTime: this.callState.callStartTime,
        callDuration: this.callState.callDuration,
        isVideoEnabled: this.callState.isVideoEnabled,
        isAudioEnabled: this.callState.isAudioEnabled,
        timestamp: now
      });

      // Reset retry count on successful sync
      this.syncRetryCount = 0;
    } catch (error) {
      console.error('Failed to sync call state:', error);
      this.syncRetryCount++;

      if (this.syncRetryCount >= this.MAX_SYNC_RETRIES) {
        console.log('Max sync retries reached, falling back to local state');
        // Keep the call alive but mark as potentially disconnected
        if (this.callState.status === CallStatus.CONNECTED) {
          this.callState = {
            ...this.callState,
            status: CallStatus.RECONNECTING
          };
          this.emitCallStateChange();
        }
      }
    }
  }

  // Handle ICE connection state changes
  private handleIceConnectionStateChange = (): void => {
    if (!this.pc) return;
    
    const iceState = this.pc.iceConnectionState;
    const connectionState = this.pc.connectionState;
    
    console.log(`🔷 ICE Connection State: ${iceState} | WebRTC Connection State: ${connectionState}`);
    
    switch (iceState) {
      case 'connected':
      case 'completed':
        // Connection established successfully
        console.log('✅ WebRTC ICE connection established successfully!');
        console.log(`   Connection State: ${connectionState}`);
        console.log(`   Signaling State: ${this.pc.signalingState}`);
        break;
        
      case 'disconnected':
        // Connection temporarily disconnected, wait for reconnection
        console.log('WebRTC ICE connection temporarily disconnected, waiting for reconnection...');
        
        // Update call state to reconnecting
        this.callState = {
          ...this.callState,
          status: CallStatus.RECONNECTING
        };
        this.emitCallStateChange();
        
        // Try to reconnect after a brief delay
        setTimeout(() => {
          if (this.pc && this.pc.iceConnectionState === 'disconnected') {
            console.log('Attempting to restart ICE connection...');
            this.pc.restartIce?.();
          }
        }, 2000);
        break;
        
      case 'failed':
        // Connection failed, attempt to restart ICE
        console.log('WebRTC ICE connection failed, attempting to restart...');
        
        // Update call state to reconnecting
        this.callState = {
          ...this.callState,
          status: CallStatus.RECONNECTING
        };
        this.emitCallStateChange();
        
        // Try to reconnect
        if (this.pc) {
          console.log('Restarting ICE connection...');
          this.pc.restartIce?.();
          
          // If restart fails, end the call after a timeout
          setTimeout(() => {
            if (this.pc && 
                (this.pc.iceConnectionState === 'failed' || 
                 this.pc.iceConnectionState === 'disconnected')) {
              console.log('ICE reconnection failed, ending call');
              this.endCall();
            }
          }, 10000); // Wait 10 seconds for reconnection attempt
        }
        break;
        
      case 'closed':
        // Connection closed
        console.log('WebRTC ICE connection closed');
        this.endCall();
        break;
    }
  }

  // Handle the call connected event - ensures both sides have the same call start time
  private handleCallConnected = (data: any) => {
    console.log("Call connected event received:", data);
    
    // Use the timestamp from the event if available, otherwise use current time
    const callStartTime = data?.timestamp || Date.now();
    console.log("Setting synchronized call start time to:", callStartTime);
    
    // Update the call state with synchronized time
    if (this.callState.status === CallStatus.CALLING || 
        this.callState.status === CallStatus.RINGING) {
      this.callState = {
        ...this.callState,
        status: CallStatus.CONNECTED,
        callStartTime: callStartTime,
        callDuration: 0
      };
      
      // Start or restart duration tracking with synchronized time
      this.startDurationTracking();
      
      this.emitCallStateChange();
      console.log("Call state updated with synchronized time");
    } else {
      console.log("Ignoring call connected event in current state:", this.callState.status);
    }
  }

  // Handle video upgrade request from remote peer
  private handleVideoUpgradeRequest = (data: any) => {
    const { from } = data;
    console.log(`Received video upgrade request from ${from}`);
    
    // Emit event to notify UI about the upgrade request
    this.emitEvent('video-upgrade-request', { userId: from });
  };

  // Handle video upgrade acceptance from remote peer
  private handleVideoUpgradeAccepted = async (data: any) => {
    console.log('Video upgrade accepted, adding video track');
    
    try {
      // If we're in stable state, we should be the one to initiate renegotiation
      // since we were the one who requested the upgrade
      if (this.pc && this.pc.signalingState === 'stable') {
        console.log('We requested the upgrade and remote accepted, starting renegotiation');
        
        // First make sure video is enabled on our side
        await this.enableVideo();
        
        // Then initiate the renegotiation
        await this.renegotiateWithVideo();
      } else {
        console.log('Signaling state not stable, only enabling local video without renegotiation');
        // Just enable video locally, but don't try to renegotiate
        await this.enableVideo();
      }
    } catch (error) {
      console.error('Error enabling video after upgrade acceptance:', error);
    }
  };

  // Handle video upgrade rejection from remote peer
  private handleVideoUpgradeRejected = (data: any) => {
    console.log('Video upgrade rejected');
    this.emitEvent('video-upgrade-rejected', data);
  };

  // Request video upgrade from remote peer
  public requestVideoUpgrade(): void {
    if (!this.callState.remoteUserId || this.callState.status !== CallStatus.CONNECTED) {
      console.error('Cannot request video upgrade: No active call');
      return;
    }
    
    if (this.callState.isVideoEnabled) {
      console.log('Video is already enabled');
      return;
    }
    
    // Send video upgrade request via socket
    socketService.getSocket()?.emit('video-upgrade-request', {
      targetUserId: this.callState.remoteUserId
    });
    
    // Notify UI about pending request
    this.emitEvent('video-upgrade-requested', { userId: this.callState.remoteUserId });
    
    // As the initiator, we should also enable our camera right away
    // This will allow our UI to show the camera preview while waiting for acceptance
    this.enableVideo().then(() => {
      console.log('Local video enabled for upgrade request');
    }).catch(error => {
      console.error('Failed to enable local video for upgrade request:', error);
    });
  }

  // Accept video upgrade request
  public acceptVideoUpgrade(): void {
    if (!this.callState.remoteUserId || this.callState.status !== CallStatus.CONNECTED) {
      console.error('Cannot accept video upgrade: No active call');
      return;
    }
    
    // Send acceptance via socket first, so remote side can start showing UI immediately
    socketService.getSocket()?.emit('video-upgrade-accepted', {
      targetUserId: this.callState.remoteUserId
    });
    
    // Check if we already have a local video track before enabling video
    const existingVideoTracks = this.localStream?.getVideoTracks() || [];
    
    if (existingVideoTracks.length > 0) {
      console.log('Using existing video tracks for upgrade');
      // Just enable the existing tracks and update state
      existingVideoTracks.forEach(track => {
        track.enabled = true;
      });
      
      this.callState = {
        ...this.callState,
        isVideoEnabled: true
      };
      
      // Notify about state change immediately
      this.emitCallStateChange();
      this.emitEvent('local-stream-updated', this.localStream);
      
      // Don't initiate renegotiation when accepting - let the requesting side handle it
      // This prevents both sides from creating offers simultaneously
      console.log('Video enabled locally - waiting for remote renegotiation');
    } else {
      // No existing tracks, need to get camera stream
      // Enable video on our side (this will get camera permission and add tracks)
      this.enableVideo().then(() => {
        // Successfully enabled video, but don't initiate renegotiation
        console.log('Video enabled with new camera tracks - waiting for remote renegotiation');
      }).catch(error => {
        console.error('Error enabling video after accepting upgrade:', error);
      });
    }
  }

  // Reject video upgrade request
  public rejectVideoUpgrade(): void {
    if (!this.callState.remoteUserId) return;
    
    // Send rejection via socket
    socketService.getSocket()?.emit('video-upgrade-rejected', {
      targetUserId: this.callState.remoteUserId
    });
  }

  // Enable video without toggling (for upgrade flow)
  public async enableVideo(): Promise<boolean> {
    try {
      if (!this.localStream) return false;
      
      // Check if we already have video tracks
      let videoTracks = this.localStream.getVideoTracks();
      
      // If we don't have video tracks, get them
      if (videoTracks.length === 0) {
        console.log('No video tracks available, requesting camera access');
        
        try {
          // Start performance measurement
          const startTime = Date.now();
          
          // Request camera permission
          const { requestCameraPermission } = require('./permissionUtils');
          
          const hasPermission = await requestCameraPermission();
          if (!hasPermission) {
            console.error('Camera permission denied');
            throw new Error('Camera permission denied');
          }
          
          console.log(`Camera permission check completed in ${Date.now() - startTime}ms`);
          
          // First update the UI state to show we're working on it
          this.callState = {
            ...this.callState,
            isVideoEnabled: true
          };
          
          // Emit state change early to improve perceived performance
          this.emitCallStateChange();
          
          // Set timeout for getUserMedia to avoid hanging indefinitely
          const getUserMediaPromise = mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera access timeout')), 10000);
          });
          
          // Race the getUserMedia promise against the timeout
          const videoStream = await Promise.race([
            getUserMediaPromise,
            timeoutPromise
          ]) as MediaStream;
          
          console.log(`Camera stream obtained in ${Date.now() - startTime}ms`);
          
          if (!videoStream) {
            console.error('Failed to get video stream');
            return false;
          }
          
          // Get the video tracks from the stream
          const newVideoTracks = videoStream.getVideoTracks();
          
          if (newVideoTracks.length === 0) {
            console.error('No video tracks in the obtained stream');
            return false;
          }
          
          // Add the video tracks to our existing stream - optimize by doing this in one batch
          if (this.localStream) {
            newVideoTracks.forEach(track => {
              this.localStream?.addTrack(track);
              console.log('Added video track to local stream:', track.id);
            });
          }
          
          // Update video tracks reference
          videoTracks = this.localStream.getVideoTracks();
          
          // Emit local stream update immediately
          this.emitEvent('local-stream-updated', this.localStream);
          
          console.log(`Total camera initialization completed in ${Date.now() - startTime}ms`);
          
          // If we're in a call, start the renegotiation process in background
          if (this.callState.status === CallStatus.CONNECTED && this.pc) {
            // Check if we're the one who initiated the video upgrade
            const isUpgradeInitiator = this.callState.remoteUserId && 
              this.pc.signalingState === 'stable';
              
            if (isUpgradeInitiator) {
              console.log('We initiated the upgrade, starting renegotiation');
              // Start the renegotiation process in background to avoid blocking UI
              setTimeout(() => {
                this.renegotiateWithVideo().catch(err => {
                  console.error('Renegotiation error:', err);
                });
              }, 500);
            } else {
              console.log('We accepted the upgrade, waiting for remote renegotiation');
              // If we're accepting an upgrade, let the other side handle renegotiation
            }
          }
        } catch (error) {
          console.error('Error getting camera stream:', error);
          throw error;
        }
      }
      
      // Make sure video tracks are enabled
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = true;
          console.log(`Video track ${track.id} enabled`);
        });
        
        this.callState = {
          ...this.callState,
          isVideoEnabled: true
        };
        
        // Notify listeners about the state change
        this.emitCallStateChange();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in enableVideo:', error);
      throw error;
    }
  }
  
  // Separate method for renegotiation to allow returning early from enableVideo
  private async renegotiateWithVideo(): Promise<void> {
    // Ensure we have a valid peer connection and we're in CONNECTED state
    if (!this.pc || this.callState.status !== CallStatus.CONNECTED) {
      return;
    }
    
    try {
      console.log('Starting video renegotiation in current signaling state:', this.pc.signalingState);
      
      // Check current signaling state to determine the correct action
      if (this.pc.signalingState === 'have-remote-offer') {
        // We've received an offer but haven't answered yet
        console.log('Cannot create offer in have-remote-offer state - need to answer the remote offer first');
        
        // Try to create an answer instead
        const pendingRemoteDescription = this.pc.remoteDescription;
        if (pendingRemoteDescription) {
          console.log('Creating answer for pending remote offer');
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          
          // Send the answer
          socketService.getSocket()?.emit('call-answer', {
            targetUserId: this.callState.remoteUserId,
            sdp: answer.sdp,
            type: answer.type,
            accepted: true,
            callHistoryId: this.callState.callHistoryId,
            renegotiation: true
          });
          
          console.log('Sent answer to pending remote offer');
          return;
        }
        return;
      }
      
      if (this.pc.signalingState === 'have-local-offer') {
        // We've sent an offer but haven't received an answer
        console.log('Already have pending local offer, waiting for answer');
        return;
      }
      
      if (this.pc.signalingState === 'closed') {
        console.log('Peer connection is closed, cannot renegotiate');
        return;
      }
      
      if (this.pc.signalingState !== 'stable') {
        console.log('Peer connection is in', this.pc.signalingState, 'state, deferring renegotiation');
        
        // Wait for the connection to stabilize
        setTimeout(() => {
          this.renegotiateWithVideo().catch((err: Error) => {
            console.error('Deferred renegotiation error:', err);
          });
        }, 2000);
        return;
      }
      
      // In stable state, safe to create a new offer
      console.log('Creating offer for video renegotiation');
      
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      });
      
      console.log('New SDP offer created for video upgrade');
      
      // Apply the offer to local description
      await this.pc.setLocalDescription(offer);
      console.log('Successfully set local description for renegotiation');
      
      // Send the offer to the remote peer
      socketService.getSocket()?.emit('call-offer', {
        targetUserId: this.callState.remoteUserId,
        sdp: offer.sdp,
        type: offer.type,
        isVideo: true,
        renegotiation: true
      });
      
      console.log('Sent renegotiation offer to remote peer');
    } catch (error: unknown) {
      console.error('Error during video renegotiation:', error);
      
      // Handle specific error cases
      if (error instanceof Error && error.message.includes('have-remote-offer')) {
        console.log('Handling have-remote-offer error by waiting and trying to answer');
        
        // Wait a moment and try to answer if there's a remote description
        setTimeout(async () => {
          try {
            if (this.pc && this.pc.remoteDescription && this.pc.signalingState === 'have-remote-offer') {
              console.log('Creating answer for existing remote offer after error');
              const answer = await this.pc.createAnswer();
              await this.pc.setLocalDescription(answer);
              
              socketService.getSocket()?.emit('call-answer', {
                targetUserId: this.callState.remoteUserId,
                sdp: answer.sdp,
                type: answer.type,
                accepted: true,
                callHistoryId: this.callState.callHistoryId,
                renegotiation: true
              });
            }
          } catch (retryError) {
            console.error('Error in renegotiation retry:', retryError);
          }
        }, 1000);
      }
      
      throw error;
    }
  }
}

// Create and export a singleton instance
const callService = CallService.getInstance();
export default callService; 