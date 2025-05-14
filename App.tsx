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

  return (
    <GestureHandlerRootView style={styles.container}>
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <PermissionsManager>
            <SocketProvider>
              <AppNavigator />
            </SocketProvider>
          </PermissionsManager>
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
