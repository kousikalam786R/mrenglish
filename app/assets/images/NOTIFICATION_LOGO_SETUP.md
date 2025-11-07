# Notification Logo Setup Guide

For push notifications to display your logo, you need to configure it on both the client and server sides.

## Client-Side Configuration (React Native)

### Android Notification Icon

1. **Create a white transparent PNG icon** (recommended size: 24x24dp base, with higher densities)
   - The icon must be **white on transparent background**
   - Android system colors the icon automatically
   - Save as: `ic_notification.png`

2. **Place in Android resource folders:**
   ```
   android/app/src/main/res/
   ├── drawable-mdpi/
   │   └── ic_notification.png (24x24px)
   ├── drawable-hdpi/
   │   └── ic_notification.png (36x36px)
   ├── drawable-xhdpi/
   │   └── ic_notification.png (48x48px)
   ├── drawable-xxhdpi/
   │   └── ic_notification.png (72x72px)
   └── drawable-xxxhdpi/
       └── ic_notification.png (96x96px)
   ```

3. **Configure in AndroidManifest.xml:**
   Add to your notification channel configuration in `AndroidManifest.xml`:
   ```xml
   <meta-data
       android:name="com.google.firebase.messaging.default_notification_icon"
       android:resource="@drawable/ic_notification" />
   ```

### iOS Notification Icon

For iOS, the notification icon uses your app icon by default. To customize:

1. The notification badge icon is part of your app icon set
2. Place notification icons in: `ios/mrenglish/Images.xcassets/AppIcon.appiconset/`
3. iOS automatically uses the appropriate app icon for notifications

## Server-Side Configuration (Backend)

When sending FCM notifications from your backend, include the logo image in the notification payload:

### Option 1: Include Logo Image URL in Notification Payload

```javascript
// Example FCM notification payload
const notificationPayload = {
  notification: {
    title: 'Notification Title',
    body: 'Notification message',
    image: 'https://your-domain.com/images/mrenglish-logo.png' // Logo URL
  },
  android: {
    notification: {
      imageUrl: 'https://your-domain.com/images/mrenglish-logo.png',
      icon: 'ic_notification', // References Android drawable
      channelId: 'default'
    }
  },
  apns: {
    payload: {
      aps: {
        alert: {
          title: 'Notification Title',
          body: 'Notification message'
        }
      }
    },
    fcm_options: {
      image: 'https://your-domain.com/images/mrenglish-logo.png'
    }
  }
};
```

### Option 2: Host Logo Image

1. **Upload your logo to a publicly accessible URL** (e.g., AWS S3, Cloud Storage, CDN)
2. **Include the URL in notification payload** as shown above
3. **Recommended sizes for notification images:**
   - Minimum: 360x180 pixels
   - Maximum: 1024x512 pixels
   - Aspect ratio: 2:1 (width:height)
   - Format: PNG or JPEG

### Example Backend Implementation (Node.js/Express)

```javascript
const admin = require('firebase-admin');

async function sendNotificationWithLogo(fcmToken, title, body) {
  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
      imageUrl: 'https://your-domain.com/images/mrenglish-logo.png'
    },
    android: {
      notification: {
        imageUrl: 'https://your-domain.com/images/mrenglish-logo.png',
        icon: 'ic_notification',
        channelId: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body
          }
        }
      },
      fcm_options: {
        image: 'https://your-domain.com/images/mrenglish-logo.png'
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}
```

## Quick Setup Steps

1. ✅ **Client-side (Already done):** Logo component created and used in app screens
2. ⚠️ **Android Icon:** Create white transparent PNG and place in Android drawable folders
3. ⚠️ **Server-side:** Update your backend notification service to include logo image URL
4. ⚠️ **Host Logo:** Upload logo to a public URL or use app assets URL if available

## Testing Notifications

1. Use the test notification feature in your app (if available)
2. Check notification tray on device
3. Verify logo appears correctly on both Android and iOS
4. Test with app in foreground, background, and closed states

## Notes

- **Android**: Small icon (drawable) appears in the notification bar
- **iOS**: App icon is used by default for notifications
- **Rich Notifications**: Large image (imageUrl) appears when notification is expanded
- **Format**: Use PNG for transparency support
- **Size**: Keep image sizes optimized for faster download






