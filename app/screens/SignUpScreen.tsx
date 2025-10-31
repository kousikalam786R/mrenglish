import React, { useState } from 'react';
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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { AuthScreenNavigationProp } from '../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomInput from '../components/CustomInput';
import { saveAuthData } from '../utils/authUtils';
import { DIRECT_IP, DEV } from '../utils/config';
import { useAppDispatch } from '../redux/hooks';
import { setUserData } from '../redux/slices/userSlice';

// Server request timeout
const SERVER_TIMEOUT_MS = 30000; // 30 seconds

const SignUpScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const handleSignUp = async () => {
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    try {
      setLoading(true);
      
      // Use direct server API for manual signup
      const signupEndpoint = DEV ? `http://${DIRECT_IP}:5000/api/auth/signup` : `${DIRECT_IP}/api/auth/signup`;
      console.log('Attempting manual signup with server:', signupEndpoint);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout - server took too long to respond')), SERVER_TIMEOUT_MS);
      });
      
      // Race between the fetch and the timeout
      const response = await Promise.race([
        fetch(signupEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name,
            email,
            password
          }),
        }),
        timeoutPromise
      ]) as Response;
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Server signup successful', data);

        // Store JWT token from server response
        if (data.token) {
          try {
            // Use the auth utilities to store token
            await saveAuthData(data.token, data.user?.id);
            console.log('Authentication data stored successfully');

            if (data.user) {
              try {
                await AsyncStorage.setItem('user', JSON.stringify(data.user));
                dispatch(setUserData(data.user));
              } catch (cacheError) {
                console.error('Error caching user data:', cacheError);
              }
            }

            navigation.replace('Onboarding');
          } catch (storageError) {
            console.error('Error storing token:', storageError);
            Alert.alert('Error', 'Account created, but failed to save authentication data');
          }
        } else {
          Alert.alert('Success', 'Account created successfully! Please sign in.');
          navigation.navigate('SignIn');
        }
      } else {
        // Handle server error responses
        console.error('Server signup failed:', data.message);
        Alert.alert('Signup Failed', data.message || 'Failed to create account');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert('Error', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  // Add Google Sign-in handler
  const handleGoogleSignUp = async () => {
    // Navigate to SignIn and use its Google sign-in functionality
    navigation.navigate('SignIn');
    
    // You can also show a message explaining
    Alert.alert(
      'Google Sign Up',
      'Redirecting to sign in with Google. After signing in, your account will be created automatically.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          <View style={styles.form}>
            <CustomInput
              icon="person-outline"
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

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

            <CustomInput
              icon="lock-closed-outline"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword={true}
              showPassword={showPassword}
              toggleShowPassword={() => setShowPassword(!showPassword)}
              autoCapitalize="none"
            />

            <TouchableOpacity 
              style={styles.button}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
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
              onPress={handleGoogleSignUp}
            >
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>Sign up with Google</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.socialButton, styles.facebookButton]}>
              <Ionicons name="logo-facebook" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>Sign up with Facebook</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.socialButton, styles.phoneButton]}>
              <Ionicons name="call-outline" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>Sign up with Phone</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signinContainer}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.signinLink}>Sign In</Text>
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
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
    marginBottom: 30,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 8,
    marginBottom: 10,
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
  socialButtonText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: 'bold',
  },
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signinText: {
    color: '#666',
    fontSize: 14,
  },
  signinLink: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default SignUpScreen; 