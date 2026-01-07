import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import callService, { CallOptions, CallStatus } from '../../utils/callService';
import {
  setCallState,
  setCallStatus,
  setRemoteUser,
  resetCallState,
  setCallHistory
} from '../slices/callSlice';
import { RootState } from '../store';
import apiClient from '../../utils/apiClient';

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
      console.log('📞 [endActiveCall] Ending active call');
      
      // Set Redux status to ENDED (single source of truth)
      dispatch(setCallStatus(CallStatus.ENDED));
      
      // Clean up WebRTC resources (stops tracks, closes connection, emits socket)
      // NOTE: callService.endCall() does NOT mutate state or emit UI changes
      callService.endCall();
      
      console.log('📞 [endActiveCall] Call status set to ENDED, WebRTC cleanup initiated');
      console.log('📞 [endActiveCall] CallScreen will handle navigation and state reset');
      
      return { success: true };
    } catch (error: any) {
      console.error('📞 [endActiveCall] Error ending call:', error);
      
      // On error, still set status to ENDED and clean up
      dispatch(setCallStatus(CallStatus.ENDED));
      callService.endCall();
      
      return { success: false, error: error.message };
    }
  }
);

// Thunk to toggle audio mute
export const toggleAudioMute = createAsyncThunk(
  'call/toggleAudioMute',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      // Check if call is connected before toggling
      const state = getState() as RootState;
      const callState = state.call.activeCall;
      
      if (callState.status !== CallStatus.CONNECTED) {
        return rejectWithValue('Call is not connected. Please wait for the call to connect.');
      }
      
      // Get call state from service to verify stream exists
      const serviceCallState = callService.getCallState();
      if (!serviceCallState || serviceCallState.status !== CallStatus.CONNECTED) {
        return rejectWithValue('Call is not properly connected. Please try again.');
      }
      
      const isEnabled = callService.toggleAudio();
      console.log(`✅ Audio mute toggled successfully: ${isEnabled ? 'unmuted' : 'muted'}`);
      return { isEnabled, success: true };
    } catch (error: any) {
      console.error('❌ Error toggling audio:', error);
      const errorMessage = error?.message || 'Failed to toggle audio mute. Please try again.';
      return rejectWithValue(errorMessage);
    }
  }
);

// Thunk to toggle video
export const toggleVideoStream = createAsyncThunk(
  'call/toggleVideoStream',
  async (_, { getState }) => {
    try {
      const state = getState() as RootState;
      const callState = state.call.activeCall;
      
      // If already in a connected call, use the video upgrade flow
      if (callState.status === CallStatus.CONNECTED && !callState.isVideoEnabled) {
        // For enabling, we'll use the upgrade flow in the UI component
        // This will just return the current state
        return { success: false, isVideoEnabled: callState.isVideoEnabled };
      }
      
      // Otherwise, just toggle the video
      const isEnabled = await callService.toggleVideo();
      return { success: true, isVideoEnabled: isEnabled };
    } catch (error) {
      console.error('Error toggling video stream:', error);
      return { success: false, isVideoEnabled: false, error: String(error) };
    }
  }
);

// Interface for backend call history response
interface BackendCallHistory {
  _id: string;
  caller: {
    _id: string;
    name: string;
    profilePic?: string;
  };
  receiver: {
    _id: string;
    name: string;
    profilePic?: string;
  };
  startTime: string;
  endTime?: string;
  duration: number;
  isVideoCall: boolean;
  status: string;
  createdAt: string;
}

// Thunk to fetch call history from backend
export const fetchCallHistory = createAsyncThunk(
  'call/fetchCallHistory',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      console.log('Fetching call history from backend...');
      
      const response = await apiClient.get('/calls/history');
      
      if (!response.data) {
        return rejectWithValue('No data returned from server');
      }
      
      // Get current user ID from state
      const state = getState() as RootState;
      const currentUserId = state.auth.userId;
      
      if (!currentUserId) {
        console.error('Current user ID not found in state');
        return rejectWithValue('User not authenticated');
      }
      
      console.log('Current user ID:', currentUserId);
      
      // Transform backend data to match the frontend interface
      const callHistory = response.data
        .filter((call: BackendCallHistory) => {
          // Only include calls that lasted 60 seconds (1 minute) or more
          return call.duration >= 60 && call.status === 'answered';
        })
        .map((call: BackendCallHistory) => {
          console.log(`Processing call - Caller: ${call.caller._id}, Receiver: ${call.receiver._id}, Current User: ${currentUserId}`);
          
          // Determine if this was an incoming call (current user is receiver)
          // Compare as strings to avoid type mismatch issues
          const wasIncoming = String(call.receiver._id) === String(currentUserId);
          
          // Get the other user (not the current user)
          const otherUser = wasIncoming ? call.caller : call.receiver;
          
          console.log(`Selected other user: ${otherUser.name} (${otherUser._id}), wasIncoming: ${wasIncoming}`);
          
          // Double check we're getting the right user
          if (String(otherUser._id) === String(currentUserId)) {
            console.error('ERROR: otherUser is the same as currentUser!');
            console.error('Call details:', JSON.stringify(call, null, 2));
          }
          
          return {
            userId: otherUser._id,
            userName: otherUser.name,
            timestamp: new Date(call.startTime).getTime(),
            duration: call.duration,
            wasVideoCall: call.isVideoCall || false,
            wasIncoming: wasIncoming,
            profilePic: otherUser.profilePic || null,
          };
        });
      
      // Update Redux state with the call history
      dispatch(setCallHistory(callHistory));
      
      console.log(`Successfully fetched ${callHistory.length} call history items (filtered for 1+ minute calls)`);
      return callHistory;
    } catch (error: any) {
      console.error('Error fetching call history:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch call history');
    }
  }
); 