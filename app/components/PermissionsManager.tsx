import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import { useDispatch } from 'react-redux';
import { setPermissionsGranted } from '../redux/slices/callSlice';
import { requestAllPermissions } from '../utils/permissionUtils';

const PermissionsManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    // Request permissions on component mount
    checkAndRequestPermissions();
  }, []);

  const checkAndRequestPermissions = async () => {
    try {
      // Only need to explicitly request on Android
      if (Platform.OS === 'android') {
        console.log('Checking and requesting all permissions at app startup...');
        
        // Request all required permissions
        await requestAllPermissions();
      } else {
        // On iOS, permissions are requested when needed
        dispatch(setPermissionsGranted(true));
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setPermissionsChecked(true);
    }
  };

  // Wait until permissions have been checked before rendering children
  if (!permissionsChecked && Platform.OS === 'android') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Setting up permissions...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});

export default PermissionsManager; 