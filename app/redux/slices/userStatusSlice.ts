/**
 * User Status Slice
 * 
 * UNIFIED USER STATUS SYSTEM - FRONTEND STORE
 * 
 * This slice maintains a centralized store of user statuses that drives
 * UI behavior consistently across the app.
 * 
 * Status Types:
 * - offline   → user not connected
 * - online    → user active in app, not calling
 * - on_call   → user currently in a call
 * - searching → user is searching for perfect partner
 * 
 * Rules:
 * - Status must come ONLY from backend (Socket.IO events)
 * - UI must NEVER guess status
 * - This store is updated ONLY from socket events
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type UserStatusType = 'offline' | 'online' | 'on_call' | 'searching';

export interface UserStatusData {
  status: UserStatusType;
  lastUpdated: string;
}

interface UserStatusState {
  // userId -> status data
  statuses: Record<string, UserStatusData>;
}

const initialState: UserStatusState = {
  statuses: {},
};

const userStatusSlice = createSlice({
  name: 'userStatus',
  initialState,
  reducers: {
    /**
     * Update a single user's status
     * Called ONLY from socket events (user:status:update)
     */
    updateUserStatus: (
      state,
      action: PayloadAction<{ userId: string; status: UserStatusType; lastUpdated: string }>
    ) => {
      const { userId, status, lastUpdated } = action.payload;
      state.statuses[userId] = {
        status,
        lastUpdated,
      };
    },

    /**
     * Update multiple users' statuses at once
     * Called from socket events (user:status:list)
     */
    updateMultipleUserStatuses: (
      state,
      action: PayloadAction<Array<{ userId: string; status: UserStatusType; lastUpdated: string }>>
    ) => {
      action.payload.forEach(({ userId, status, lastUpdated }) => {
        state.statuses[userId] = {
          status,
          lastUpdated,
        };
      });
    },

    /**
     * Remove a user's status (when they disconnect permanently)
     */
    removeUserStatus: (state, action: PayloadAction<string>) => {
      delete state.statuses[action.payload];
    },

    /**
     * Clear all statuses (on logout or app reset)
     */
    clearAllStatuses: (state) => {
      state.statuses = {};
    },
  },
});

export const {
  updateUserStatus,
  updateMultipleUserStatuses,
  removeUserStatus,
  clearAllStatuses,
} = userStatusSlice.actions;

// Selectors
export const selectUserStatus = (userId: string) => (state: { userStatus: UserStatusState }) =>
  state.userStatus.statuses[userId] || { status: 'offline' as UserStatusType, lastUpdated: new Date().toISOString() };

export const selectMultipleUserStatuses = (userIds: string[]) => (state: { userStatus: UserStatusState }) => {
  const result: Record<string, UserStatusData> = {};
  userIds.forEach((userId) => {
    result[userId] = state.userStatus.statuses[userId] || {
      status: 'offline' as UserStatusType,
      lastUpdated: new Date().toISOString(),
    };
  });
  return result;
};

export const selectAllStatuses = (state: { userStatus: UserStatusState }) => state.userStatus.statuses;

export default userStatusSlice.reducer;

