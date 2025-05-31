import { Platform } from 'react-native';

// Use different URLs for different environments
const DEV = true; // Set to false for production

// For actual device testing, use your computer's local network IP
// For emulator, use 10.0.2.2 (Android) or localhost (iOS)
const LOCAL_IP = '192.168.29.151'; // Your actual local network IP

// List of backup IPs to try if the main connection fails - order matters!
export const BACKUP_IPS = [
  '10.0.2.2', // Android emulator should try this first 
  'localhost',
  '127.0.0.1',
  LOCAL_IP,  // Try actual IP last since Android emulator can't connect to it
];

// Add more potential IP addresses for real devices
export const REAL_DEVICE_IPS = [
  LOCAL_IP,
  // Add potential IPs for both devices here
  // For example, if both devices are on same network:
  '192.168.29.152',
  '192.168.29.153',
];

// Helper to detect if we're on an emulator
const isEmulator = (): boolean => {
  if (Platform.OS === 'android') {
    // Check various Android emulator indicators
    const brand = Platform.constants.Brand || '';
    const manufacturer = Platform.constants.Manufacturer || '';
    const fingerprint = Platform.constants.Fingerprint || '';
    const model = Platform.constants.Model || '';
    
    return (
      brand.toLowerCase().includes('google') || 
      manufacturer.toLowerCase().includes('genymotion') || 
      fingerprint.toLowerCase().includes('generic') || 
      fingerprint.toLowerCase().includes('sdk_gphone') || 
      model.toLowerCase().includes('sdk') || 
      model.toLowerCase().includes('emulator')
    );
  } else if (Platform.OS === 'ios') {
    // On iOS, we can check if we're on a simulator
    return (Platform.isPad || Platform.isTV || Platform.constants.interfaceIdiom === 'simulator');
  }
  
  return false;
};

// Get correct base URL based on platform and environment
let BASE_HOST = '';

// Special handling for emulators vs physical devices
if (Platform.OS === 'android' && __DEV__) {
  if (isEmulator()) {
    console.log('Detected Android emulator - using 10.0.2.2 to connect to host');
    BASE_HOST = '10.0.2.2';
  } else {
    console.log('Detected Android physical device - using LOCAL_IP:', LOCAL_IP);
    BASE_HOST = LOCAL_IP;
  }
} else if (Platform.OS === 'ios' && __DEV__) {
  if (isEmulator()) {
    console.log('Detected iOS simulator - using localhost');
    BASE_HOST = 'localhost';
  } else {
    console.log('Detected iOS physical device - using LOCAL_IP:', LOCAL_IP);
    BASE_HOST = LOCAL_IP;
  }
} else {
  console.log('Using LOCAL_IP as fallback:', LOCAL_IP);
  BASE_HOST = LOCAL_IP;
}

// Base API URL without the /api suffix
export const BASE_URL = `http://${BASE_HOST}:5000`;
console.log('BASE_URL configured as:', BASE_URL);

// API URL with /api suffix
export const API_URL = `${BASE_URL}/api`;
console.log('API_URL configured as:', API_URL);

// Export the direct IP for use in other files that need it
export const DIRECT_IP = LOCAL_IP;

// Function to get alternate URLs in case of connection issues
export const getAlternateUrls = (): string[] => {
  const urls = [];

  // For physical Android devices, try all real device IPs first
  if (Platform.OS === 'android' && !isEmulator()) {
    // Try all potential real device IPs - NEVER use /api for socket connections
    REAL_DEVICE_IPS.forEach(ip => {
      // Add URLs without /api first (better for Socket.IO)
      urls.push(`http://${ip}:5000`);
      // Then add with /api as fallback for REST API
      urls.push(`http://${ip}:5000/api`);
    });
    
    // Also try without specific IP (might work on some networks)
    urls.push(`http://localhost:5000`);
    urls.push(`http://localhost:5000/api`);
  } else {
    // For emulators, use the standard backup IPs
    BACKUP_IPS.forEach(ip => {
      // Add URLs without /api first (better for Socket.IO)
      urls.push(`http://${ip}:5000`);
      // Then add with /api as fallback for REST API
      urls.push(`http://${ip}:5000/api`);
    });
  }

  return urls;
};


export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/auth/login`,
  REGISTER: `${API_URL}/auth/register`,
  MESSAGES: `${API_URL}/messages`,
  USER: `${API_URL}/auth/me`,
  UPDATE_USER: `${API_URL}/auth/profile`,
  GOOGLE_AUTH: `${API_URL}/auth/google`,
};

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