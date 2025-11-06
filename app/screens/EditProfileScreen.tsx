import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  age?: number;
  gender?: string;
  country?: string;
  nativeLanguage?: string;
  englishLevel?: string;
  interests?: string[];
  profilePic?: string;
}

interface ProfileOptions {
  englishLevels: Array<{ value: string; label: string }>;
  nativeLanguages: string[];
  countries: string[];
  interests: string[];
  genders: string[];
}

type EditProfileRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;

const EditProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<EditProfileRouteProp>();
  const { theme, isDark } = useTheme();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'englishLevel' | 'nativeLanguage' | 'country' | 'interests' | 'gender' | null>(null);
  const [tempValue, setTempValue] = useState<string | string[] | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      // Fetch profile and options in parallel
      const [profileResponse, optionsResponse] = await Promise.all([
        apiClient.get('/profile'),
        apiClient.get('/profile/options')
      ]);

      if (profileResponse.data.success) {
        setUser(profileResponse.data.user);
      }

      if (optionsResponse.data.success) {
        setOptions(optionsResponse.data.options);
      }
    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error loading profile',
        text2: error.response?.data?.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      
      const response = await apiClient.put('/profile', {
        name: user.name,
        bio: user.bio,
        age: user.age,
        gender: user.gender,
        country: user.country,
        nativeLanguage: user.nativeLanguage,
        englishLevel: user.englishLevel,
        interests: user.interests,
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Profile updated successfully!',
        });
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error updating profile',
        text2: error.response?.data?.message || 'Please try again later'
      });
    } finally {
      setSaving(false);
    }
  };

  const showSelectionModal = (type: 'englishLevel' | 'nativeLanguage' | 'country' | 'interests' | 'gender') => {
    setModalType(type);
    setTempValue(user?.[type] || (type === 'interests' ? [] : ''));
    setShowModal(true);
  };

  const handleModalSave = () => {
    if (!user || !modalType || tempValue === null) return;

    setUser({
      ...user,
      [modalType]: tempValue
    });
    setShowModal(false);
    setModalType(null);
    setTempValue(null);
  };

  const toggleInterest = (interest: string) => {
    if (!user) return;
    
    const currentInterests = user.interests || [];
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter(i => i !== interest)
      : [...currentInterests, interest];
    
    setTempValue(newInterests);
  };

  const renderProfileField = (
    icon: string,
    label: string,
    value: string,
    onPress: () => void,
    isMultiline: boolean = false
  ) => {
    const dynamicStyles = {
      fieldContainer: { borderBottomColor: theme.divider },
      fieldIcon: { color: theme.textSecondary },
      fieldLabel: { color: theme.textSecondary },
      fieldValue: { color: theme.text },
      chevron: { color: theme.textTertiary },
    };

    return (
      <TouchableOpacity style={[styles.fieldContainer, dynamicStyles.fieldContainer]} onPress={onPress}>
        <View style={styles.fieldLeft}>
          <Icon name={icon} size={24} color={theme.textSecondary} style={styles.fieldIcon} />
          <View style={styles.fieldContent}>
            <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>{label}</Text>
            <Text style={[styles.fieldValue, dynamicStyles.fieldValue]} numberOfLines={isMultiline ? 3 : 1}>
              {value || `Add ${label.toLowerCase()}`}
            </Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color={theme.textTertiary} />
      </TouchableOpacity>
    );
  };

  const renderModal = () => {
    if (!showModal || !modalType || !options) return null;

    let data: string[] = [];
    let title = '';
    let isMultiSelect = false;

    switch (modalType) {
      case 'englishLevel':
        data = options.englishLevels.map(item => item.value);
        title = 'English Level';
        break;
      case 'nativeLanguage':
        data = options.nativeLanguages;
        title = 'Native Language';
        break;
      case 'country':
        data = options.countries;
        title = 'Location';
        break;
      case 'gender':
        data = options.genders;
        title = 'Gender';
        break;
      case 'interests':
        data = options.interests;
        title = 'Interests';
        isMultiSelect = true;
        break;
    }

    const dynamicStyles = {
      modalContainer: { backgroundColor: theme.background },
      modalHeader: { borderBottomColor: theme.border, backgroundColor: theme.background },
      modalTitle: { color: theme.text },
      modalCancelText: { color: theme.textSecondary },
      modalSaveText: { color: theme.primary },
      modalItem: { borderBottomColor: theme.divider, backgroundColor: theme.background },
      modalItemText: { color: theme.text },
    };

    return (
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, dynamicStyles.modalContainer]}>
          <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancelText, dynamicStyles.modalCancelText]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{title}</Text>
            <TouchableOpacity onPress={handleModalSave}>
              <Text style={[styles.modalSaveText, dynamicStyles.modalSaveText]}>Save</Text>
            </TouchableOpacity>
          </View>

          {isMultiSelect ? (
            <FlatList
              data={data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, dynamicStyles.modalItem]}
                  onPress={() => toggleInterest(item)}
                >
                  <Text style={[styles.modalItemText, dynamicStyles.modalItemText]}>{item}</Text>
                  <Icon
                    name={Array.isArray(tempValue) && tempValue.includes(item) ? "checkmark" : "add"}
                    size={20}
                    color={Array.isArray(tempValue) && tempValue.includes(item) ? theme.primary : theme.textTertiary}
                  />
                </TouchableOpacity>
              )}
              style={[styles.modalList, { backgroundColor: theme.surface }]}
            />
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, dynamicStyles.modalItem]}
                  onPress={() => setTempValue(item)}
                >
                  <Text style={[styles.modalItemText, dynamicStyles.modalItemText]}>{item}</Text>
                  <Icon
                    name={tempValue === item ? "checkmark" : "add"}
                    size={20}
                    color={tempValue === item ? theme.primary : theme.textTertiary}
                  />
                </TouchableOpacity>
              )}
              style={[styles.modalList, { backgroundColor: theme.surface }]}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };
  
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    loadingContainer: { backgroundColor: theme.background },
    loadingText: { color: theme.textSecondary },
    errorContainer: { backgroundColor: theme.background },
    errorText: { color: theme.text },
    retryButton: { backgroundColor: theme.primary },
    header: { borderBottomColor: theme.border, backgroundColor: theme.background },
    headerTitle: { color: theme.text },
    content: { backgroundColor: theme.surface },
    profilePicture: { borderColor: theme.border },
    cameraButton: { backgroundColor: theme.primary },
    crownIcon: { backgroundColor: theme.card, borderColor: theme.border },
    fieldsContainer: { backgroundColor: theme.surface },
    saveButton: { backgroundColor: theme.primary },
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, dynamicStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.errorContainer, dynamicStyles.errorContainer]}>
        <Text style={[styles.errorText, dynamicStyles.errorText]}>Failed to load profile data</Text>
        <TouchableOpacity style={[styles.retryButton, dynamicStyles.retryButton]} onPress={fetchProfileData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      {/* Header */}
          <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Edit profile</Text>
        <View style={styles.headerRight} />
          </View>
          
      <ScrollView style={[styles.content, dynamicStyles.content]} showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.profilePictureContainer}>
            <Image
            source={{ 
              uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }} 
            style={[styles.profilePicture, dynamicStyles.profilePicture]} 
          />
          <TouchableOpacity style={[styles.cameraButton, dynamicStyles.cameraButton]}>
            <Icon name="camera" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          <View style={[styles.crownIcon, dynamicStyles.crownIcon]}>
            <Icon name="star" size={16} color="#FFD700" />
          </View>
          </View>
          
        {/* Profile Fields */}
        <View style={[styles.fieldsContainer, dynamicStyles.fieldsContainer]}>
          {renderProfileField(
            'person-outline',
            'Name',
            user.name,
            () => {
              Alert.prompt(
                'Edit Name',
                'Enter your name',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Save', 
                    onPress: (text) => {
                      if (text && text.trim()) {
                        setUser({ ...user, name: text.trim() });
                      }
                    }
                  }
                ],
                'plain-text',
                user.name
              );
            }
          )}

          {renderProfileField(
            'chatbubble-outline',
            'About me',
            user.bio || '',
            () => {
              Alert.prompt(
                'About Me',
                'Tell us about yourself',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Save', 
                    onPress: (text) => {
                      setUser({ ...user, bio: text || '' });
                    }
                  }
                ],
                'plain-text',
                user.bio || ''
              );
            },
            true
          )}

          {renderProfileField(
            'language-outline',
            'Native language',
            user.nativeLanguage || '',
            () => showSelectionModal('nativeLanguage')
          )}

          {renderProfileField(
            'school-outline',
            'English level',
            user.englishLevel ? options?.englishLevels.find(l => l.value === user.englishLevel)?.label || user.englishLevel : '',
            () => showSelectionModal('englishLevel')
          )}

          {renderProfileField(
            'calendar-outline',
            'Age',
            user.age ? `${user.age} years old` : '',
            () => {
              Alert.prompt(
                'Age',
                'Enter your age',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Save', 
                    onPress: (text) => {
                      const age = parseInt(text || '');
                      if (!isNaN(age) && age >= 13 && age <= 120) {
                        setUser({ ...user, age });
                      } else if (text) {
                        Alert.alert('Invalid Age', 'Please enter an age between 13 and 120');
                      }
                    }
                  }
                ],
                'numeric',
                user.age?.toString() || ''
              );
            }
          )}

          {renderProfileField(
            'person-outline',
            'Gender',
            user.gender || '',
            () => showSelectionModal('gender')
          )}

          {renderProfileField(
            'location-outline',
            'Location',
            user.country || '',
            () => showSelectionModal('country')
          )}

          {renderProfileField(
            'list-outline',
            'Interests',
            user.interests?.join(', ') || '',
            () => showSelectionModal('interests'),
            true
          )}
          </View>
          
        {/* Save Button */}
          <TouchableOpacity
          style={[styles.saveButton, dynamicStyles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
          >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
          </TouchableOpacity>
        </ScrollView>

      {renderModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  profilePictureContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    position: 'relative',
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 24,
    right: '35%',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crownIcon: {
    position: 'absolute',
    top: 24,
    right: '35%',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  fieldsContainer: {
    paddingHorizontal: 16,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fieldIcon: {
    marginRight: 16,
    width: 24,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCancelText: {
    fontSize: 16,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 16,
  },
});

export default EditProfileScreen; 