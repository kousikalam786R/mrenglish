import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CallState, initialCallState, CallStatus } from '../../utils/callService';

interface CallSliceState {
  activeCall: CallState;
  callHistory: {
    userId: string;
    userName: string;
    timestamp: number;
    duration: number;
    wasVideoCall: boolean;
    wasIncoming: boolean;
    profilePic?: string | null;
  }[];
  permissionsGranted: boolean;
}

const initialState: CallSliceState = {
  activeCall: initialCallState,
  callHistory: [],
  permissionsGranted: false
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    setCallState: (state, action: PayloadAction<CallState>) => {
      state.activeCall = action.payload;
    },
    
    setCallStatus: (state, action: PayloadAction<CallStatus>) => {
      state.activeCall.status = action.payload;
    },
    
    setRemoteUser: (state, action: PayloadAction<{ userId: string; userName: string }>) => {
      state.activeCall.remoteUserId = action.payload.userId;
      state.activeCall.remoteUserName = action.payload.userName;
    },
    
    toggleAudio: (state) => {
      state.activeCall.isAudioEnabled = !state.activeCall.isAudioEnabled;
    },
    
    toggleVideo: (state) => {
      state.activeCall.isVideoEnabled = !state.activeCall.isVideoEnabled;
    },
    
    resetCallState: (state) => {
      // Add to call history if call was connected
      if (state.activeCall.status === CallStatus.CONNECTED || 
          state.activeCall.status === CallStatus.ENDED) {
        const duration = state.activeCall.callDuration;
        if (duration > 0) {
          state.callHistory.unshift({
            userId: state.activeCall.remoteUserId,
            userName: state.activeCall.remoteUserName,
            timestamp: Date.now(),
            duration: duration,
            wasVideoCall: state.activeCall.isVideoEnabled,
            wasIncoming: false, // Would need to track this separately
            profilePic: undefined,
          });
        }
      }
      
      // Reset to initial state
      state.activeCall = initialCallState;
    },
    
    setPermissionsGranted: (state, action: PayloadAction<boolean>) => {
      state.permissionsGranted = action.payload;
    },
    
    clearCallHistory: (state) => {
      state.callHistory = [];
    },
    
    setCallHistory: (state, action: PayloadAction<CallSliceState['callHistory']>) => {
      state.callHistory = action.payload;
    }
  }
});

export const {
  setCallState,
  setCallStatus,
  setRemoteUser,
  toggleAudio,
  toggleVideo,
  resetCallState,
  setPermissionsGranted,
  clearCallHistory,
  setCallHistory
} = callSlice.actions;

export default callSlice.reducer; 