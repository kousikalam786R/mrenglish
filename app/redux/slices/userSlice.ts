import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile } from '../../utils/profileService';

// Define initial state
const initialState: UserProfile = {
  _id: undefined,
  name: undefined,
  email: undefined,
  profilePic: undefined,
  level: 'Beginner',
  points: 0,
  streak: 0,
  calls: 0,
  minutes: 0,
  interests: [],
  bio: 'No bio yet',
  country: 'Unknown',
  recentActivity: []
};

// Create the user slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserData: (state, action: PayloadAction<UserProfile>) => {
      return { ...state, ...action.payload };
    },
    updateUserProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      return { ...state, ...action.payload };
    },
    clearUserData: () => initialState,
    incrementPoints: (state, action: PayloadAction<number>) => {
      state.points = (state.points || 0) + action.payload;
    },
    incrementStreak: (state) => {
      state.streak = (state.streak || 0) + 1;
    },
    resetStreak: (state) => {
      state.streak = 0;
    },
    addRecentActivity: (state, action: PayloadAction<{text: string, time: string}>) => {
      if (!state.recentActivity) {
        state.recentActivity = [];
      }
      state.recentActivity.unshift(action.payload);
      // Keep only the latest 10 activities
      if (state.recentActivity.length > 10) {
        state.recentActivity = state.recentActivity.slice(0, 10);
      }
    }
  }
});

// Export actions and reducer
export const { 
  setUserData, 
  updateUserProfile, 
  clearUserData,
  incrementPoints,
  incrementStreak,
  resetStreak,
  addRecentActivity
} = userSlice.actions;

export default userSlice.reducer;