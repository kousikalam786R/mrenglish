# Push Notifications Setup Guide - Frontend

## Quick Start

This guide will help you set up push notifications in your React Native app using Firebase Cloud Messaging (FCM).

---

## Prerequisites

- Firebase project created
- `google-services.json` downloaded (Android)
- `GoogleService-Info.plist` downloaded (iOS)
- React Native environment set up

---

## Step 1: Install Dependencies

```bash
cd mrenglish

# Install Firebase packages
npm install @react-native-firebase/app @react-native-firebase/messaging

# For iOS, install pods
cd ios
pod install
cd ..
```

---

## Step 2: Configure Android

### A. Add google-services.json

1. Download `google-services.json` from Firebase Console
2. Place it in `mrenglish/android/app/`

### B. Update android/build.gradle

```gradle
buildscript {
  dependencies {
    // Add this line
    classpath('com.google.gms:google-services:4.3.15')
  }
}
```

### C. Update android/app/build.gradle

```gradle
apply plugin: "com.android.application"
apply plugin: "com.google.gms.google-services" // Add this line

android {
  // ... existing config
}
```

### D. Update AndroidManifest.xml

Add these permissions in `mrenglish/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest ...>
  <!-- Add these permissions -->
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.VIBRATE" />
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
  
  <application ...>
    <!-- Add notification metadata -->
    <meta-data
      android:name="com.google.firebase.messaging.default_notification_channel_id"
      android:value="@string/default_notification_channel_id" />
      
    <!-- Notification service -->
    <service
      android:name="com.google.firebase.messaging.ReactNativeFirebaseMessagingService"
      android:exported="false">
      <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
      </intent-filter>
    </service>
  </application>
</manifest>
```

Add to `mrenglish/android/app/src/main/res/values/strings.xml`:

```xml
<resources>
  <string name="app_name">MrEnglish</string>
  <string name="default_notification_channel_id">default</string>
</resources>
```

---

## Step 3: Configure iOS

### A. Add GoogleService-Info.plist

1. Download `GoogleService-Info.plist` from Firebase Console
2. Drag it into Xcode project under `mrenglish` folder
3. Ensure "Copy items if needed" is checked

### B. Update AppDelegate.mm

Update `mrenglish/ios/mrenglish/AppDelegate.mm`:

```objective-c
#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <Firebase.h> // Add this

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure]; // Add this line
  
  self.moduleName = @"mrenglish";
  self.initialProps = @{};
  
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// ... rest of the code
@end
```

### C. Enable Push Notifications Capability

1. Open Xcode
2. Select your project
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Push Notifications"
6. Add "Background Modes"
7. Check "Remote notifications"

### D. Configure APNs

1. Go to [Apple Developer](https://developer.apple.com/)
2. Create APNs certificate
3. Upload to Firebase Console (Project Settings → Cloud Messaging → iOS app)

---

## Step 4: Create index.js Background Handler

Update `mrenglish/index.js`:

```javascript
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';

// Register background handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
```

---

## Step 5: Initialize in App.tsx

Update `mrenglish/App.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import notificationService from './app/utils/notificationService';

function App() {
  const navigationRef = useRef<any>();

  useEffect(() => {
    // Initialize notifications
    initializeNotifications();

    // Check if app was opened from notification
    checkInitialNotification();
  }, []);

  const initializeNotifications = async () => {
    // Register FCM token
    const registered = await notificationService.registerToken();
    
    if (registered) {
      console.log('✅ Notifications initialized');
    } else {
      console.log('⚠️  Notifications not initialized');
    }

    // Handle foreground notifications
    const unsubscribeForeground = notificationService.onForegroundMessage((message) => {
      console.log('Foreground notification:', message);
      
      // Show alert
      Alert.alert(
        message.notification?.title || 'New Notification',
        message.notification?.body || '',
        [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View',
            onPress: () => {
              notificationService.handleNotification(message, navigationRef.current);
            }
          }
        ]
      );
    });

    // Handle notification tap
    notificationService.onNotificationOpenedApp((message) => {
      console.log('App opened from notification');
      notificationService.handleNotification(message, navigationRef.current);
    });

    // Handle token refresh
    const unsubscribeTokenRefresh = notificationService.onTokenRefresh(() => {
      console.log('Token refreshed, re-registering...');
      notificationService.registerToken();
    });

    // Cleanup
    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  };

  const checkInitialNotification = async () => {
    const initialNotification = await notificationService.getInitialNotification();
    
    if (initialNotification) {
      console.log('App opened from notification (quit state)');
      // Wait for navigation to be ready
      setTimeout(() => {
        notificationService.handleNotification(initialNotification, navigationRef.current);
      }, 1000);
    }
  };

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Your app content */}
    </NavigationContainer>
  );
}

export default App;
```

---

## Step 6: Handle Logout

Update your logout function to unregister the FCM token:

```typescript
import notificationService from './app/utils/notificationService';

const handleLogout = async () => {
  try {
    // Unregister FCM token
    await notificationService.unregisterToken();
    
    // Clear auth token
    await AsyncStorage.removeItem('authToken');
    
    // Navigate to login
    navigation.navigate('SignIn');
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## Step 7: Test Notifications

### Test 1: Test Notification Button

Add a test button in your settings screen:

```typescript
import notificationService from '../utils/notificationService';

const SettingsScreen = () => {
  const handleTestNotification = async () => {
    await notificationService.sendTestNotification();
  };

  return (
    <View>
      <TouchableOpacity onPress={handleTestNotification}>
        <Text>Send Test Notification</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### Test 2: Via Firebase Console

1. Go to Firebase Console
2. Select your project
3. Go to "Cloud Messaging"
4. Click "Send your first message"
5. Enter title and body
6. Select your app
7. Send

### Test 3: Via Backend

```bash
# Send test notification
curl -X POST http://YOUR_SERVER/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notification Types

The app handles these notification types:

### 1. Message Notification

```json
{
  "data": {
    "type": "message",
    "senderId": "user_id",
    "senderName": "John Doe",
    "senderProfilePic": "url"
  }
}
```

### 2. Call Notification

```json
{
  "data": {
    "type": "call",
    "callType": "audio",
    "callerId": "user_id",
    "callerName": "John Doe",
    "callerProfilePic": "url"
  }
}
```

### 3. Partner Found Notification

```json
{
  "data": {
    "type": "partner_found",
    "partnerId": "user_id",
    "partnerName": "John Doe",
    "partnerProfilePic": "url"
  }
}
```

---

## Troubleshooting

### Android Issues

**Problem**: Notifications not appearing
- Check permissions are granted
- Verify `google-services.json` is in correct location
- Check notification channels are created
- Ensure app has notification permission

**Problem**: Token not registering
- Check Firebase configuration
- Verify internet connection
- Check backend API endpoint

### iOS Issues

**Problem**: Notifications not appearing
- Check APNs certificate is uploaded to Firebase
- Verify capabilities are enabled
- Check notification permissions
- Ensure app is properly signed

**Problem**: Background notifications not working
- Check "Background Modes" → "Remote notifications" is enabled
- Verify `setBackgroundMessageHandler` is registered

### General Issues

**Problem**: Notifications work in dev but not production
- Check Firebase project settings
- Verify production API keys
- Ensure proper app signing

**Problem**: Delayed notifications
- Check FCM priority is set to "high"
- Verify device battery optimization settings
- Check network connectivity

---

## Best Practices

✅ **Always request permission** before registering token
✅ **Handle token refresh** to keep tokens up to date
✅ **Unregister on logout** to stop notifications
✅ **Test on real devices** - emulators may have issues
✅ **Use different notification channels** for different types
✅ **Handle notification taps** properly
✅ **Show foreground notifications** with Alert or toast
✅ **Log events** for debugging

---

## Security

- ⚠️ Never expose Firebase service account keys
- ⚠️ Store keys in environment variables
- ⚠️ Use backend to send notifications (not from frontend)
- ⚠️ Validate notification data on backend
- ⚠️ Implement rate limiting

---

## Next Steps

After setup:

1. ✅ Test on Android device
2. ✅ Test on iOS device  
3. ⏳ Customize notification sounds
4. ⏳ Add notification badges
5. ⏳ Create notification history
6. ⏳ Add notification preferences
7. ⏳ Implement notification analytics

---

## Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase Docs](https://rnfirebase.io/)
- [Push Notification Best Practices](https://firebase.google.com/docs/cloud-messaging/concept-options)

---

You're all set! 🎉 Your app can now receive push notifications!

