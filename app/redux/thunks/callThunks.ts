import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import callService, { CallOptions, CallStatus } from '../../utils/callService';
import {
  setCallState,
  setCallStatus,
  setRemoteUser,
  resetCallState
} from '../slices/callSlice';

// Thunk to initiate a call
export const initiateCall = createAsyncThunk(
  'call/initiateCall',
  async (
    { userId, userName, options = { audio: true, video: false } }: 
    { userId: string; userName: string; options?: CallOptions },
    { dispatch, rejectWithValue }
  ) => {
    try {
      console.log(`Initiating call to ${userName} (${userId})`);
      
      // Set user info in Redux
      dispatch(setRemoteUser({ userId, userName }));
      
      // Update call status
      dispatch(setCallStatus(CallStatus.CALLING));
      
      // Start the actual call
      await callService.startCall(userId, userName, options);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error initiating call:', error);
      Alert.alert('Call Failed', error.message || 'Could not connect the call');
      
      // Reset call state
      dispatch(resetCallState());
      
      return rejectWithValue(error.message || 'Failed to initiate call');
    }
  }
);

// Thunk to accept an incoming call
export const acceptIncomingCall = createAsyncThunk(
  'call/acceptIncomingCall',
  async (
    options: CallOptions = { audio: true, video: false },
    { dispatch, rejectWithValue }
  ) => {
    try {
      console.log('Accepting incoming call');
      
      // Update call status
      dispatch(setCallStatus(CallStatus.CONNECTED));
      
      // Accept the call
      await callService.acceptCall(options);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error accepting call:', error);
      Alert.alert('Call Failed', error.message || 'Could not connect to the call');
      
      // Reset call state
      dispatch(resetCallState());
      
      return rejectWithValue(error.message || 'Failed to accept call');
    }
  }
);

// Thunk to reject an incoming call
export const rejectIncomingCall = createAsyncThunk(
  'call/rejectIncomingCall',
  async (_, { dispatch }) => {
    try {
      console.log('Rejecting incoming call');
      
      // Reject the call
      callService.rejectCall();
      
      // Reset call state
      dispatch(resetCallState());
      
      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting call:', error);
      
      // Still reset the call state even if error
      dispatch(resetCallState());
      
      return { success: false, error: error.message };
    }
  }
);

// Thunk to end an active call
export const endActiveCall = createAsyncThunk(
  'call/endActiveCall',
  async (_, { dispatch }) => {
    try {
      console.log('Ending active call');
      
      // End the call
      callService.endCall();
      
      // Update status to ended - the reset will happen after a delay
      dispatch(setCallStatus(CallStatus.ENDED));
      
      return { success: true };
    } catch (error: any) {
      console.error('Error ending call:', error);
      
      // Still reset the call state
      dispatch(resetCallState());
      
      return { success: false, error: error.message };
    }
  }
);

// Thunk to toggle audio mute
export const toggleAudioMute = createAsyncThunk(
  'call/toggleAudioMute',
  async (_, { dispatch, getState }) => {
    try {
      const isEnabled = callService.toggleAudio();
      return { isEnabled };
    } catch (error) {
      console.error('Error toggling audio:', error);
      return { success: false };
    }
  }
);

// Thunk to toggle video
export const toggleVideoStream = createAsyncThunk(
  'call/toggleVideoStream',
  async (_, { dispatch, getState }) => {
    try {
      const isEnabled = callService.toggleVideo();
      return { isEnabled };
    } catch (error) {
      console.error('Error toggling video:', error);
      return { success: false };
    }
  }
); 