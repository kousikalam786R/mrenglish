import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthScreenNavigationProp } from '../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../navigation';
import CustomInput from '../components/CustomInput';
import Logo from '../components/Logo';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveAuthData } from '../utils/authUtils';
import { API_URL, API_ENDPOINTS, BASE_URL, DIRECT_IP, DEV, USING_NGROK } from '../utils/config';
import { getUserProfile } from '../utils/profileService';
import { useAppDispatch } from '../redux/hooks';
import { signInSuccess } from '../redux/slices/authSlice';
import { jwtDecode } from 'jwt-decode';
import { setUserData } from '../redux/slices/userSlice';

// Server request timeout
const SERVER_TIMEOUT_MS = 15000; // 15 seconds (reduced from 30 seconds for better UX)

const SignInScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigninInProgress, setIsSigninInProgress] = useState(false);
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const { signIn } = useAuth();
  const dispatch = useAppDispatch();

  // Test server connectivity focusing on working methods
  const testServerConnection = async () => {
    try {
      // Show testing in progress
      Alert.alert('Testing Server Connection', 'Running connection tests, please wait...');
      
      // Check network connectivity
      console.log('Checking network connectivity...');
      console.log('API_URL:', API_URL);
      
      // Test only the endpoints that are known to work
      const testUrls = USING_NGROK
        ? [
            { name: 'Ngrok Base', url: BASE_URL },
            { name: 'API Root', url: API_URL },
            { name: 'Login Endpoint', url: API_ENDPOINTS.LOGIN },
            { name: 'Google Auth', url: API_ENDPOINTS.GOOGLE_AUTH },
          ]
        : [
            { name: 'Local Base', url: DEV ? `http://${DIRECT_IP}:5000` : DIRECT_IP },
            { name: 'Test Endpoint', url: DEV ? `http://${DIRECT_IP}:5000/test` : `${DIRECT_IP}/test` },
            { name: 'API Root', url: DEV ? `http://${DIRECT_IP}:5000/api` : `${DIRECT_IP}/api` },
            { name: 'Google Auth', url: DEV ? `http://${DIRECT_IP}:5000/api/auth/google` : `${DIRECT_IP}/api/auth/google` },
          ];
      
      let results = '';
      
      // Add platform info to results
      results += `Device Platform: ${Platform.OS}\n`;
      const activeTarget = USING_NGROK ? BASE_URL : (DEV ? `http://${DIRECT_IP}:5000` : DIRECT_IP);
      const targetLabel = USING_NGROK ? 'Ngrok tunnel' : (DEV ? 'Local server' : 'Production server');
      results += `API URL configured as: ${API_URL}\n`;
      results += `Active target (${targetLabel}): ${activeTarget}\n\n`;
      
      for (const endpoint of testUrls) {
        try {
          console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(endpoint.url, {
            method: endpoint.url.includes('/auth/google') ? 'OPTIONS' : 'GET', // Use OPTIONS for auth endpoint
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
          });
          
          clearTimeout(timeoutId);
          let responseText = '';
          
          try {
            // Only try to read text for GET responses
            if (endpoint.url.includes('/auth/google')) {
              responseText = `Status: ${response.status}`;
            } else {
              responseText = await response.text();
            }
          } catch (e) {
            responseText = `Status: ${response.status}`;
          }
          
          console.log(`${endpoint.name} response:`, responseText);
          results += `✅ ${endpoint.name}: Success\n`;
        } catch (endpointError: any) {
          console.error(`${endpoint.name} test failed:`, endpointError.message);
          results += `❌ ${endpoint.name}: ${endpointError.message}\n`;
        }
      }
      
      Alert.alert('Server Connection Tests', results, [
        {
          text: 'OK',
          onPress: () => {
            // After testing connections, also try to ping google.com to verify internet
            testInternetConnection();
          }
        }
      ]);
    } catch (error: any) {
      console.error('Server connection tests failed:', error.message);
      Alert.alert('Server Error', `Tests failed: ${error.message}`);
    }
  };

  // Test basic internet connectivity
  const testInternetConnection = async () => {
    try {
      console.log('Testing internet connectivity to google.com...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.google.com', {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('Internet connection successful! Google responded with status:', response.status);
      Alert.alert('Internet Connection', 'Successfully connected to google.com. Internet is working.');
    } catch (error: any) {
      console.error('Internet connection test failed:', error.message);
      Alert.alert('Internet Connection Error', `Failed to connect to google.com: ${error.message}`);
    }
  };

  const testGoogleAuthEndpoint = async () => {
    try {
      console.log('Testing Google Auth endpoint directly...');
      
      // Create test data
      const testData = {
        idToken: 'test_token',
        userData: {
          id: 'test_id',
          email: 'test@example.com',
          name: 'Test User',
          photo: 'https://example.com/photo.jpg'
        }
      };
      
      // Create a timeout promise to abort fetch if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const googleAuthEndpointForTest = USING_NGROK
        ? API_ENDPOINTS.GOOGLE_AUTH
        : (DEV ? `http://${DIRECT_IP}:5000/api/auth/google` : `${DIRECT_IP}/api/auth/google`);
      
      // Try POST to the Google Auth endpoint
      console.log('Sending test POST to:', googleAuthEndpointForTest);
      
      try {
        const response = await fetch(googleAuthEndpointForTest, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify(testData)
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Google Auth test POST successful:', data);
          Alert.alert('Success', 'Google Auth endpoint is working!');
        } else {
          const errorText = await response.text();
          console.error('Google Auth test POST failed:', response.status, errorText);
          Alert.alert('Error', `Response status: ${response.status}\n${errorText}`);
        }
      } catch (error: any) {
        console.error('Google Auth test POST error:', error.message);
        Alert.alert('Error', `Could not connect to Google Auth endpoint: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Google Auth test error:', error.message);
      Alert.alert('Error', `Test failed: ${error.message}`);
    }
  };

  const handleSignIn = async () => {
    // Validate inputs
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    
    try {
      setIsSigninInProgress(true);
      
      const loginEndpoint = USING_NGROK
        ? API_ENDPOINTS.LOGIN
        : (DEV ? `http://${DIRECT_IP}:5000/api/auth/login` : `${DIRECT_IP}/api/auth/login`);
      console.log('Attempting login with endpoint:', loginEndpoint);
      
      // Use AbortController for more reliable timeout control
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, SERVER_TIMEOUT_MS);
      
      try {
        const response = await fetch(loginEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache' // Prevent caching
          },
          body: JSON.stringify({
            email,
            password
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
          console.error('Login failed:', errorData);
          Alert.alert('Login Failed', errorData.message || 'Invalid credentials');
          setIsSigninInProgress(false);
          return;
        }
        
        const data = await response.json();
        
        if (data.token) {
          console.log('Login successful, saving auth data...');
          
          // Store token and user ID
          await saveAuthData(data.token, data.user?.id);
          
          // Immediately cache user data to avoid profile loading delays
          if (data.user) {
            console.log('Caching user data for faster profile access');
            await AsyncStorage.setItem('user', JSON.stringify(data.user));
            
            // Update Redux state with user data
            dispatch(setUserData(data.user));
          }
          
          // Update auth state
          dispatch(signInSuccess({ 
            token: data.token, 
            userId: data.user?.id 
          }));
          
          console.log('Login complete, navigation should occur automatically');
        } else {
          throw new Error('No token received from server');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error('Login request timed out');
          Alert.alert('Connection Timeout', 'The server took too long to respond. Please try again.');
        } else {
          console.error('Login error:', fetchError.message);
          Alert.alert('Login Error', `Could not sign in: ${fetchError.message}`);
        }
        
        setIsSigninInProgress(false);
      }
    } catch (error: any) {
      console.error('Login error:', error.message);
      Alert.alert('Error', `Login failed: ${error.message}`);
      setIsSigninInProgress(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigninInProgress(true);
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Get the users ID token
      const response = await GoogleSignin.signIn();
      
      console.log('Full Google response:', JSON.stringify(response, null, 2));
      
      // Access the response based on the actual structure shown in the error log
      // The actual structure is { type: "success", data: { idToken, user, ... } }
      if (response.data) {
        const idToken = response.data.idToken;
        const user = response.data.user;
        
        // Validate user exists
        if (!user) {
          console.error('Google sign-in response missing user data:', response.data);
          throw new Error('User data not found in Google sign-in response');
        }
        
        // Create user data from the actual response structure
        const userData = {
          id: user.id || '',
          name: user.name || '',
          email: user.email || '',
          photo: user.photo || ''
        };
        
        console.log('Using idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'undefined');
        console.log('Using userData:', userData);
        
        if (!idToken) {
          throw new Error('Failed to get ID token from Google Sign In');
        }
        
        // Create a Google credential with the token
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);

        // Sign-in the user with the credential
        const firebaseUserCredential = await auth().signInWithCredential(googleCredential);
        console.log('Google sign-in successful');
        
        // Send ID token to the server
        try {
          const googleAuthEndpoint = USING_NGROK
            ? API_ENDPOINTS.GOOGLE_AUTH
            : (DEV ? `http://${DIRECT_IP}:5000/api/auth/google` : `${DIRECT_IP}/api/auth/google`);
          console.log('Attempting server connection to:', googleAuthEndpoint);
          
          // Create a timeout promise to abort fetch if it takes too long
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout - server took too long to respond')), SERVER_TIMEOUT_MS);
          });
          
          // Race between the fetch and the timeout
          const fetchResponse = await Promise.race([
            fetch(googleAuthEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                idToken,
                userData
              }),
            }),
            timeoutPromise
          ]) as Response;
          
          const data = await fetchResponse.json();
          
          if (fetchResponse.ok) {
            console.log('Server authentication successful', data);
            // Store JWT token from server response if provided
            if (data.token) {
              try {
                // Use the new auth utilities to store token
                const userId = data.userId || firebaseUserCredential.user.uid;
                await saveAuthData(data.token, userId);
                console.log('Authentication data stored successfully');
                dispatch(signInSuccess({ token: data.token, userId }));
              } catch (storageError) {
                console.error('Error storing token:', storageError);
              }
            }
          } else {
            console.error('Server authentication failed:', data.message);
            // The server authentication failed, but Firebase auth succeeded
            // Fall back to using Firebase credentials
            console.log('Falling back to Firebase authentication...');
            const firebaseToken = await firebaseUserCredential.user.getIdToken();
            const userId = firebaseUserCredential.user.uid;
            await saveAuthData(firebaseToken, userId);
            console.log('Saved Firebase credentials as fallback');
            dispatch(signInSuccess({ token: firebaseToken, userId }));
            
            Alert.alert('Warning', 'Server authentication failed, but Firebase login succeeded. Using Firebase authentication as fallback.');
          }
        } catch (serverError: any) {
          console.error('Error sending token to server:', serverError);
          console.error('Error details:', serverError.message);
          
          // Server request failed but Firebase auth succeeded
          // Fall back to using Firebase credentials
          try {
            console.log('Falling back to Firebase authentication after server error...');
            const firebaseToken = await firebaseUserCredential.user.getIdToken();
            const userId = firebaseUserCredential.user.uid;
            await saveAuthData(firebaseToken, userId);
            console.log('Saved Firebase credentials as fallback after server error');
            dispatch(signInSuccess({ token: firebaseToken, userId }));
            
            Alert.alert(
              'Warning', 
              'Server connection failed, but Firebase login succeeded. Using Firebase authentication as fallback.'
            );
          } catch (fallbackError) {
            console.error('Error in Firebase fallback:', fallbackError);
            Alert.alert(
              'Error',
              'Failed to save authentication data. Please try again.'
            );
          }
        }
      } else {
        throw new Error('Invalid Google sign-in response format');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/sign-in-cancelled') {
        console.log('User cancelled the login flow');
      } else {
        Alert.alert('Error', error.message || 'An error occurred during Google Sign-In');
      }
    } finally {
      setIsSigninInProgress(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <Logo size={300} rounded={true} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <CustomInput
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <CustomInput
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              isPassword={true}
              showPassword={showPassword}
              toggleShowPassword={() => setShowPassword(!showPassword)}
              autoCapitalize="none"
            />

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleSignIn}
              disabled={isSigninInProgress}
            >
              <Text style={styles.buttonText}>{isSigninInProgress ? 'Signing In...' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity 
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isSigninInProgress}
            >
              <Ionicons name="logo-google" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.socialButton, styles.facebookButton]}>
              <Ionicons name="logo-facebook" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.socialButton, styles.phoneButton]}>
              <Ionicons name="call-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: '#666',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    gap: 15,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  facebookButton: {
    backgroundColor: '#4267B2',
  },
  phoneButton: {
    backgroundColor: '#48A14D',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default SignInScreen; 