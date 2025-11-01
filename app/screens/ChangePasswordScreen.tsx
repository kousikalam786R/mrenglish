import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import apiClient from '../utils/apiClient';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PasswordVisibilityState {
  current: boolean;
  next: boolean;
  confirm: boolean;
}

const ChangePasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<PasswordVisibilityState>({
    current: false,
    next: false,
    confirm: false,
  });

  const newPasswordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const toggleVisibility = useCallback((field: keyof PasswordVisibilityState) => {
    setVisibility(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const validatePasswords = useCallback(() => {
    if (!currentPassword.trim()) {
      Alert.alert('Missing password', 'Please enter your current password.');
      return false;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak password', 'New password must be at least 8 characters long.');
      return false;
    }
    if (newPassword === currentPassword) {
      Alert.alert('No change detected', 'New password must be different from the current password.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm your new password.');
      return false;
    }
    return true;
  }, [confirmPassword, currentPassword, newPassword]);

  const handleSave = useCallback(async () => {
    if (submitting) return;
    if (!validatePasswords()) return;

    try {
      setSubmitting(true);
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      Toast.show({
        type: 'success',
        text1: 'Password updated',
        text2: 'You can now sign in with your new password.',
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error updating password:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'We could not update your password. Please try again.';
      Alert.alert('Update failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [confirmPassword, currentPassword, navigation, newPassword, submitting, validatePasswords]);

  const handleForgotPassword = useCallback(() => {
    Alert.alert(
      'Need help?',
      'If you forgot your password, sign out and use the "Forgot Password" option on the sign-in screen to reset it.'
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color="#2C2C47" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!visibility.current}
              onSubmitEditing={() => newPasswordRef.current?.focus()}
              returnKeyType="next"
              toggleVisibility={() => toggleVisibility('current')}
            />

            <PasswordField
              ref={newPasswordRef}
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!visibility.next}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              returnKeyType="next"
              toggleVisibility={() => toggleVisibility('next')}
            />

            <PasswordField
              ref={confirmPasswordRef}
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!visibility.confirm}
              onSubmitEditing={handleSave}
              returnKeyType="done"
              toggleVisibility={() => toggleVisibility('confirm')}
              isLast
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordButton}
              accessibilityRole="button"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry: boolean;
  toggleVisibility: () => void;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done';
  isLast?: boolean;
};

const PasswordField = React.forwardRef<TextInput, PasswordFieldProps>(
  (
    {
      label,
      value,
      onChangeText,
      secureTextEntry,
      toggleVisibility,
      onSubmitEditing,
      returnKeyType,
      isLast,
    },
    ref,
  ) => {
    return (
      <View style={[styles.inputGroup, isLast && styles.inputGroupLast]}> 
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed" size={18} color="#6F6F89" style={styles.inputIcon} />
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            style={styles.input}
            placeholder={label}
            placeholderTextColor="#A1A4B8"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            onSubmitEditing={onSubmitEditing}
            returnKeyType={returnKeyType}
            textContentType="password"
          />
          <TouchableOpacity
            onPress={toggleVisibility}
            style={styles.visibilityButton}
            accessibilityRole="button"
            accessibilityLabel={secureTextEntry ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#4A4A62"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

PasswordField.displayName = 'PasswordField';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECF2',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3FF',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C47',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 80,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupLast: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C47',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FB',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E3E6F0',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C47',
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  visibilityButton: {
    padding: 6,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 28,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChangePasswordScreen;

