import { createAsyncThunk } from '@reduxjs/toolkit';
import { authStart, signInSuccess, signOutSuccess, authFail } from '../slices/authSlice';
import { clearUserData } from '../slices/userSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as atob } from 'base-64';
import { API_URL, DIRECT_IP, DEV, USING_NGROK } from '../../utils/config';

// Helper function to decode JWT
const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

// Thunk for signing in
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { dispatch }) => {
    try {
      dispatch(authStart());
      
      // Here you would call your API to sign in
      // For now, we'll just simulate a successful sign in
      
      // Simulate API call
      const signinEndpoint = USING_NGROK
        ? `${API_URL}/auth/signin`
        : (DEV ? `http://${DIRECT_IP}:5000/api/auth/signin` : `${DIRECT_IP}/api/auth/signin`);

      const response = await fetch(signinEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sign in');
      }
      
      const data = await response.json();
      
      if (data && data.token) {
        // Decode token to get user ID
        const decoded = decodeJWT(data.token);
        const userId = decoded?.id || '';
        
        // Dispatch success action
        dispatch(signInSuccess({ token: data.token, userId }));
        return { token: data.token, userId };
      }
      
      throw new Error('Invalid response from server');
    } catch (error: any) {
      dispatch(authFail(error.message || 'Failed to sign in'));
      throw error;
    }
  }
);

// Thunk for signing out
export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { dispatch }) => {
    try {
      // Clear user data
      dispatch(clearUserData());
      
      // Sign out
      dispatch(signOutSuccess());
      
      return true;
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
);

// Thunk for checking if user is already signed in
export const checkAuthState = createAsyncThunk(
  'auth/checkState',
  async (_, { dispatch }) => {
    try {
      console.log('Checking authentication state...');
      
      // Try to get token from different storage keys
      let token = await AsyncStorage.getItem('token');
      let userId = await AsyncStorage.getItem('userId');
      
      // If token not found, try alternate keys
      if (!token) {
        console.log('No token found in primary storage, checking alternates...');
        token = await AsyncStorage.getItem('auth_token');
        console.log('Alternate auth_token exists:', !!token);
      }
      
      // If still no token, check for authToken
      if (!token) {
        token = await AsyncStorage.getItem('authToken'); 
        console.log('authToken exists:', !!token);
      }
      
      console.log('Token exists:', !!token);
      console.log('User ID exists:', !!userId);
      
      if (token) {
        // If we have a token but no userId, try to extract it from the token
        if (!userId) {
          console.log('No userId found, attempting to extract from token...');
          const decoded = decodeJWT(token);
          console.log('Token decoded:', !!decoded);
          
          if (decoded) {
            userId = decoded.id || decoded.userId || decoded.sub || '';
            console.log('Extracted userId from token:', userId);
            
            // Save the extracted userId for future use
            if (userId) {
              await AsyncStorage.setItem('userId', userId);
            }
          }
        }
        
        // Validate token (check expiration)
        const decoded = decodeJWT(token);
        console.log('Token decoded for validation:', !!decoded);
        
        if (decoded && userId) {
          // Check if token is expired
          const isTokenValid = !decoded.exp || decoded.exp * 1000 > Date.now();
          console.log('Token valid (not expired):', isTokenValid);
          
          if (isTokenValid) {
            console.log('Auth state valid, signing in with token and userId');
            dispatch(signInSuccess({ token, userId }));
            return { token, userId };
          } else {
            console.log('Token expired, signing out');
            dispatch(signOutSuccess());
          }
        } else {
          console.log('Decoded token or userId missing, signing out');
          dispatch(signOutSuccess());
        }
      } else {
        console.log('No token found, signing out');
        dispatch(signOutSuccess());
      }
      
      return null;
    } catch (error: any) {
      console.error('Error checking auth state:', error);
      dispatch(signOutSuccess());
      throw error;
    }
  }
);