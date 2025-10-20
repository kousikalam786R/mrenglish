/**
 * Partner Matching Call Service
 * 
 * Handles direct WebRTC calls for partner matching without going through
 * the normal call flow that triggers incoming call modals
 */

import { mediaDevices, RTCPeerConnection, RTCView } from 'react-native-webrtc';
import socketService from './socketService';

interface PartnerCallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended';
  partnerId: string;
  partnerName: string;
  localStream: any;
  remoteStream: any;
  pc: RTCPeerConnection | null;
}

class PartnerMatchingCallService {
  private static instance: PartnerMatchingCallService;
  private callState: PartnerCallState = {
    status: 'idle',
    partnerId: '',
    partnerName: '',
    localStream: null,
    remoteStream: null,
    pc: null
  };

  private callbacks: { [key: string]: Function[] } = {};

  public static getInstance(): PartnerMatchingCallService {
    if (!PartnerMatchingCallService.instance) {
      PartnerMatchingCallService.instance = new PartnerMatchingCallService();
    }
    return PartnerMatchingCallService.instance;
  }

  // Event listener system
  public addEventListener(event: string, callback: Function): void {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  public removeEventListener(event: string, callback: Function): void {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  private emitEvent(event: string, data?: any): void {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  // Start a partner matching call
  public async startPartnerCall(partnerId: string, partnerName: string): Promise<void> {
    try {
      console.log('🚀 Starting partner matching call with:', partnerName);
      console.log('Partner ID:', partnerId);

      this.callState = {
        status: 'connecting',
        partnerId,
        partnerName,
        localStream: null,
        remoteStream: null,
        pc: null
      };

      console.log('📱 Getting user media...');
      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      console.log('✅ Got user media, tracks:', stream.getTracks().length);
      this.callState.localStream = stream;
      this.emitEvent('call-state-changed', this.callState);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.callState.pc = pc;

      // Add local stream
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📺 Received remote stream');
        this.callState.remoteStream = event.streams[0];
        this.emitEvent('call-state-changed', this.callState);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.socketEmit('partner-call-ice-candidate', {
            targetUserId: partnerId,
            candidate: event.candidate
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          this.callState.status = 'connected';
          this.emitEvent('call-state-changed', this.callState);
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to partner
      socketService.socketEmit('partner-call-offer', {
        targetUserId: partnerId,
        offer: offer
      });

      console.log('✅ Partner call offer sent');

    } catch (error) {
      console.error('❌ Error starting partner call:', error);
      this.endPartnerCall();
      throw error;
    }
  }

  // Handle incoming partner call offer
  public async handlePartnerCallOffer(data: any): Promise<void> {
    try {
      console.log('📞 Received partner call offer');
      
      const { offer, callerId, callerName } = data;
      
      this.callState = {
        status: 'connecting',
        partnerId: callerId,
        partnerName: callerName,
        localStream: null,
        remoteStream: null,
        pc: null
      };

      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      this.callState.localStream = stream;
      this.emitEvent('call-state-changed', this.callState);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.callState.pc = pc;

      // Add local stream
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📺 Received remote stream');
        this.callState.remoteStream = event.streams[0];
        this.emitEvent('call-state-changed', this.callState);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.socketEmit('partner-call-ice-candidate', {
            targetUserId: callerId,
            candidate: event.candidate
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          this.callState.status = 'connected';
          this.emitEvent('call-state-changed', this.callState);
        }
      };

      // Set remote description and create answer
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer back
      socketService.socketEmit('partner-call-answer', {
        targetUserId: callerId,
        answer: answer
      });

      console.log('✅ Partner call answer sent');

    } catch (error) {
      console.error('❌ Error handling partner call offer:', error);
      this.endPartnerCall();
    }
  }

  // Handle partner call answer
  public async handlePartnerCallAnswer(data: any): Promise<void> {
    try {
      console.log('📞 Received partner call answer');
      
      const { answer } = data;
      
      if (this.callState.pc) {
        await this.callState.pc.setRemoteDescription(answer);
        console.log('✅ Partner call answer processed');
      }
    } catch (error) {
      console.error('❌ Error handling partner call answer:', error);
    }
  }

  // Handle ICE candidate
  public async handleIceCandidate(data: any): Promise<void> {
    try {
      const { candidate } = data;
      
      if (this.callState.pc && candidate) {
        await this.callState.pc.addIceCandidate(candidate);
        console.log('✅ ICE candidate added');
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  // End partner call
  public endPartnerCall(): void {
    console.log('📞 Ending partner call');
    
    // Stop local stream
    if (this.callState.localStream) {
      this.callState.localStream.getTracks().forEach((track: any) => {
        track.stop();
      });
    }

    // Close peer connection
    if (this.callState.pc) {
      this.callState.pc.close();
    }

    // Reset state
    this.callState = {
      status: 'ended',
      partnerId: '',
      partnerName: '',
      localStream: null,
      remoteStream: null,
      pc: null
    };

    this.emitEvent('call-state-changed', this.callState);
    
    // Notify server
    socketService.socketEmit('partner-call-ended', {
      targetUserId: this.callState.partnerId
    });
  }

  // Get current call state
  public getCallState(): PartnerCallState {
    return { ...this.callState };
  }

  // Check if call is active
  public isCallActive(): boolean {
    return this.callState.status === 'connected' || this.callState.status === 'connecting';
  }
}

export default PartnerMatchingCallService.getInstance();
