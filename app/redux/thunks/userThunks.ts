import { createAsyncThunk } from '@reduxjs/toolkit';
import { getUserProfile as fetchProfile } from '../../utils/profileService';
import { setUserData } from '../slices/userSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Thunk for fetching user profile
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, { dispatch }) => {
    try {
      const response = await fetchProfile();
      
      if (response && response.success && response.user) {
        // Store user data in AsyncStorage
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        
        // Update Redux state
        dispatch(setUserData(response.user));
        return response.user;
      } else if (response) {
        // If response exists but doesn't have expected structure
        await AsyncStorage.setItem('user', JSON.stringify(response));
        dispatch(setUserData(response));
        return response;
      }
      
      throw new Error('Failed to fetch user profile');
    } catch (error) {
      console.error('Error in fetchUserProfile thunk:', error);
      
      // Try to load from AsyncStorage as fallback
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        dispatch(setUserData(userData));
        return userData;
      }
      
      throw error;
    }
  }
);

// Thunk for updating user profile
export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async (profileData, { dispatch }) => {
    try {
      // Here you would call your API to update the profile
      // For now, we'll just update the local state and AsyncStorage
      
      // Update AsyncStorage
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        const updatedUser = { ...userData, ...profileData };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      // Update Redux state
      dispatch(setUserData(profileData));
      return profileData;
    } catch (error) {
      console.error('Error in updateUserProfile thunk:', error);
      throw error;
    }
  }
);