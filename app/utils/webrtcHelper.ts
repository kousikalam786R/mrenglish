import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';
import socketService from './socketService';
import { Platform } from 'react-native';
import { checkMicrophonePermission } from './permissionUtils';

// Type definitions for event interfaces
interface RTCTrackEvent {
  track: MediaStreamTrack;
  streams: MediaStream[];
}

interface RTCIceCandidateEvent {
  candidate: RTCIceCandidate | null;
}

// WebRTC connection configuration
const RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Add TURN servers for more reliable connections
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh'
    }
  ],
  iceCandidatePoolSize: 10,
};

// WebRTC connection states
export enum ConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed'
}

class WebRTCHelper {
  private static instance: WebRTCHelper;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private connectionState: ConnectionState = ConnectionState.NEW;
  private onConnectionStateChangeCallbacks: ((state: ConnectionState) => void)[] = [];
  private onRemoteStreamUpdateCallbacks: ((stream: MediaStream) => void)[] = [];
  private onLocalStreamUpdateCallbacks: ((stream: MediaStream) => void)[] = [];
  private onErrorCallbacks: ((error: Error) => void)[] = [];

  // Get the singleton instance
  public static getInstance(): WebRTCHelper {
    if (!WebRTCHelper.instance) {
      WebRTCHelper.instance = new WebRTCHelper();
    }
    return WebRTCHelper.instance;
  }

  /**
   * Initialize WebRTC components
   */
  public async initialize(options = { audio: true, video: false }): Promise<boolean> {
    try {
      console.log('Initializing WebRTC components...');
      
      // Check permissions before requesting media
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(RTCConfig);
      console.log('RTCPeerConnection created');

      // Set up event handlers for connection state changes
      this.setupConnectionEventHandlers();
      
      // Get local media stream with requested options
      const mediaConstraints = {
        audio: options.audio,
        video: options.video
      };
      
      console.log('Requesting media with constraints:', mediaConstraints);
      this.localStream = await mediaDevices.getUserMedia(mediaConstraints);
      console.log('Media stream obtained successfully');
      
      // Add tracks to peer connection
      if (this.peerConnection && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
            console.log(`Added ${track.kind} track to peer connection`);
          }
        });
      }
      
      // Initialize remote stream
      this.remoteStream = new MediaStream();
      
      // Notify listeners that local stream is ready
      this.notifyLocalStreamUpdated();
      
      return true;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      this.notifyError(error instanceof Error ? error : new Error('Failed to initialize WebRTC'));
      this.cleanup();
      return false;
    }
  }

  /**
   * Set up event handlers for connection state tracking
   */
  private setupConnectionEventHandlers(): void {
    if (!this.peerConnection) return;
    
    // Track connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      console.log('Connection state changed:', this.peerConnection.connectionState);
      this.connectionState = this.peerConnection.connectionState as ConnectionState;
      this.notifyConnectionStateChanged();
      
      // Handle connection failures
      if (this.connectionState === ConnectionState.FAILED || 
          this.connectionState === ConnectionState.DISCONNECTED) {
        console.log('Connection problem detected, attempting recovery...');
        this.attemptConnectionRecovery();
      }
    };
    
    // Handle incoming tracks from remote peer
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      console.log('Received remote track:', event.track.kind);
      
      if (this.remoteStream && event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
          if (this.remoteStream) {
            this.remoteStream.addTrack(track);
            console.log(`Added remote ${track.kind} track to stream`);
          }
        });
        
        this.notifyRemoteStreamUpdated();
      }
    };
    
    // Handle ICE candidate events
    this.peerConnection.onicecandidate = (event: RTCIceCandidateEvent) => {
      if (event.candidate) {
        console.log('Generated ICE candidate');
        
        // Get remote user ID from socketService
        const remoteUserId = socketService.getRemoteUserId();
        if (!remoteUserId) {
          console.error('No remote user ID set for ICE candidate');
          return;
        }
        
        // Signal the ICE candidate to the peer via socket
        socketService.getSocket()?.emit('call-ice-candidate', {
          targetUserId: remoteUserId,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      } else {
        console.log('All ICE candidates gathered');
      }
    };
    
    // ICE connection state change handling
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      
      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting to restart ICE');
        this.peerConnection.restartIce();
      }
    };
  }

  /**
   * Create and send an offer to start a call
   */
  public async createOffer(): Promise<RTCSessionDescription | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      // Create the offer with options
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      };
      
      const offer = await this.peerConnection.createOffer(offerOptions);
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('Created and set local offer');
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      this.notifyError(error instanceof Error ? error : new Error('Failed to create offer'));
      return null;
    }
  }

  /**
   * Process an incoming offer and create an answer
   */
  public async processOffer(sdp: string, type: string): Promise<RTCSessionDescription | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      // Set remote description from offer
      const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp });
      await this.peerConnection.setRemoteDescription(remoteDesc);
      console.log('Set remote description from offer');
      
      // Create and set local answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Created and set local answer');
      
      return answer;
    } catch (error) {
      console.error('Error processing offer:', error);
      this.notifyError(error instanceof Error ? error : new Error('Failed to process offer'));
      return null;
    }
  }

  /**
   * Process an incoming answer
   */
  public async processAnswer(sdp: string, type: string): Promise<boolean> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      // Set remote description from answer
      const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp });
      await this.peerConnection.setRemoteDescription(remoteDesc);
      console.log('Set remote description from answer');
      
      return true;
    } catch (error) {
      console.error('Error processing answer:', error);
      this.notifyError(error instanceof Error ? error : new Error('Failed to process answer'));
      return false;
    }
  }

  /**
   * Add a received ICE candidate
   */
  public async addIceCandidate(candidate: string, sdpMid: string | null, sdpMLineIndex: number): Promise<boolean> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      const iceCandidate = new RTCIceCandidate({
        candidate,
        sdpMid,
        sdpMLineIndex
      });
      
      await this.peerConnection.addIceCandidate(iceCandidate);
      console.log('Added remote ICE candidate');
      
      return true;
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      return false;
    }
  }

  /**
   * Attempt to recover a failing connection
   */
  private async attemptConnectionRecovery(): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      console.log('Attempting connection recovery...');
      
      // Try restarting ICE
      this.peerConnection.restartIce();
      
      // If that doesn't work, could implement more recovery strategies here
    } catch (error) {
      console.error('Error during connection recovery:', error);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Stop and release local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Reset state
    this.connectionState = ConnectionState.CLOSED;
    this.notifyConnectionStateChanged();
    
    console.log('WebRTC resources cleaned up');
  }

  // Get streams
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }
  
  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
  
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Event listener registration
  public onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChangeCallbacks.push(callback);
  }
  
  public onRemoteStreamUpdate(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamUpdateCallbacks.push(callback);
  }
  
  public onLocalStreamUpdate(callback: (stream: MediaStream) => void): void {
    this.onLocalStreamUpdateCallbacks.push(callback);
  }
  
  public onError(callback: (error: Error) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  // Event notification methods
  private notifyConnectionStateChanged(): void {
    this.onConnectionStateChangeCallbacks.forEach(callback => {
      try {
        callback(this.connectionState);
      } catch (error) {
        console.error('Error in connection state change callback:', error);
      }
    });
  }
  
  private notifyRemoteStreamUpdated(): void {
    if (this.remoteStream) {
      this.onRemoteStreamUpdateCallbacks.forEach(callback => {
        try {
          callback(this.remoteStream!);
        } catch (error) {
          console.error('Error in remote stream update callback:', error);
        }
      });
    }
  }
  
  private notifyLocalStreamUpdated(): void {
    if (this.localStream) {
      this.onLocalStreamUpdateCallbacks.forEach(callback => {
        try {
          callback(this.localStream!);
        } catch (error) {
          console.error('Error in local stream update callback:', error);
        }
      });
    }
  }
  
  private notifyError(error: Error): void {
    this.onErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }
}

export default WebRTCHelper.getInstance(); 