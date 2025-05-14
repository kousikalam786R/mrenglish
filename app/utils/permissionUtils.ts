import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { setPermissionsGranted } from '../redux/slices/callSlice';
import { store } from '../redux/store';

/**
 * Requests microphone permission for audio calls
 * @returns Promise<boolean> - Whether permission was granted
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // First check if permission is already granted
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      
      if (alreadyGranted) {
        store.dispatch(setPermissionsGranted(true));
        return true;
      }
      
      // If not already granted, request it
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'The app needs access to your microphone to make audio calls.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK'
        }
      );
      
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      
      // Update the global permission state
      store.dispatch(setPermissionsGranted(isGranted));
      
      // If denied, inform the user that they can go to settings to enable
      if (!isGranted) {
        showPermissionExplanation();
      }
      
      return isGranted;
    } else {
      // On iOS, permissions are requested when getUserMedia is called
      // but we still want to update our permission state
      store.dispatch(setPermissionsGranted(true));
      return true;
    }
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

/**
 * Checks if the app has microphone permission
 * @returns Promise<boolean> - Whether permission is granted
 */
export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      
      // Update the global permission state
      store.dispatch(setPermissionsGranted(result));
      
      return result;
    } else {
      // iOS permissions are checked during getUserMedia call
      return true;
    }
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
};

/**
 * Opens app settings to allow the user to enable permissions
 */
export const openAppSettings = async () => {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error('Error opening app settings:', error);
    Alert.alert('Error', 'Could not open settings. Please manually go to your device settings and enable the microphone permission.');
  }
};

/**
 * Shows permission explanation dialog and prompts the user to go to settings
 */
export const showPermissionExplanation = () => {
  Alert.alert(
    'Microphone Permission Required',
    'To make audio calls, you need to grant microphone permission. Please go to app settings and enable the microphone permission.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: openAppSettings }
    ]
  );
};

/**
 * Request all permissions required by the app
 * @returns Promise<boolean> - Whether all critical permissions were granted
 */
export const requestAllPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // Define the permissions we need
      const permissions = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        // Add other permissions as needed:
        // PermissionsAndroid.PERMISSIONS.CAMERA,
        // PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        // etc.
      ];

      // Request all permissions at once
      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      // Check if all critical permissions were granted
      const allGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );
      
      // Update Redux store
      store.dispatch(setPermissionsGranted(allGranted));
      
      // If microphone permission specifically was denied, show explanation
      if (results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
        // Show after a short delay to avoid multiple alerts
        setTimeout(() => {
          showPermissionExplanation();
        }, 500);
      }
      
      return allGranted;
    } else {
      // On iOS, permissions will be requested when features are used
      store.dispatch(setPermissionsGranted(true));
      return true;
    }
  } catch (error) {
    console.error('Error requesting all permissions:', error);
    return false;
  }
}; 