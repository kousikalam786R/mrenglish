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
import { useTheme } from '../context/ThemeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PasswordVisibilityState {
  current: boolean;
  next: boolean;
  confirm: boolean;
}

const ChangePasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
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

  const dynamicStyles = {
    safeArea: { backgroundColor: theme.background },
    header: { backgroundColor: theme.background, borderBottomColor: theme.border },
    headerButton: { backgroundColor: theme.primary + '15' },
    headerTitle: { color: theme.text },
    formCard: { backgroundColor: theme.card },
    inputLabel: { color: theme.text },
    inputWrapper: { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
    input: { color: theme.text },
    forgotPasswordText: { color: theme.primary },
    footer: { backgroundColor: theme.background },
    saveButton: { backgroundColor: theme.primary, shadowColor: theme.primary },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={[styles.safeArea, dynamicStyles.safeArea]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity
            style={[styles.headerButton, dynamicStyles.headerButton]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.surface }}
        >
          <View style={[styles.formCard, dynamicStyles.formCard]}>
            <PasswordField
              theme={theme}
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
              theme={theme}
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
              theme={theme}
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
              <Text style={[styles.forgotPasswordText, dynamicStyles.forgotPasswordText]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, dynamicStyles.footer]}>
          <TouchableOpacity
            style={[styles.saveButton, dynamicStyles.saveButton, submitting && styles.saveButtonDisabled]}
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
  theme: any;
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
      theme,
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
    const dynamicStyles = {
      inputLabel: { color: theme.text },
      inputWrapper: { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
      input: { color: theme.text },
    };

    return (
      <View style={[styles.inputGroup, isLast && styles.inputGroupLast]}> 
        <Text style={[styles.inputLabel, dynamicStyles.inputLabel]}>{label}</Text>
        <View style={[styles.inputWrapper, dynamicStyles.inputWrapper]}>
          <Ionicons name="lock-closed" size={18} color={theme.textSecondary} style={styles.inputIcon} />
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            style={[styles.input, dynamicStyles.input]}
            placeholder={label}
            placeholderTextColor={theme.textTertiary}
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
              color={theme.textSecondary}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
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
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
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
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  saveButton: {
    borderRadius: 28,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
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

