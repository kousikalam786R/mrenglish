import { Platform } from 'react-native';

// Use different URLs for different environments
const DEV = true; // Set to false for production

// For actual device testing, use your computer's local network IP
// For emulator, use 10.0.2.2 (Android) or localhost (iOS)
const LOCAL_IP = '192.168.29.151'; // Your actual local network IP

// Get correct base URL based on platform and environment
let BASE_HOST = LOCAL_IP;

// Special handling for Android emulators - directly use 10.0.2.2
if (Platform.OS === 'android' && __DEV__) {
  try {
    // More reliable emulator detection
    const isEmulator = !!(
      Platform.constants.Brand?.includes('google') ||
      Platform.constants.Manufacturer?.includes('Genymotion') ||
      Platform.constants.Fingerprint?.startsWith('google/sdk_gphone') ||
      Platform.constants.Fingerprint?.includes('generic') ||
      Platform.constants.uiMode?.includes('emulator')
    );
    
    if (isEmulator) {
      console.log('Detected Android emulator - using 10.0.2.2 to connect to host');
      BASE_HOST = '10.0.2.2';
    } else {
      console.log('Detected Android physical device - using LOCAL_IP:', LOCAL_IP);
      BASE_HOST = LOCAL_IP;
    }
  } catch (e) {
    // Fallback detection method
    console.log('Error in emulator detection, using alternative method');
    if (Platform.constants.uiMode?.includes('emulator')) {
      console.log('Fallback detected Android emulator - using 10.0.2.2');
      BASE_HOST = '10.0.2.2';
    } else {
      console.log('Assuming physical device - using LOCAL_IP:', LOCAL_IP);
      BASE_HOST = LOCAL_IP;
    }
  }
} else if (Platform.OS === 'ios' && __DEV__) {
  if (Platform.isPad || Platform.isTV) {
    console.log('Detected iOS simulator - using localhost');
    BASE_HOST = 'localhost';
  } else {
    console.log('Detected iOS physical device - using LOCAL_IP:', LOCAL_IP);
    BASE_HOST = LOCAL_IP;
  }
} else {
  console.log('Using LOCAL_IP:', LOCAL_IP);
}

// Base API URL without the /api suffix
export const BASE_URL = `http://${BASE_HOST}:5000`;
console.log('BASE_URL configured as:', BASE_URL);

// API URL with /api suffix
export const API_URL = `${BASE_URL}/api`;
console.log('API_URL configured as:', API_URL);

// Export the direct IP for use in other files that need it
export const DIRECT_IP = LOCAL_IP;

export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/auth/login`,
  REGISTER: `${API_URL}/auth/register`,
  MESSAGES: `${API_URL}/messages`,
  USER: `${API_URL}/auth/me`,
  GOOGLE_AUTH: `${API_URL}/auth/google`,
};

// Log endpoints for debugging
console.log('GOOGLE_AUTH endpoint configured as:', API_ENDPOINTS.GOOGLE_AUTH);

// Socket events
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  NEW_MESSAGE: 'new-message',
  PRIVATE_MESSAGE: 'private-message',
  MESSAGE_SENT: 'message-sent',
  USER_TYPING: 'user-typing',
  TYPING_STOPPED: 'typing-stopped',
  USER_STATUS: 'user-status',
}; 