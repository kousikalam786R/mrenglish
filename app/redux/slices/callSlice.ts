import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export enum CallStatus {
  IDLE = 'idle',
  INVITING = 'inviting',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ENDED = 'ended',
}

export interface CallState {
  status: CallStatus;
  callId: string | null;
  remoteUserId: string | null;
  remoteUserName: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  callStartTime: number | null;
  callDuration: number;
}

export const initialCallState: CallState = {
  status: CallStatus.IDLE,
  callId: null,
  remoteUserId: null,
  remoteUserName: null,
  isAudioEnabled: true,
  isVideoEnabled: false,
  callStartTime: null,
  callDuration: 0,
};

// INVITATION-FIRST ARCHITECTURE:
// Invitation state is separate from call state
// Invitation ≠ Call
// Call starts ONLY after invitation acceptance

export interface InvitationState {
  inviteId: string | null;
  status: 'idle' | 'inviting' | 'incoming';
  remoteUserId: string | null;
  remoteUserName: string | null;
  remoteUserProfilePic?: string;
  expiresAt: number | null; // timestamp
  metadata?: {
    isVideo?: boolean;
    topic?: string;
    level?: string;
    [key: string]: any;
  };
  callHistoryId?: string;
}

const initialInvitationState: InvitationState = {
  inviteId: null,
  status: 'idle',
  remoteUserId: null,
  remoteUserName: null,
  remoteUserProfilePic: undefined,
  expiresAt: null,
  metadata: undefined,
  callHistoryId: undefined
};

interface CallSliceState {
  activeCall: CallState;
  invitation: InvitationState; // Separate invitation state
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
  invitation: initialInvitationState,
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
    
    setAudioEnabled: (state, action: PayloadAction<boolean>) => {
      state.activeCall.isAudioEnabled = action.payload;
    },
    
    toggleVideo: (state) => {
      state.activeCall.isVideoEnabled = !state.activeCall.isVideoEnabled;
    },
    
    resetCallState: (state) => {
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
    },
    
    // INVITATION STATE ACTIONS
    setInvitationState: (state, action: PayloadAction<Partial<InvitationState>>) => {
      state.invitation = { ...state.invitation, ...action.payload };
    },
    
    resetInvitationState: (state) => {
      state.invitation = initialInvitationState;
    }
  },
  extraReducers: (builder) => {
    // Handle toggleAudioMute fulfilled action to sync Redux state
    builder.addMatcher(
      (action) => action.type === 'call/toggleAudioMute/fulfilled',
      (state, action: any) => {
        if (action.payload?.isEnabled !== undefined) {
          state.activeCall.isAudioEnabled = action.payload.isEnabled;
        }
      }
    );
  }
});

export const {
  setCallState,
  setCallStatus,
  setRemoteUser,
  toggleAudio,
  setAudioEnabled,
  toggleVideo,
  resetCallState,
  setPermissionsGranted,
  clearCallHistory,
  setCallHistory,
  setInvitationState,
  resetInvitationState
} = callSlice.actions;

export default callSlice.reducer; 