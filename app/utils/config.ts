import { Platform } from 'react-native';

// Use different URLs for different environments  
export const DEV = true; // Set to true for local development, false for test/production server

// Optional override: point the app to an AWS server for quick testing on real devices
export const USE_NGROK = false; // Set to true for cross-network testing (WiFi + Mobile Data), false for local development
const NGROK_URL = 'http://3.110.94.208:5000'; // AWS server URL

// Production server URL (AWS)
const PRODUCTION_URL = 'http://3.110.94.208:5000';

// Metered TURN configuration (set via environment or secure storage in production)
const envTurnBaseUrl =
  typeof process !== 'undefined' && process.env?.METERED_TURN_BASE_URL
    ? process.env.METERED_TURN_BASE_URL
    : undefined;
const envTurnApiKey =
  typeof process !== 'undefined' && process.env?.METERED_TURN_API_KEY
    ? process.env.METERED_TURN_API_KEY
    : undefined;

export const METERED_TURN_BASE_URL = envTurnBaseUrl || 'https://mr_english.metered.live';
export const  METERED_TURN_API_KEY = envTurnApiKey || '';

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

const hasProtocol = (url: string): boolean => url.startsWith('http://') || url.startsWith('https://');
const stripTrailingSlash = (url: string): string => url.endsWith('/') ? url.replace(/\/+$/, '') : url;
const ensureProtocol = (url: string, fallbackProtocol: 'http://' | 'https://' = 'http://'): string => {
  if (!url) {
    return url;
  }
  return hasProtocol(url) ? url : `${fallbackProtocol}${url}`;
};

// Get correct base URL based on platform and environment
let BASE_HOST = '';

if (DEV) {
  // Development mode - use local URLs
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
} else {
  // Production mode - use deployed server
  console.log('Using production server:', PRODUCTION_URL);
  BASE_HOST = stripTrailingSlash(PRODUCTION_URL);
}

const sanitizedNgrokUrl =
  USE_NGROK && NGROK_URL
    ? stripTrailingSlash(ensureProtocol(NGROK_URL.trim(), 'http://'))
    : '';

export const USING_NGROK = Boolean(sanitizedNgrokUrl);

// Base API URL without the /api suffix
export const BASE_URL = sanitizedNgrokUrl || (DEV ? `http://${BASE_HOST}:5000` : BASE_HOST);
console.log('BASE_URL configured as:', BASE_URL);

// API URL with /api suffix - ensure no double slashes
const baseUrlClean = stripTrailingSlash(BASE_URL);
export const API_URL = stripTrailingSlash(`${baseUrlClean}/api`);
console.log('API_URL configured as:', API_URL);

// Export the direct IP for use in other files that need it
export const DIRECT_IP = DEV ? LOCAL_IP : PRODUCTION_URL;

// Function to get alternate URLs in case of connection issues
export const getAlternateUrls = (): string[] => {
  const urls = [];

  if (sanitizedNgrokUrl) {
    urls.push(sanitizedNgrokUrl);
    if (!sanitizedNgrokUrl.endsWith('/api')) {
      urls.push(`${sanitizedNgrokUrl}/api`);
    }
    return urls;
  }

  if (DEV) {
    // Development mode - use local URLs
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
  } else {
    // Production mode - use deployed server
    urls.push(PRODUCTION_URL);
    urls.push(`${PRODUCTION_URL}/api`);
  }

  return urls;
};


// Helper function to build endpoint URLs without double slashes
const buildEndpoint = (endpoint: string): string => {
  const cleanApiUrl = stripTrailingSlash(API_URL);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanApiUrl}${cleanEndpoint}`;
};

export const API_ENDPOINTS = {
  LOGIN: buildEndpoint('auth/login'),
  REGISTER: buildEndpoint('auth/register'),
  MESSAGES: buildEndpoint('messages'),
  USER: buildEndpoint('auth/me'),
  UPDATE_USER: buildEndpoint('auth/profile'),
  GOOGLE_AUTH: buildEndpoint('auth/google'),
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

// Other configuration settings
export const APP_CONFIG = {
  apiRequestTimeout: 30000, // 30 seconds
  socketReconnectionAttempts: 5,
  defaultLanguage: 'en',
  // LibreTranslate settings
  translation: {
    enabled: true,
    userLanguage: 'bn', // Bengali for this app's target users
    showTranslations: true,
    autoDetect: true,
    cacheEnabled: true,
    fallbackLanguage: 'en',
  },
}; 