import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  Modal,
  ActivityIndicator,
  Animated,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { signOut } from '../redux/thunks/authThunks';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/config';
import apiClient from '../utils/apiClient';


type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Language options with their display names
const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
];

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.user);
  const { theme, themeMode, isDark, setThemeMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language || 'en');
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    (user as any)?.notificationsEnabled !== false // Default to true if not set
  );
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const isMounted = useRef(true);

  // Sync language with user profile on mount
  useEffect(() => {
    const userLang = (user as any)?.preferredLanguage;
    if (userLang && userLang !== selectedLanguage) {
      setSelectedLanguage(userLang);
      changeLanguage(userLang);
    } else if (!userLang && selectedLanguage !== 'en') {
      // If no preference set, use current i18n language
      setSelectedLanguage(i18n.language || 'en');
    }
  }, [(user as any)?.preferredLanguage]);

  // Sync notificationsEnabled with user profile on mount
  useEffect(() => {
    const userNotificationsEnabled = (user as any)?.notificationsEnabled;
    if (userNotificationsEnabled !== undefined) {
      setNotificationsEnabled(userNotificationsEnabled !== false);
    }
  }, [(user as any)?.notificationsEnabled]);

  const openExternalLink = useCallback(async (url: string, fallbackMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unavailable', fallbackMessage);
      }
    } catch (error: any) {
      Alert.alert('Something went wrong', fallbackMessage);
    }
  }, []);

  const handleThemeChange = useCallback(
    async (mode: ThemeMode) => {
      await setThemeMode(mode);
      Toast.show({
        type: 'success',
        text1: 'Appearance updated',
        text2:
          mode === 'dark'
            ? 'Dark mode enabled'
            : mode === 'light'
            ? 'Light mode enabled'
            : 'Following system setting',
      });
    },
    [setThemeMode]
  );

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await dispatch(signOut()).unwrap();
      setShowLogoutModal(false);
    } catch (error) {
      console.error('Error while signing out:', error);
      Alert.alert('Sign out failed', 'Please try again.');
      if (isMounted.current) {
        setIsLoggingOut(false);
      }
    } finally {
      if (isMounted.current) {
        setIsLoggingOut(false);
      }
    }
  }, [dispatch]);

  const handleDeleteAccount = useCallback(() => {
    navigation.navigate('DeleteAccount');
  }, [navigation]);

  const handleChangePassword = useCallback(() => {
    navigation.navigate('ChangePassword');
  }, [navigation]);

  const handleLanguage = useCallback(() => {
    setShowLanguageModal(true);
  }, []);

  const handleLanguageSelect = useCallback(async (languageCode: string) => {
    if (languageCode === selectedLanguage) {
      setShowLanguageModal(false);
      return;
    }

    try {
      setIsUpdatingLanguage(true);
      
      // Change language immediately for instant UI update
      await changeLanguage(languageCode);
      setSelectedLanguage(languageCode);
      setShowLanguageModal(false);

      // Sync with backend
      try {
        await apiClient.put('/profile', {
          preferredLanguage: languageCode,
        });
      } catch (backendError: any) {
        console.error('Failed to sync language with backend:', backendError);
        // Don't show error to user as language is already changed locally
      }

      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: `${t('settings.language')} ${t('common.updated', { defaultValue: 'updated' })}`,
      });
    } catch (error: any) {
      console.error('Error changing language:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.message || 'Failed to change language',
      });
    } finally {
      if (isMounted.current) {
        setIsUpdatingLanguage(false);
      }
    }
  }, [selectedLanguage, t]);

  const handleNotifications = useCallback(async (value: boolean) => {
    if (isUpdatingNotifications) return;

    setIsUpdatingNotifications(true);
    const previousValue = notificationsEnabled;

    // Optimistically update UI
    setNotificationsEnabled(value);

    try {
      // Update notification preference on backend
      const response = await apiClient.put('/profile', {
        notificationsEnabled: value,
      });

      if (response.data && response.data.user) {
        // Update successful
        Toast.show({
          type: 'success',
          text1: t('common.success'),
          text2: value
            ? t('settings.notificationsEnabled', { defaultValue: 'Notifications enabled' })
            : t('settings.notificationsDisabled', { defaultValue: 'Notifications disabled' }),
        });
      } else {
        // Revert on error
        setNotificationsEnabled(previousValue);
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('settings.notificationUpdateError', {
            defaultValue: 'Failed to update notification settings',
          }),
        });
      }
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      // Revert on error
      setNotificationsEnabled(previousValue);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('settings.notificationUpdateError', {
          defaultValue: 'Failed to update notification settings',
        }),
      });
    } finally {
      setIsUpdatingNotifications(false);
    }
  }, [notificationsEnabled, isUpdatingNotifications, t]);

  const handleTermsOfService = useCallback(() => {
    navigation.navigate('TermsOfService');
  }, [navigation]);

  const handlePrivacyPolicy = useCallback(() => {
    navigation.navigate('PrivacyPolicy');
  }, [navigation]);

  const handleAbout = useCallback(() => {
    navigation.navigate('About');
  }, [navigation]);

  const displayName = user?.name?.trim() || 'MrEnglish User';
  const displayEmail = user?.email || 'Add your email';
  const avatarUri = user?.profilePic;

  const dynamicStyles = {
    safeArea: { backgroundColor: theme.background },
    header: { backgroundColor: theme.card, borderBottomColor: theme.border },
    headerButton: { backgroundColor: theme.primary + '15' },
    headerTitle: { color: theme.text },
    profileCard: { backgroundColor: theme.card },
    profileName: { color: theme.text },
    profileEmail: { color: theme.textSecondary },
    sectionTitle: { color: theme.text },
    card: { backgroundColor: theme.card, borderColor: theme.border },
    settingRow: { backgroundColor: theme.card, borderBottomColor: theme.divider },
    settingLabel: { color: theme.text },
    settingHelper: { color: theme.textTertiary },
    modalCard: { backgroundColor: theme.card },
    modalTitle: { color: theme.text },
    modalBody: { color: theme.textSecondary },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity
          style={[styles.headerButton, dynamicStyles.headerButton]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>{t('settings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer} 
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.surface }}
      >
        <View style={[styles.profileCard, dynamicStyles.profileCard]}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={26} color={theme.primary} />
              </View>
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, dynamicStyles.profileName]}>{displayName}</Text>
            <Text style={[styles.profileEmail, dynamicStyles.profileEmail]}>{displayEmail}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('settings.account')}</Text>
          <View style={[styles.card, dynamicStyles.card]}>
            <SettingRow
              theme={theme}
              icon="lock-closed-outline"
              label={t('settings.changePassword')}
              onPress={handleChangePassword}
            />
            <SettingRow
              theme={theme}
              icon="log-out-outline"
              label={t('settings.logout')}
              onPress={handleLogout}
              disabled={isLoggingOut}
            />
            <SettingRow
              theme={theme}
              icon="trash-outline"
              label={t('settings.deleteAccount')}
              onPress={handleDeleteAccount}
              variant="danger"
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('settings.preferences')}</Text>
          <View style={[styles.card, dynamicStyles.card]}>
            <SettingRow
              theme={theme}
              icon="moon-outline"
              label={t('settings.darkMode')}
              onPress={() => {
                // Toggle between light and dark (skip system when using toggle)
                const newMode = isDark ? 'light' : 'dark';
                handleThemeChange(newMode);
              }}
              rightComponent={
                <Switch
                  value={isDark}
                  onValueChange={(value) => {
                    const newMode = value ? 'dark' : 'light';
                    handleThemeChange(newMode);
                  }}
                  trackColor={{ false: theme.inputBackground, true: theme.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.inputBackground}
                />
              }
            />
            <SettingRow 
              theme={theme}
              icon="earth-outline" 
              label={t('settings.language')}
              onPress={handleLanguage} 
              helperText={LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.nativeName || 'English'}
            />
            <SettingRow
              theme={theme}
              icon="notifications-outline"
              label={t('settings.notifications')}
              onPress={() => handleNotifications(!notificationsEnabled)}
              rightComponent={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotifications}
                  trackColor={{ false: theme.inputBackground, true: theme.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.inputBackground}
                  disabled={isUpdatingNotifications}
                />
              }
              helperText={notificationsEnabled ? t('common.on', { defaultValue: 'On' }) : t('common.off', { defaultValue: 'Off' })}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('settings.appInformation')}</Text>
          <View style={[styles.card, dynamicStyles.card]}>
            <SettingRow
              theme={theme}
              icon="document-text-outline"
              label={t('settings.termsOfService')}
              onPress={handleTermsOfService}
            />
            <SettingRow
              theme={theme}
              icon="shield-checkmark-outline"
              label={t('settings.privacyPolicy')}
              onPress={handlePrivacyPolicy}
            />
            <SettingRow theme={theme} icon="information-circle-outline" label={t('settings.about')} onPress={handleAbout} isLast />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, dynamicStyles.modalCard]}>
            <View style={[styles.logoutModalIconWrapper, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
              <Ionicons name="log-out-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('settings.signOut')}</Text>
            <Text style={[styles.modalBody, dynamicStyles.modalBody]}>
              {t('settings.signOutConfirm')}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.inputBackground }]}
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.primary, marginLeft: 12 },
                  isLoggingOut && styles.disabledButton,
                ]}
                onPress={handleConfirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalLogoutText}>{t('settings.signOut')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, dynamicStyles.modalCard, { maxHeight: '80%' }]}>
            <View style={[styles.languageModalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{t('settings.language')}</Text>
              <TouchableOpacity
                style={styles.closeLanguageButton}
                onPress={() => setShowLanguageModal(false)}
                disabled={isUpdatingLanguage}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            >
              {LANGUAGE_OPTIONS.map((language) => {
                const isSelected = language.code === selectedLanguage;
                return (
                  <TouchableOpacity
                    key={language.code}
                    style={[
                      styles.languageOption,
                      {
                        backgroundColor: isSelected ? theme.primary + '15' : theme.inputBackground,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => handleLanguageSelect(language.code)}
                    disabled={isUpdatingLanguage}
                  >
                    <View style={styles.languageOptionContent}>
                      <View style={styles.languageInfo}>
                        <Text style={[styles.languageNativeName, { color: theme.text }]}>
                          {language.nativeName}
                        </Text>
                        <Text style={[styles.languageEnglishName, { color: theme.textSecondary }]}>
                          {language.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            {isUpdatingLanguage && (
              <View style={styles.languageLoadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.languageLoadingText, { color: theme.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

type SettingRowProps = {
  theme: any;
  icon: string;
  label: string;
  onPress: () => void;
  helperText?: string;
  rightComponent?: React.ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  isLast?: boolean;
};

const SettingRow = ({
  theme,
  icon,
  label,
  onPress,
  helperText,
  rightComponent,
  disabled,
  variant = 'default',
  isLast,
}: SettingRowProps) => {
  const iconColor = variant === 'danger' ? theme.error : theme.primary;
  const iconBg = variant === 'danger' ? theme.error + '15' : theme.primary + '15';
  
  return (
    <TouchableOpacity
      style={[
        styles.settingRow,
        { backgroundColor: theme.card, borderBottomColor: theme.divider },
        !isLast && styles.settingRowDivider,
        disabled && styles.settingRowDisabled,
      ]}
      onPress={onPress}
      activeOpacity={rightComponent ? 1 : 0.6}
      disabled={disabled && !rightComponent}
    >
      <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingTextWrapper}>
        <Text style={[styles.settingLabel, { color: variant === 'danger' ? theme.error : theme.text }]}>
          {label}
        </Text>
        {helperText ? <Text style={[styles.settingHelper, { color: theme.textTertiary }]}>{helperText}</Text> : null}
      </View>
      {rightComponent ? (
        <View style={styles.rightComponentWrapper}>{rightComponent}</View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F6F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6F0',
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
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  placeholderAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF0FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C47',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6F6F89',
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C47',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  settingRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6F0',
  },
  settingRowDisabled: {
    opacity: 0.6,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconWrapperDanger: {
    backgroundColor: '#FCEAEA',
  },
  settingTextWrapper: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C47',
  },
  settingLabelDanger: {
    color: '#B3261E',
  },
  settingHelper: {
    fontSize: 13,
    color: '#898BA4',
    marginTop: 2,
  },
  rightComponentWrapper: {
    marginLeft: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#888BA3',
    marginTop: 8,
    marginHorizontal: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  logoutModalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#D6E4FF',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C47',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 15,
    color: '#6F6F89',
  },
  languageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeLanguageButton: {
    padding: 4,
  },
  languageList: {
    maxHeight: 400,
  },
  languageOption: {
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  languageOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageNativeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  languageEnglishName: {
    fontSize: 14,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  languageLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  languageLoadingText: {
    marginLeft: 8,
    fontSize: 14,
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
    minHeight: 48,
  },
  modalCancelButton: {
    backgroundColor: '#F5F5F8',
    marginRight: 12,
  },
  modalLogoutButton: {
    backgroundColor: '#4A90E2',
    marginLeft: 12,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  modalCancelText: {
    color: '#4A4A62',
    fontSize: 16,
    fontWeight: '600',
  },
  modalLogoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  themeModeContainer: {
    flexDirection: 'row',
    padding: 8,
  },
  themeModeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'transparent',
    position: 'relative',
    marginHorizontal: 4,
  },
  themeModeOptionActive: {
    // Active state handled by border color
  },
  themeModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewContent: {
    borderRadius: 12,
    padding: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  previewTextSecondary: {
    fontSize: 12,
  },
  previewButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SettingsScreen;

