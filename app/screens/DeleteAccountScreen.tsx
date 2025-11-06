import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { signOut } from '../redux/thunks/authThunks';
import { fetchUserProfile } from '../redux/thunks/userThunks';
import apiClient from '../utils/apiClient';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DeleteAccountScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.user);
  const { theme } = useTheme();

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const passwordRef = useRef<TextInput | null>(null);

  // Fetch latest user data when screen loads to ensure we have googleId
  useFocusEffect(
    useCallback(() => {
      const loadUserData = async () => {
        try {
          setLoadingUser(true);
          await dispatch(fetchUserProfile()).unwrap();
        } catch (error) {
          console.error('Error loading user data:', error);
        } finally {
          setLoadingUser(false);
        }
      };
      loadUserData();
    }, [dispatch])
  );

  // Check if user signed in with Google (has googleId)
  // Google users don't have passwords, so they need email confirmation
  const isGoogleUser = !!user?.googleId;

  const handleDelete = useCallback(async () => {
    if (submitting) {
      return;
    }

    if (password.trim().length === 0) {
      Alert.alert('Password required', 'Please enter your password to confirm deletion.');
      passwordRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.delete('/auth/delete-account', {
        data: {
          password,
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Account deleted',
        text2: 'We removed your account and signed you out.',
      });

      await dispatch(signOut()).unwrap();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'We could not delete your account. Please try again or contact support.';
      Alert.alert('Could not delete account', message);
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  }, [dispatch, password, submitting]);

  const handleRequestEmailDeletion = useCallback(async () => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.post('/auth/request-deletion');

      if (response.data.success) {
        setEmailSent(true);
        Toast.show({
          type: 'success',
          text1: 'Email sent',
          text2: 'Please check your inbox for the deletion confirmation link.',
        });
      }
    } catch (error: any) {
      console.error('Error requesting deletion email:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'We could not send the deletion email. Please try again or contact support.';
      Alert.alert('Could not send email', message);
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const togglePasswordVisibility = useCallback(() => {
    setPasswordVisible(prev => !prev);
  }, []);

  const dynamicStyles = {
    safeArea: { backgroundColor: theme.background },
    header: { backgroundColor: theme.background, borderBottomColor: theme.border },
    headerButton: { backgroundColor: theme.primary + '15' },
    headerTitle: { color: theme.text },
    scrollView: { backgroundColor: theme.surface },
    title: { color: theme.text },
    bodyText: { color: theme.textSecondary },
    loadingText: { color: theme.textSecondary },
    warningIconWrapper: { backgroundColor: theme.error + '20' },
    inputLabel: { color: theme.text },
    inputWrapper: { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
    input: { color: theme.text },
    footer: { backgroundColor: theme.background },
    cancelButton: { borderColor: theme.border, backgroundColor: theme.background },
    cancelText: { color: theme.text },
    deleteButton: { backgroundColor: theme.error, shadowColor: theme.error },
    modalOverlay: { backgroundColor: theme.overlay },
    modalCard: { backgroundColor: theme.card },
    modalTitle: { color: theme.text },
    modalBody: { color: theme.textSecondary },
    modalIconWrapper: { backgroundColor: theme.error + '20' },
    modalCancelButton: { backgroundColor: theme.inputBackground },
    modalCancelText: { color: theme.text },
    modalDeleteButton: { backgroundColor: theme.error },
    emailInfoBox: { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' },
    emailInfoTitle: { color: theme.text },
    emailInfoText: { color: theme.textSecondary },
    emailAddressBox: { backgroundColor: theme.card, borderColor: theme.border },
    emailAddressText: { color: theme.text },
    emailSentTitle: { color: theme.text },
    emailSentText: { color: theme.textSecondary },
    emailHighlight: { color: theme.text },
    emailSentNoteBox: { backgroundColor: theme.inputBackground, borderColor: theme.border },
    emailSentNote: { color: theme.textSecondary },
    resendButton: { backgroundColor: theme.primary, shadowColor: theme.primary },
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
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={[styles.scrollView, dynamicStyles.scrollView]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={[styles.warningIconWrapper, dynamicStyles.warningIconWrapper]}>
              <Ionicons name="warning-outline" size={40} color={theme.error} />
            </View>
            <Text style={[styles.title, dynamicStyles.title]}>Delete Your Account?</Text>
            <Text style={[styles.bodyText, dynamicStyles.bodyText]}>
              All your data and progress will be permanently removed. This action cannot be undone.
            </Text>

            {loadingUser ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading account information...</Text>
              </View>
            ) : isGoogleUser ? (
              <View style={styles.emailFlowContainer}>
                {emailSent ? (
                  <View style={styles.emailSentContainer}>
                    <View style={[styles.emailSentIconWrapper, { backgroundColor: theme.primary + '20', borderColor: theme.primary + '30' }]}>
                      <Ionicons name="mail-outline" size={36} color={theme.primary} />
                    </View>
                    <Text style={[styles.emailSentTitle, dynamicStyles.emailSentTitle]}>Check Your Email</Text>
                    <Text style={[styles.emailSentText, dynamicStyles.emailSentText]}>
                      We've sent a confirmation link to{' '}
                      <Text style={[styles.emailHighlight, dynamicStyles.emailHighlight]}>{user?.email || 'your email address'}</Text>.
                      Click the link in the email to permanently delete your account.
                    </Text>
                    <View style={[styles.emailSentNoteBox, dynamicStyles.emailSentNoteBox]}>
                      <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} style={styles.noteIcon} />
                      <Text style={[styles.emailSentNote, dynamicStyles.emailSentNote]}>
                        The link will expire in 24 hours. If you didn't receive the email, check your spam folder or request a new one below.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.resendButton, dynamicStyles.resendButton, submitting && styles.disabledButton]}
                      onPress={handleRequestEmailDeletion}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={styles.resendIcon} />
                          <Text style={styles.resendButtonText}>Resend Email</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emailInfoContainer}>
                    <View style={[styles.emailInfoBox, dynamicStyles.emailInfoBox]}>
                      <View style={styles.emailInfoHeader}>
                        <Ionicons name="mail-outline" size={24} color={theme.primary} />
                        <Text style={[styles.emailInfoTitle, dynamicStyles.emailInfoTitle]}>Email Verification Required</Text>
                      </View>
                      <Text style={[styles.emailInfoText, dynamicStyles.emailInfoText]}>
                        Since you signed in with Google, we'll send a confirmation link to your email address to verify the deletion.
                      </Text>
                      {user?.email && (
                        <View style={[styles.emailAddressBox, dynamicStyles.emailAddressBox]}>
                          <Ionicons name="at-outline" size={16} color={theme.textSecondary} />
                          <Text style={[styles.emailAddressText, dynamicStyles.emailAddressText]}>{user.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, dynamicStyles.inputLabel]}>Confirm with Password</Text>
                <View style={[styles.inputWrapper, dynamicStyles.inputWrapper]}>
                  <Ionicons name="lock-closed" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.textTertiary}
                    style={[styles.input, dynamicStyles.input]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (password.trim().length > 0) {
                        setShowConfirmModal(true);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.visibilityButton}
                    onPress={togglePasswordVisibility}
                    accessibilityRole="button"
                    accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {!emailSent && (
          <View style={[styles.footer, dynamicStyles.footer]}>
            <TouchableOpacity
              style={[styles.cancelButton, dynamicStyles.cancelButton, submitting && styles.disabledButton]}
              onPress={() => navigation.goBack()}
              disabled={submitting}
            >
              <Text style={[styles.cancelText, dynamicStyles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, dynamicStyles.deleteButton, submitting && styles.disabledButton]}
              onPress={
                isGoogleUser
                  ? handleRequestEmailDeletion
                  : () => {
                      if (password.trim().length === 0) {
                        Alert.alert('Password required', 'Please enter your password to confirm deletion.');
                        passwordRef.current?.focus();
                        return;
                      }
                      setShowConfirmModal(true);
                    }
              }
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteText}>
                  {isGoogleUser ? 'Send Deletion Email' : 'Delete Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      {!isGoogleUser && (
        <Modal
          visible={showConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalCard, dynamicStyles.modalCard]}>
            <View style={[styles.modalIconWrapper, dynamicStyles.modalIconWrapper]}>
              <Ionicons name="warning-outline" size={32} color={theme.error} />
            </View>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Are you sure?</Text>
            <Text style={[styles.modalBody, dynamicStyles.modalBody]}>
              Deleting your account will remove your conversations, stats, and saved preferences. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, dynamicStyles.modalCancelButton]}
                onPress={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalCancelText, dynamicStyles.modalCancelText]}>Keep Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton, dynamicStyles.modalDeleteButton, submitting && styles.disabledButton]}
                onPress={handleDelete}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}
    </SafeAreaView>
  );
};

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  loadingContainer: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  warningIconWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
  },
  bodyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
  },
  inputGroup: {
    marginTop: 42,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  visibilityButton: {
    padding: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
  },
  cancelButton: {
    flex: 1,
    marginRight: 12,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  modalIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    marginRight: 12,
  },
  modalDeleteButton: {
    marginLeft: 12,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emailFlowContainer: {
    marginTop: 32,
    width: '100%',
  },
  emailInfoContainer: {
    width: '100%',
    marginTop: 16,
  },
  emailInfoBox: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  emailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emailInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  emailInfoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  emailAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  emailAddressText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  emailSentContainer: {
    width: '100%',
    alignItems: 'center',
  },
  emailSentIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  emailSentTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  emailSentText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emailHighlight: {
    fontWeight: '600',
  },
  emailSentNoteBox: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    width: '100%',
    borderWidth: 1,
  },
  noteIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  emailSentNote: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  resendButton: {
    flexDirection: 'row',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  resendIcon: {
    marginRight: 8,
  },
  resendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeleteAccountScreen;

