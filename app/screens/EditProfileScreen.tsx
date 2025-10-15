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
  ) => (
    <TouchableOpacity style={styles.fieldContainer} onPress={onPress}>
      <View style={styles.fieldLeft}>
        <Icon name={icon} size={24} color="#666666" style={styles.fieldIcon} />
        <View style={styles.fieldContent}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue} numberOfLines={isMultiline ? 3 : 1}>
            {value || `Add ${label.toLowerCase()}`}
          </Text>
        </View>
      </View>
      <Icon name="chevron-forward" size={20} color="#CCCCCC" />
    </TouchableOpacity>
  );

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

    return (
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={handleModalSave}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          {isMultiSelect ? (
            <FlatList
              data={data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => toggleInterest(item)}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  <Icon
                    name={Array.isArray(tempValue) && tempValue.includes(item) ? "checkmark" : "add"}
                    size={20}
                    color={Array.isArray(tempValue) && tempValue.includes(item) ? "#4A90E2" : "#CCCCCC"}
                  />
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => setTempValue(item)}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  <Icon
                    name={tempValue === item ? "checkmark" : "add"}
                    size={20}
                    color={tempValue === item ? "#4A90E2" : "#CCCCCC"}
                  />
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load profile data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfileData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.profilePictureContainer}>
          <Image 
            source={{ 
              uri: user.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }} 
            style={styles.profilePicture} 
          />
          <TouchableOpacity style={styles.cameraButton}>
            <Icon name="camera" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.crownIcon}>
            <Icon name="star" size={16} color="#FFD700" />
          </View>
        </View>

        {/* Profile Fields */}
        <View style={styles.fieldsContainer}>
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
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
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
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
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
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
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
    borderColor: '#E5E5E5',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 24,
    right: '35%',
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#FFFFFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
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
    borderBottomColor: '#F0F0F0',
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
    color: '#666666',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666666',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#4A90E2',
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
    borderBottomColor: '#F0F0F0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333333',
  },
});

export default EditProfileScreen;