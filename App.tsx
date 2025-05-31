/**
 * Mr English App
 */

import React, { useEffect } from 'react';
import {
  SafeAreaProvider, 
  initialWindowMetrics
} from 'react-native-safe-area-context';

import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './app/navigation/AppNavigator';
import { StyleSheet } from 'react-native';
import SocketProvider from './app/utils/SocketProvider';
import { Provider } from 'react-redux';
import { store } from './app/redux/store'; // Adjust this import path if needed
import PermissionsManager from './app/components/PermissionsManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInSuccess } from './app/redux/slices/authSlice';
import Toast from 'react-native-toast-message';
import callService from './app/utils/callService';

function App(): React.JSX.Element {
  useEffect(() => {
    // Check for stored auth credentials on app start
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        const userData = await AsyncStorage.getItem('user');
        
        // If we have valid authentication data, update Redux state
        if (token && userId) {
          store.dispatch(signInSuccess({ token, userId }));
        }
      } catch (error) {
        console.error('Error checking authentication state:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Force reset of the CallService singleton to ensure latest methods are available
  useEffect(() => {
    try {
      // Custom code to force the singleton to reset and reinitialize
      const CallServiceClass = Object.getPrototypeOf(callService).constructor;
      if (CallServiceClass && typeof CallServiceClass.resetInstance === 'function') {
        CallServiceClass.resetInstance();
        console.log('CallService has been reset and reinitialized');
      } else {
        // Fallback to normal initialization
        callService.initialize();
        console.log('CallService has been initialized without reset');
      }
    } catch (e) {
      console.error('Error handling CallService initialization:', e);
      // Fallback to direct initialization
      callService.initialize();
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <PermissionsManager>
            <SocketProvider>
              <AppNavigator />
            </SocketProvider>
          </PermissionsManager>
          <Toast />
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
