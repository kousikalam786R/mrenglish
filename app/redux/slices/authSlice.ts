import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define auth state interface
interface AuthState {
  isSignedIn: boolean;
  token: string | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
}

// Define initial state
const initialState: AuthState = {
  isSignedIn: false,
  token: null,
  userId: null,
  loading: false,
  error: null
};

// Create the auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    signInSuccess: (state, action: PayloadAction<{ token: string; userId: string }>) => {
      state.isSignedIn = true;
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      state.loading = false;
      state.error = null;
      
      // Store auth data in AsyncStorage
      AsyncStorage.setItem('token', action.payload.token);
      AsyncStorage.setItem('userId', action.payload.userId);
    },
    signOutSuccess: (state) => {
      state.isSignedIn = false;
      state.token = null;
      state.userId = null;
      state.loading = false;
      
      // Clear auth data from AsyncStorage
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('userId');
      AsyncStorage.removeItem('user');
    },
    authFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

// Export actions and reducer
export const { 
  authStart, 
  signInSuccess, 
  signOutSuccess, 
  authFail,
  clearError
} = authSlice.actions;

export default authSlice.reducer;