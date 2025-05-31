import { Platform } from 'react-native';
import socketService from './socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices
} from 'react-native-webrtc';

// Type definitions
export interface CallOptions {
  audio?: boolean;
  video?: boolean;
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

  // ICE server configuration for STUN/TURN
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Add free TURN servers
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
      },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  private constructor() {}

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
    
    // Register internal event listeners
    this.addEventListener('call-connected', this.handleCallConnected);
  }

  // Create an outgoing call
  public async startCall(userId: string, userName: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    try {
      // Check if already in a call
      if (this.callState.status !== CallStatus.IDLE) {
        throw new Error('Already in a call');
      }

      console.log(`Starting call to ${userName} (${userId}) with options:`, options);

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

      // Set local description
      await this.pc.setLocalDescription(offer);
      console.log('Local description (offer) set successfully');

      // Send offer to remote user
      console.log(`Sending call offer to ${userId}`);
      socketService.getSocket()?.emit('call-offer', {
        targetUserId: userId,
        sdp: offer.sdp,
        type: offer.type,
        isVideo: options.video || false
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
      console.log('Received call offer:', data);
      const { callerId, callerName, sdp, type, isVideo, callHistoryId, renegotiation } = data;
      
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
      this.emitEvent('incoming-call', data);

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

      // Initialize WebRTC
      await this.initializeWebRTC(options);

      if (!this.pc) {
        throw new Error('Failed to initialize peer connection');
      }

      console.log('Setting remote description (offer) with signaling state:', this.pc.signalingState);

      // Set remote description (the offer)
      const remoteDesc = new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      });
      
      await this.pc.setRemoteDescription(remoteDesc);
      console.log('Successfully set remote description (offer)');

      // Create answer
      console.log('Creating answer with signaling state:', this.pc.signalingState);
      const answer = await this.pc.createAnswer();
      console.log('Answer created successfully');
      
      // Set local description
      await this.pc.setLocalDescription(answer);
      console.log('Successfully set local description (answer)');

      // Send answer to caller
      console.log('Sending answer to caller:', this.callState.remoteUserId);
      socketService.getSocket()?.emit('call-answer', {
        targetUserId: this.callState.remoteUserId,
        sdp: answer.sdp,
        type: answer.type,
        accepted: true,
        callHistoryId: this.callState.callHistoryId
      });

      // Update call state
      this.callState = {
        ...this.callState,
        status: CallStatus.CONNECTED,
        callStartTime: Date.now(),
      };
      
      this.emitCallStateChange();

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
      const { accepted, sdp, type, callHistoryId, renegotiation } = data;

      // Store callHistoryId if provided
      if (callHistoryId) {
        this.callState.callHistoryId = callHistoryId;
      }

      if (!accepted) {
        // Call was rejected
        this.emitEvent('call-rejected', data);
        this.resetCallState();
        return;
      }

      // Make sure we have a valid peer connection
      if (!this.pc) {
        console.error("Cannot process answer: peer connection not initialized");
        return;
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
        
        // Update call state to connected if not already
        if (this.callState.status !== CallStatus.CONNECTED) {
          const currentTime = Date.now();
          console.log("Setting call start time to:", currentTime);
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: currentTime,
          };
          this.emitCallStateChange();
          this.emitEvent('call-connected', { timestamp: currentTime });
        }
        return;
      }
      
      // Only proceed if we're in the right state for accepting an answer
      const currentState = this.pc.signalingState;
      if (currentState !== "have-local-offer") {
        console.error("Cannot set remote answer: invalid signaling state:", currentState);
         
        // Handle specific invalid states - try to recover
        console.log("Attempting to recover from invalid state...");
        if (currentState === "have-remote-offer") {
          console.log("We have a remote offer but received an answer - possible race condition");
          // Just update the call state and hope for the best
          const currentTime = Date.now();
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: currentTime,
          };
          this.emitCallStateChange();
          this.emitEvent('call-connected', { timestamp: currentTime });
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
        await this.pc.setRemoteDescription(remoteDesc);
        console.log("Successfully set remote description (answer). New signaling state:", this.pc.signalingState);
        
        // Update call state
        const currentTime = Date.now();
        console.log("Setting call start time to:", currentTime);
        this.callState = {
          ...this.callState,
          status: CallStatus.CONNECTED,
          callStartTime: currentTime,
        };
        
        this.emitCallStateChange();
        this.emitEvent('call-connected', { timestamp: currentTime });
      } catch (err) {
        console.error("Error setting remote description:", err);
        
        // If we get a stable state error, it means the connection is established
        // This can happen if the answer was processed twice or we hit a race condition
        if (err.toString().includes("Called in wrong state: stable")) {
          console.log("Ignoring stable state error - connection appears to be established");
          const currentTime = Date.now();
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: currentTime,
          };
          this.emitCallStateChange();
          this.emitEvent('call-connected', { timestamp: currentTime });
          return;
        }
        
        throw err;
      }

    } catch (error: any) {
      console.error('Error handling call answer:', error);
      // Don't end the call for SDP errors in this state, as the connection might still work
      if (error && typeof error.toString === 'function' && !error.toString().includes("Failed to set remote answer sdp: Called in wrong state: stable")) {
        this.endCall();
      } else {
        console.log("Ignoring stable state error and attempting to continue the call");
        // Try to continue with the call despite the error
        const currentTime = Date.now();
        if (this.callState.status !== CallStatus.CONNECTED) {
          this.callState = {
            ...this.callState,
            status: CallStatus.CONNECTED,
            callStartTime: currentTime,
          };
          this.emitCallStateChange();
          this.emitEvent('call-connected', { timestamp: currentTime });
        }
      }
    }
  }

  // Handle ICE candidate from remote peer
  private handleIceCandidate = async (data: any) => {
    try {
      if (!this.pc || this.callState.status === CallStatus.IDLE) {
        return;
      }

      const { candidate, sdpMid, sdpMLineIndex } = data;
      
      if (candidate) {
        const iceCandidate = new RTCIceCandidate({
          candidate,
          sdpMid,
          sdpMLineIndex
        });
        
        await this.pc.addIceCandidate(iceCandidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Handle call end from remote peer
  private handleCallEnd = () => {
    if (this.callState.status === CallStatus.IDLE) {
      return;
    }

    this.emitEvent('call-ended', { remoteEnded: true });
    this.endCall();
  }

  // End the current call
  public endCall(): void {
    console.log("Ending call with state:", this.callState.status);
    
    // Send call end to remote user if we're in a call
    if (this.callState.status !== CallStatus.IDLE && this.callState.remoteUserId) {
      try {
        socketService.getSocket()?.emit('call-end', {
          targetUserId: this.callState.remoteUserId,
          callHistoryId: this.callState.callHistoryId
        });
        console.log("Sent call-end signal to:", this.callState.remoteUserId, "with callHistoryId:", this.callState.callHistoryId);
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
    
    // Emit the ended state
    this.callState = endedState;
    this.emitCallStateChange();
    this.emitEvent('call-ended', { duration: finalDuration });
    
    // Reset call state after a short delay
    setTimeout(() => {
      this.resetCallState();
    }, 1000);
  }

  // Reset call state to idle
  private resetCallState(): void {
    this.callState = { ...initialCallState };
    this.emitCallStateChange();
  }

  // Initialize WebRTC peer connection and media streams
  private async initializeWebRTC(options: CallOptions): Promise<void> {
    try {
      console.log('Initializing WebRTC with options:', options);
      
      // Create peer connection
      this.pc = new RTCPeerConnection(this.configuration);
      console.log('RTCPeerConnection created with config:', this.configuration);

      // Set up event handlers using proper properties
      // For TypeScript, we need to use the 'any' type to bypass type checking for these properties
      // This is because react-native-webrtc's TypeScript definitions don't match the actual API
      (this.pc as any).oniceconnectionstatechange = this.handleIceConnectionStateChange;
      
      (this.pc as any).onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.pc?.iceGatheringState);
      };
      
      (this.pc as any).onsignalingstatechange = () => {
        console.log('Signaling state:', this.pc?.signalingState);
      };

      try {
        // Get local media stream
        const mediaConstraints = {
          audio: options.audio !== false, // Default to true
          video: options.video || false
        };
        
        console.log('Requesting media with constraints:', mediaConstraints);
        this.localStream = await mediaDevices.getUserMedia(mediaConstraints);
        console.log('Media stream obtained successfully');

        // Add local tracks to peer connection
        this.localStream.getTracks().forEach((track) => {
          console.log('Adding track to peer connection:', track.kind, track.id);
          if (this.pc && this.localStream) {
            this.pc.addTrack(track, this.localStream);
          }
        });

        // Create remote stream
        this.remoteStream = new MediaStream();
        console.log('Remote stream created');

        // Handle incoming tracks with type assertion for TypeScript
        (this.pc as any).ontrack = (event: any) => {
          console.log('Received remote track:', event.track.kind, event.track.id);
          if (event.streams && event.streams.length > 0) {
            event.streams[0].getTracks().forEach((track: any) => {
              if (this.remoteStream) {
                this.remoteStream.addTrack(track);
                console.log('Added remote track to remote stream:', track.kind);
              }
            });
            this.emitEvent('remote-stream-updated', this.remoteStream);
          }
        };

        // Handle ICE candidates with type assertion for TypeScript
        (this.pc as any).onicecandidate = (event: any) => {
          if (event.candidate) {
            console.log('Generated ICE candidate for', this.callState.remoteUserId);
            socketService.getSocket()?.emit('call-ice-candidate', {
              targetUserId: this.callState.remoteUserId,
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            });
          } else {
            console.log('All ICE candidates gathered');
          }
        };

        // Handle connection state changes with type assertion for TypeScript
        (this.pc as any).onconnectionstatechange = () => {
          console.log('Connection state changed to:', this.pc?.connectionState);
          
          if (this.pc?.connectionState === 'connected') {
            console.log('WebRTC connection established successfully!');
            
            // Update call state if not already connected
            if (this.callState.status !== CallStatus.CONNECTED) {
              console.log("Updating call state to CONNECTED");
              this.callState = {
                ...this.callState,
                status: CallStatus.CONNECTED,
                callStartTime: this.callState.callStartTime || Date.now()
              };
              this.emitCallStateChange();
              
              // Notify about connection - this is important for the timer on both sides
              this.emitEvent('call-connected', {
                remoteUserId: this.callState.remoteUserId,
                timestamp: Date.now()
              });
            }
          } else if (this.pc?.connectionState === 'disconnected' || 
                    this.pc?.connectionState === 'failed' ||
                    this.pc?.connectionState === 'closed') {
            console.log('WebRTC connection ended:', this.pc?.connectionState);
            // Don't immediately end the call - let the ICE connection handler manage reconnection
            if (this.pc?.connectionState === 'closed') {
              this.endCall();
            } else if (this.pc?.connectionState === 'failed') {
              // Connection failed - try one last restart
              console.log("Connection failed - attempting last restart...");
              setTimeout(() => {
                if (this.pc && this.pc.connectionState === 'failed') {
                  try {
                    (this.pc as any).restartIce?.();
                    console.log("Attempted restart for failed connection");
                    
                    // Set a timeout to end the call if reconnection fails
                    setTimeout(() => {
                      if (this.pc?.connectionState !== 'connected') {
                        console.log("Failed to reconnect after timeout - ending call");
                        this.endCall();
                      }
                    }, 8000);
                  } catch (err) {
                    console.error("Error restarting failed connection:", err);
                    this.endCall();
                  }
                }
              }, 1000);
            }
          } else if (this.pc?.connectionState === 'connecting') {
            console.log('WebRTC connection is connecting...');
            this.callState = {
              ...this.callState,
              status: CallStatus.RECONNECTING
            };
            this.emitCallStateChange();
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
    if (!this.localStream) return false;
    
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return false;
    
    const isEnabled = !audioTracks[0].enabled;
    audioTracks.forEach(track => {
      track.enabled = isEnabled;
    });
    
    this.callState = {
      ...this.callState,
      isAudioEnabled: isEnabled
    };
    
    this.emitCallStateChange();
    return isEnabled;
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
  public toggleSpeaker(): void {
    // This is platform-specific and requires native modules
    // Implement based on the audio routing capabilities available
    // This is a placeholder that would need to be implemented with a native module
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

  // Emit call state change event
  private emitCallStateChange(): void {
    this.emitEvent('call-state-changed', { ...this.callState });
  }

  // Handle ICE connection state changes
  private handleIceConnectionStateChange = (): void => {
    if (!this.pc) return;
    
    console.log('ICE connection state changed to:', this.pc.iceConnectionState);
    
    switch (this.pc.iceConnectionState) {
      case 'connected':
      case 'completed':
        // Connection established successfully
        console.log('WebRTC ICE connection established successfully!');
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
    
    // Only update if we're not already connected
    if (this.callState.status !== CallStatus.CONNECTED as CallStatus) {
      console.log("Setting call state to CONNECTED from event");
      
      // Use the timestamp from the event if available, otherwise use current time
      const callStartTime = data?.timestamp || Date.now();
      console.log("Setting synchronized call start time to:", callStartTime);
      
      this.callState = {
        ...this.callState,
        status: CallStatus.CONNECTED,
        callStartTime: callStartTime
      };
      this.emitCallStateChange();
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
    socketService.requestVideoUpgrade(this.callState.remoteUserId);
    
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
    socketService.acceptVideoUpgrade(this.callState.remoteUserId);
    
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
    socketService.rejectVideoUpgrade(this.callState.remoteUserId);
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

export default CallService.getInstance(); 