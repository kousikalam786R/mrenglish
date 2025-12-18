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

  // Clear the duration timer
  private clearDurationTimer(): void {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  // Start monitoring connection state actively
  private startConnectionStateMonitor(): void {
    // Clear any existing monitor
    if (this.connectionStateMonitor) {
      clearInterval(this.connectionStateMonitor);
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
      
      // If we're actually connected but state says calling/reconnecting, update it
      if (connState === 'connected' && (iceState === 'connected' || iceState === 'completed')) {
        if (this.callState.status === CallStatus.CALLING || this.callState.status === CallStatus.RECONNECTING) {
          console.log('✅ Connection state monitor detected connected state - updating from', this.callState.status);
          
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
        }
      } else if (connState === 'failed' || iceState === 'failed') {
        console.log('❌ Connection failed according to monitor');
        this.stopConnectionStateMonitor();
      } else if (connState === 'connecting' || iceState === 'checking') {
        // Still connecting, keep monitoring
        if (this.callState.status === CallStatus.CALLING) {
          // Update to reconnecting if we're still in calling state
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
          console.log(`🔍 ICE gathering check: state=${gatheringState}, candidates=${this.iceCandidateCount}, relay=${this.relayCandidateCount}, elapsed=${elapsed}ms`);
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
      
      // Re-initialize
      CallService.instance.initialize();
      console.log('CallService instance has been reset');
    }
  }

  // Initialize the call service and set up event listeners
  public initialize(): void {
    // Register socket event listeners for call signaling
    socketService.getSocket()?.on('call-offer', this.handleCallOffer);
    socketService.getSocket()?.on('call-answer', this.handleCallAnswer);
    socketService.getSocket()?.on('call-ice-candidate', this.handleIceCandidate);
    socketService.getSocket()?.on('call-end', this.handleCallEnd);
    
    // Register video upgrade event listeners
    socketService.getSocket()?.on('video-upgrade-request', this.handleVideoUpgradeRequest);
    socketService.getSocket()?.on('video-upgrade-accepted', this.handleVideoUpgradeAccepted);
    socketService.getSocket()?.on('video-upgrade-rejected', this.handleVideoUpgradeRejected);
    
    // Register state sync listener
    socketService.getSocket()?.on('call-state-sync', this.handleStateSync);
    
    // Register internal event listeners
    this.addEventListener('call-connected', this.handleCallConnected);
    
    // Load any persisted state
    this.loadPersistedCallState();
  }

  // Create an outgoing call
  public async startCall(userId: string, userName: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    try {
      // Check if already in a call
      if (this.callState.status !== CallStatus.IDLE) {
        throw new Error('Already in a call');
      }

      console.log(`Starting call to ${userName} (${userId}) with options:`, options);
      
      // Reset ICE candidate counters
      this.iceCandidateCount = 0;
      this.relayCandidateCount = 0;
      
      // Mark if this is a partner matching call
      if (options.isPartnerMatching) {
        console.log('🤝 This is a partner matching call - will auto-accept on receiver end');
      }

      // Update call state
      this.callState = {
        ...initialCallState,
        status: CallStatus.CALLING,
        remoteUserId: userId,
        remoteUserName: userName,
        isVideoEnabled: options.video || false,
        isAudioEnabled: options.audio !== false, // Default to true if not specified
      };
      
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

      console.log('Creating offer with signaling state:', this.pc.signalingState);
      const offer = await this.pc.createOffer(offerOptions);
      console.log('Offer created successfully');

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
      
      // Prevent processing new call offers if we're already in a call (unless it's a renegotiation)
      if (!renegotiation && this.callState.status !== CallStatus.IDLE && this.callState.status !== CallStatus.ENDED) {
        console.warn('⚠️ Ignoring call offer: Already in a call. Current status:', this.callState.status);
        // If this is a partner matching call and we're already in a call, end the current call first
        if (isPartnerMatching) {
          console.log('🤝 Ending current call to accept partner matching call');
          this.endCall();
          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          return; // Ignore regular call offers when already in a call
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
      this.callState = {
        ...initialCallState,
        status: CallStatus.RINGING,
        remoteUserId: callerId,
        remoteUserName: callerName || 'Unknown Caller',
        isVideoEnabled: isVideo || false,
        isAudioEnabled: true,
        sdp: sdp,
        type: type,
        callHistoryId: callHistoryId
      };
      
      console.log('Updated call state with offer SDP data and callHistoryId:', callHistoryId);
      this.emitCallStateChange();
      
      // Auto-accept partner matching calls
      if (isPartnerMatching) {
        console.log('🤝 Auto-accepting partner matching call');
        (this as any).wasPartnerMatchingCall = true; // Mark as partner matching call
        setTimeout(async () => {
          try {
            // Double-check that we're still in RINGING state before accepting
            if (this.callState.status !== CallStatus.RINGING) {
              console.warn('⚠️ Call state changed before auto-accept. Current status:', this.callState.status);
              return;
            }
            
            // Verify we still have the SDP offer
            if (!this.callState.sdp) {
              console.error('❌ No SDP offer available for auto-accept');
              return;
            }
            
            await this.acceptCall({ audio: true, video: isVideo || false });
            console.log('✅ Partner matching call auto-accepted');
            
            // Emit navigation event for partner matching calls
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
          } catch (error) {
            console.error('❌ Error auto-accepting partner matching call:', error);
            // Clean up on error
            this.endCall();
          }
        }, 500); // Small delay to ensure state is set
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
      if (this.callState.status !== CallStatus.RINGING) {
        throw new Error('No incoming call to accept');
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

      // Send answer to caller first to ensure they get the start time
      console.log('Sending answer to caller:', this.callState.remoteUserId, 'with payload:', answerPayload);
      socketService.getSocket()?.emit('call-answer', answerPayload);

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
    console.log("Ending call with state:", this.callState.status);
    
    // Stop connection state monitor
    this.stopConnectionStateMonitor();
    
    // Stop duration tracking
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    
    // Send call end to remote user if we're in a call
    if (this.callState.status !== CallStatus.IDLE && this.callState.remoteUserId) {
      try {
        // Calculate final duration
        const finalDuration = this.callState.callStartTime 
          ? Math.floor((Date.now() - this.callState.callStartTime) / 1000)
          : this.callState.callDuration;

        socketService.getSocket()?.emit('call-end', {
          targetUserId: this.callState.remoteUserId,
          callHistoryId: this.callState.callHistoryId,
          duration: finalDuration
        });
        console.log("Sent call-end signal to:", this.callState.remoteUserId, 
                    "with callHistoryId:", this.callState.callHistoryId,
                    "duration:", finalDuration);
      } catch (error) {
        console.error("Error sending call-end signal:", error);
      }
    }

    // Stop media streams
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
          } catch (trackError) {
            console.error(`Error stopping ${track.kind} track:`, trackError);
          }
        });
      } catch (streamError) {
        console.error("Error stopping local stream:", streamError);
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
          console.error("Error removing event listeners:", eventError);
        }
        
        // Then close the connection
        this.pc.close();
        console.log("Closed peer connection");
      } catch (pcError) {
        console.error("Error closing peer connection:", pcError);
      }
      this.pc = null;
    }

    // Calculate call duration if there was an active call
    let finalDuration = 0;
    if (this.callState.callStartTime && this.callState.status === CallStatus.CONNECTED) {
      finalDuration = Math.floor((Date.now() - this.callState.callStartTime) / 1000);
      console.log("Call lasted", finalDuration, "seconds");
    }

    // Update call state to ended briefly before resetting
    const endedState = {
      ...this.callState,
      status: CallStatus.ENDED,
      callDuration: finalDuration
    };
    
    // Capture userId before state is reset
    const remoteUserId = this.callState.remoteUserId;
    
    // Emit the ended state with userId for immediate status update
    this.callState = endedState;
    this.emitCallStateChange();
    this.emitEvent('call-ended', { 
      duration: finalDuration,
      userId: remoteUserId,
      remoteUserId: remoteUserId
    });
    
    // Reset call state after a short delay
    setTimeout(() => {
      this.resetCallState();
    }, 1000);
  }

  // Reset call state to idle
  private resetCallState(): void {
    // Stop duration tracking
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
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
      
      // Clean up any existing peer connection first
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
      this.pc = await this.createPeerConnection();
      console.log('RTCPeerConnection created with dynamic configuration');

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
          if (!this.pc) return;
          
          const connectionState = this.pc.connectionState;
          console.log('Connection state changed to:', connectionState);
          
          switch (connectionState) {
            case 'connected':
              console.log('WebRTC connection established successfully!');
              
              // Determine connection type (P2P vs TURN relay)
              this.logConnectionType();
              
              // Update call state to CONNECTED when connection is actually established
              if (this.callState.status === CallStatus.CALLING || 
                  this.callState.status === CallStatus.RINGING ||
                  this.callState.status === CallStatus.RECONNECTING) {
                console.log("Updating call state to CONNECTED");
                
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
              }
              break;

            case 'disconnected':
              console.log('WebRTC connection temporarily disconnected');
              this.callState = {
                ...this.callState,
                status: CallStatus.RECONNECTING
              };
              this.emitCallStateChange();
              break;

            case 'failed':
              console.log('WebRTC connection failed - attempting restart');
              this.callState = {
                ...this.callState,
                status: CallStatus.RECONNECTING
              };
              this.emitCallStateChange();
              
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
              
              this.callState = {
                ...this.callState,
                status: CallStatus.RECONNECTING
              };
              this.emitCallStateChange();
              
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
  private async loadPersistedCallState(): Promise<void> {
    try {
      const storedState = await AsyncStorage.getItem('callState');
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        const lastUpdated = parsedState.lastUpdated || 0;
        const now = Date.now();
        
        // Only restore state if it's recent (within last 5 minutes) and we're not in an active call
        if (now - lastUpdated < 300000 && this.callState.status === CallStatus.IDLE) {
          delete parsedState.lastUpdated;
          this.callState = {
            ...parsedState,
            // Ensure we don't restore ended calls
            status: parsedState.status === CallStatus.ENDED ? CallStatus.IDLE : parsedState.status
          };
          console.log('Restored persisted call state:', this.callState);
          this.emitCallStateChange();
          
          // If we restored an active call state, start sync
          if (this.callState.status !== CallStatus.IDLE) {
            this.startStateSync();
          }
        } else {
          console.log('Persisted state too old or call active, not restoring');
          await AsyncStorage.removeItem('callState');
        }
      }
    } catch (error) {
      console.error('Failed to load persisted call state:', error);
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