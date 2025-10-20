import messaging from '@react-native-firebase/messaging';
import { API_URL } from './config';
import { getAuthToken } from './authUtils';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

/**
 * Notification Service
 * 
 * Handles push notifications using Firebase Cloud Messaging (FCM)
 */
class NotificationService {
  private isInitialized: boolean = false;

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('✅ iOS notification permission granted');
          return true;
        } else {
          console.log('❌ iOS notification permission denied');
          return false;
        }
      } else if (Platform.OS === 'android') {
        // Android 13+ requires POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('✅ Android notification permission granted');
            return true;
          } else {
            console.log('❌ Android notification permission denied');
            return false;
          }
        }
        
        // Android < 13 doesn't require permission
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register FCM token with backend
   */
  async registerToken(): Promise<boolean> {
    try {
      console.log('🔔 Registering FCM token...');
      
      // Request permission first
      const hasPermission = await this.requestPermission();
      
      if (!hasPermission) {
        console.log('⚠️  Notification permission denied, skipping token registration');
        return false;
      }

      // Get FCM token
      const fcmToken = await this.getToken();
      
      if (!fcmToken) {
        console.log('❌ Failed to get FCM token');
        return false;
      }

      // Send token to backend
      const authToken = await getAuthToken();
      
      if (!authToken) {
        console.log('⚠️  No auth token, skipping FCM token registration');
        return false;
      }

      const response = await fetch(`${API_URL}/notifications/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fcmToken })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ FCM token registered with backend');
        this.isInitialized = true;
        return true;
      } else {
        console.log('❌ Failed to register FCM token:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error registering FCM token:', error);
      return false;
    }
  }

  /**
   * Handle foreground notifications (app is open)
   */
  onForegroundMessage(callback: (message: any) => void) {
    return messaging().onMessage(async remoteMessage => {
      console.log('📱 Foreground notification received:', remoteMessage.notification?.title);
      callback(remoteMessage);
    });
  }

  /**
   * Handle notification tap (app opened from notification)
   */
  onNotificationOpenedApp(callback: (message: any) => void) {
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📱 App opened from notification:', remoteMessage.notification?.title);
      callback(remoteMessage);
    });
  }

  /**
   * Get initial notification (app opened from quit state by tapping notification)
   */
  async getInitialNotification(): Promise<any | null> {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      
      if (remoteMessage) {
        console.log('📱 App opened from notification (quit state):', remoteMessage.notification?.title);
        return remoteMessage;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting initial notification:', error);
      return null;
    }
  }

  /**
   * Listen for token refresh
   */
  onTokenRefresh(callback: (token: string) => void) {
    return messaging().onTokenRefresh(async token => {
      console.log('🔄 FCM token refreshed');
      callback(token);
      
      // Automatically re-register new token
      await this.registerToken();
    });
  }

  /**
   * Unregister token (call on logout)
   */
  async unregisterToken(): Promise<boolean> {
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        console.log('⚠️  No auth token for unregistering FCM token');
        return false;
      }

      const response = await fetch(`${API_URL}/notifications/token`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ FCM token unregistered from backend');
        this.isInitialized = false;
        return true;
      } else {
        console.log('❌ Failed to unregister FCM token');
        return false;
      }
    } catch (error) {
      console.error('Error unregistering FCM token:', error);
      return false;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        Alert.alert('Error', 'Please login first');
        return false;
      }

      const response = await fetch(`${API_URL}/notifications/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Test notification sent');
        Alert.alert('Success', 'Test notification sent! Check your notification tray.');
        return true;
      } else {
        console.log('❌ Failed to send test notification:', data.error);
        Alert.alert('Error', 'Failed to send test notification');
        return false;
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
      return false;
    }
  }

  /**
   * Handle notification based on type
   */
  handleNotification(message: any, navigation: any) {
    const { type, senderId, callerId, partnerId } = message.data || {};

    switch (type) {
      case 'message':
        // Navigate to chat screen
        if (senderId) {
          navigation.navigate('ChatDetail', {
            id: senderId,
            name: message.data.senderName || 'User'
          });
        }
        break;

      case 'call':
        // Show incoming call screen or navigate to call
        if (callerId) {
          Alert.alert(
            'Incoming Call',
            `${message.data.callerName || 'Someone'} is calling you`,
            [
              { text: 'Decline', style: 'cancel' },
              {
                text: 'Answer',
                onPress: () => {
                  navigation.navigate('CallScreen', {
                    id: callerId,
                    name: message.data.callerName || 'User',
                    isVideoCall: message.data.callType === 'video'
                  });
                }
              }
            ]
          );
        }
        break;

      case 'missed_call':
        // Navigate to call history or show alert
        Alert.alert(
          'Missed Call',
          `You missed a call from ${message.data.callerName || 'someone'}`
        );
        break;

      case 'partner_found':
        // Navigate to lobby or show alert
        if (partnerId) {
          Alert.alert(
            'Partner Found!',
            `${message.data.partnerName || 'Someone'} wants to talk with you`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Call Now',
                onPress: () => {
                  navigation.navigate('CallScreen', {
                    id: partnerId,
                    name: message.data.partnerName || 'User',
                    isVideoCall: false
                  });
                }
              }
            ]
          );
        }
        break;

      case 'feedback':
        // Navigate to profile or show alert
        Alert.alert(
          'New Feedback',
          message.notification?.body || 'You received new feedback'
        );
        break;

      default:
        console.log('Unknown notification type:', type);
    }
  }

  /**
   * Check if notifications are initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export default new NotificationService();

