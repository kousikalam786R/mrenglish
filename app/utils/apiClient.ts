import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_URL, BASE_URL, getAlternateUrls } from './config';
import { forceLogoutOnError } from './authUtils';

// Debug function to log connection info
const logConnectionInfo = async () => {
  if (__DEV__) {
    try {
      const netInfo = await NetInfo.fetch();
      console.log('⚙️ Network Connection Info:');
      console.log(`  Connected: ${netInfo.isConnected}`);
      console.log(`  Type: ${netInfo.type}`);
      console.log(`  API Base URL: ${API_URL}`);
      console.log(`  Base URL: ${BASE_URL}`);
      
      // For WiFi connections, log details
      if (netInfo.type === 'wifi' && netInfo.details) {
        console.log(`  WiFi SSID: ${netInfo.details.ssid}`);
        console.log(`  IP Address: ${netInfo.details.ipAddress}`);
      }
      
      // Log alternate URLs for troubleshooting
      console.log('  Alternate URLs to try:');
      getAlternateUrls().slice(0, 3).forEach(url => console.log(`    - ${url}`));
    } catch (error) {
      console.error('Error logging connection info:', error);
    }
  }
};

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Increased timeout for slower connections and AI processing
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Helper to check network connectivity
const checkNetworkConnectivity = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected;
};

// Add request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Log connection info for debugging
      await logConnectionInfo();
      
      // Check network connectivity before making requests
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected) {
        return Promise.reject(new Error('No internet connection'));
      }

      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log requests in development
      if (__DEV__) {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`  Full URL: ${config.baseURL}${config.url}`);
      }
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (__DEV__) {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    // Handle network errors gracefully
    if (!error.response) {
      console.error('Network error:', error.message);
      
      // Check if it's a connectivity issue
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected) {
        return Promise.reject(new Error('No internet connection. Please check your network settings and try again.'));
      }
      
      // Log more details in development
      if (__DEV__) {
        console.error('API Error Details:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        
        // Attempt with alternate URLs for debugging
        console.log('🔄 Attempting to try alternate URLs...');
        const alternateUrls = getAlternateUrls();
        console.log(`Found ${alternateUrls.length} alternate URLs to try`);
        
        // Try the first 2 alternate URLs
        for (let i = 0; i < Math.min(alternateUrls.length, 2); i++) {
          const url = alternateUrls[i];
          if (!url.includes('/api')) continue; // Skip non-API URLs
          
          try {
            console.log(`Trying alternate URL: ${url}${error.config.url}`);
            // Make a simple test request to see if this URL works
            await axios.get(`${url}/healthcheck`, { timeout: 3000 });
            console.log(`✅ Alternate URL ${url} works! Try changing your API_URL in config.ts`);
            break;
          } catch (altError: any) {
            console.log(`❌ Alternate URL ${url} failed: ${altError.message}`);
          }
        }
        
        console.log('\n⚠️ NETWORK TROUBLESHOOTING TIPS:');
        console.log('1. Check if your server is running (cd server && npm start)');
        console.log(`2. Verify the IP address in config.ts (current: ${BASE_URL})`);
        console.log('3. Make sure your device and server are on the same network');
        console.log('4. Use the Network Debug screen in the app for more detailed diagnostics');
      }
      
      return Promise.reject(new Error('Network error. Please try again later.'));
    }
    
    // Handle critical errors that require logout
    const status = error.response?.status;
    const isCriticalError = 
      status === 401 || // Unauthorized - token expired/invalid
      status === 403 || // Forbidden - account suspended/revoked
      status >= 500;    // Server errors - server is down or having issues
    
    // Handle 401 Unauthorized errors (token expired/invalid)
    if (status === 401) {
      console.warn('🚨 Authentication token expired or invalid - logging out');
      // Don't show alert for 401 as it's handled by force logout
      await forceLogoutOnError('Authentication failed. Please sign in again.');
      return Promise.reject(new Error('Authentication failed. Please sign in again.'));
    }
    
    // Handle 403 Forbidden (account suspended/revoked)
    if (status === 403) {
      console.warn('🚨 Access forbidden - account may be suspended');
      Alert.alert(
        'Access Denied',
        'Your account access has been restricted. Please contact support.',
        [{ text: 'OK' }]
      );
      await forceLogoutOnError('Account access restricted');
      return Promise.reject(new Error('Account access restricted'));
    }
    
    // Handle server errors (500+)
    if (status >= 500) {
      console.error(`🚨 Server error ${status} - logging out for security`);
      Alert.alert(
        'Server Error',
        'The server encountered an error. You have been logged out for security. Please try again later.',
        [{ text: 'OK' }]
      );
      await forceLogoutOnError(`Server error (${status})`);
      return Promise.reject(new Error('Server error occurred'));
    }
    
    // Handle network errors that persist (not just temporary connectivity issues)
    if (!error.response) {
      // Check if this is a persistent network error (not just no internet)
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected) {
        // Just no internet - don't logout, user can retry
        return Promise.reject(new Error('No internet connection. Please check your network settings and try again.'));
      }
      
      // Network error but device is connected - could be server down
      // Only logout if it's a critical endpoint (auth-related)
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/') && !url.includes('/signin') && !url.includes('/signup');
      
      if (isAuthEndpoint) {
        console.warn('🚨 Network error on auth endpoint - logging out');
        Alert.alert(
          'Connection Error',
          'Unable to connect to server. You have been logged out. Please check your connection and sign in again.',
          [{ text: 'OK' }]
        );
        await forceLogoutOnError('Network error on authentication endpoint');
        return Promise.reject(new Error('Connection error'));
      }
    }
    
    // Log the error response for debugging
    if (__DEV__ && error.response) {
      console.error(`❌ API Error ${error.response.status}:`, {
        url: error.config?.url,
        data: error.response.data,
        method: error.config?.method
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient; 