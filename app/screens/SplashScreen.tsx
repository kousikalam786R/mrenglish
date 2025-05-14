import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { checkMicrophonePermission, requestAllPermissions } from '../utils/permissionUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationService from '../navigation/NavigationService';

const SplashScreen = () => {
  useEffect(() => {
    // Start initialization with a small delay to ensure navigation container is ready
    setTimeout(() => {
      initializeApp();
    }, 300);
  }, []);

  const initializeApp = async () => {
    try {
      // Check permissions
      await requestAllPermissions();

      // Check if user is already logged in
      const userData = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('token');

      // Wait a minimum amount of time to show splash screen
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Navigating after initialization, user data:', !!userData, !!token);
      
      // If user is logged in and has token, go to Home
      // Otherwise go to Auth (which contains SignIn)
      if (userData && token) {
        NavigationService.reset([{ name: 'Main' }]);
      } else {
        NavigationService.reset([{ name: 'Auth' }]);
      }
    } catch (error) {
      console.error('Error in app initialization:', error);
      
      // If there's an error, still navigate to Auth
      NavigationService.reset([{ name: 'Auth' }]);
    }
  };

  return (
    <View style={styles.container}>
      {/* <Image 
        source={require('../assets/images/logo.png')} 
        style={styles.logo}
        resizeMode="contain"
      /> */}
      <Text style={styles.appName}>Mr. English</Text>
      <Text style={styles.tagline}>Practice your speaking skills</Text>
      
      <ActivityIndicator 
        size="large" 
        color="#4A90E2" 
        style={styles.loader} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 30,
    textAlign: 'center',
  },
  loader: {
    marginTop: 30,
  },
});

export default SplashScreen; 