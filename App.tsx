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
import { store } from './app/redux/store';
import PermissionsManager from './app/components/PermissionsManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInSuccess } from './app/redux/slices/authSlice';
import Toast from 'react-native-toast-message';
import notificationService from './app/utils/notificationService';
import callService from './app/utils/callService';

function App(): React.JSX.Element {
  useEffect(() => {
    // Check for stored auth credentials on app start
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        
        // If we have valid authentication data, update Redux state
        if (token && userId) {
          store.dispatch(signInSuccess({ token, userId }));
          
          // Initialize push notifications for authenticated users
          initializeNotifications();
        }
      } catch (error) {
        console.error('Error checking authentication state:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Initialize push notifications
  const initializeNotifications = async () => {
    try {
      console.log('🔔 Initializing push notifications...');
      
      // Register FCM token
      const registered = await notificationService.registerToken();
      
      if (registered) {
        console.log('✅ Push notifications initialized successfully');
      } else {
        console.log('⚠️  Failed to initialize push notifications');
      }

      // Handle foreground notifications
      const unsubscribeForeground = notificationService.onForegroundMessage((message) => {
        console.log('📱 Foreground notification received:', message.notification?.title);
        
        // You can add custom notification display logic here
        // For now, the system will show the notification
      });

      // Handle notification tap (app opened from notification)
      notificationService.onNotificationOpenedApp((message) => {
        console.log('📱 App opened from notification:', message.notification?.title);
        // Handle navigation based on notification data
        // notificationService.handleNotification(message, navigationRef.current);
      });

      // Handle token refresh
      const unsubscribeTokenRefresh = notificationService.onTokenRefresh(() => {
        console.log('🔄 FCM token refreshed, re-registering...');
        notificationService.registerToken();
      });

      // Check if app was opened from notification (quit state)
      const initialNotification = await notificationService.getInitialNotification();
      if (initialNotification) {
        console.log('📱 App opened from notification (quit state):', initialNotification.notification?.title);
        // Handle the initial notification after app loads
        setTimeout(() => {
          // notificationService.handleNotification(initialNotification, navigationRef.current);
        }, 1000);
      }

      // Cleanup function (optional, for when component unmounts)
      return () => {
        unsubscribeForeground();
        unsubscribeTokenRefresh();
      };
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  };

  // Force reset of the CallService singleton to ensure latest methods are available
  useEffect(() => {
    try {
      // Custom code to force the singleton to reset and reinitialize
      if (callService) {
        const CallServiceClass = Object.getPrototypeOf(callService).constructor;
        if (CallServiceClass && typeof CallServiceClass.resetInstance === 'function') {
          CallServiceClass.resetInstance();
          console.log('CallService has been reset and reinitialized');
        } else {
          // Fallback to normal initialization
          callService.initialize();
          console.log('CallService has been initialized without reset');
        }
      }
    } catch (e) {
      console.error('Error handling CallService initialization:', e);
      // Fallback to direct initialization
      if (callService && typeof callService.initialize === 'function') {
        callService.initialize();
      }
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
