import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  StatusBar,
  Dimensions,
} from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import ImagePicker, { ImageOrVideo } from 'react-native-image-crop-picker';
import { updateProfilePicture } from '../utils/profileService';
import { useAppDispatch } from '../redux/hooks';
import { setUserData } from '../redux/slices/userSlice';

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
  profilePicFileId?: string;
  profilePicThumbnail?: string;
}

interface ProfileOptions {
  englishLevels: Array<{ value: string; label: string }>;
  nativeLanguages: string[];
  countries: string[];
  interests: string[];
  genders: string[];
}

type EditProfileRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_IMAGE_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

const EditProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<EditProfileRouteProp>();
  const { theme, isDark } = useTheme();
  const dispatch = useAppDispatch();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'englishLevel' | 'nativeLanguage' | 'country' | 'interests' | 'gender' | null>(null);
  const [tempValue, setTempValue] = useState<string | string[] | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputModalConfig, setInputModalConfig] = useState<{
    field: 'name' | 'bio' | 'age';
    title: string;
    placeholder: string;
    keyboardType?: KeyboardTypeOptions;
    multiline?: boolean;
  } | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);

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
  
  const handleSelectProfilePicture = async () => {
    if (uploadingImage) {
      return;
    }

    try {
      setUploadingImage(true);
      await cleanupSelectedImage();
      const image: ImageOrVideo = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 720,
        height: 720,
        cropperCircleOverlay: true,
        compressImageQuality: 0.8,
        forceJpg: true,
        cropperToolbarTitle: 'Adjust Profile Picture',
      });

      if (!image.path) {
        throw new Error('No image path returned from picker');
      }

      const normalizedPath = image.path.startsWith('file://')
        ? image.path
        : `file://${image.path}`;

      setSelectedImage({
        uri: normalizedPath,
        type: image.mime || 'image/jpeg',
        name:
          image.filename ||
          `profile-${Date.now()}.${(image.mime || 'image/jpeg').split('/')[1] || 'jpg'}`,
      });
      setSelectedImagePath(image.path);
      setPreviewVisible(true);
    } catch (error: any) {
      if (error?.message !== 'User cancelled image selection') {
        console.error('Error selecting profile picture:', error);
        Toast.show({
          type: 'error',
          text1: 'Could not open gallery',
          text2: error?.message || 'Please try again.',
        });
      }
    } finally {
      setUploadingImage(false);
    }
  };
  
  const cleanupSelectedImage = async () => {
    if (selectedImagePath) {
      try {
        await ImagePicker.cleanSingle(selectedImagePath);
      } catch (cleanupError) {
        console.warn('Error cleaning up image picker file:', cleanupError);
      }
    }
    setSelectedImagePath(null);
  };

  const handleCancelPreview = async () => {
    setPreviewVisible(false);
    setSelectedImage(null);
    await cleanupSelectedImage();
  };

  const handleUploadSelectedImage = async () => {
    if (!selectedImage) {
      return;
    }

    try {
      setUploadingImage(true);
      const updatedProfile = await updateProfilePicture(selectedImage);

      if (!updatedProfile?.profilePic) {
        Toast.show({
          type: 'error',
          text1: 'Upload failed',
          text2: 'We could not update your profile picture. Please try again.',
        });
        return;
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              profilePic: updatedProfile.profilePic,
              profilePicFileId: updatedProfile.profilePicFileId || undefined,
              profilePicThumbnail: updatedProfile.profilePicThumbnail || undefined,
            }
          : {
              id: updatedProfile._id || updatedProfile.id || '',
              name: updatedProfile.name || '',
              email: updatedProfile.email || '',
              bio: updatedProfile.bio,
              age: updatedProfile.age,
              gender: updatedProfile.gender,
              country: updatedProfile.country,
              nativeLanguage: updatedProfile.nativeLanguage,
              englishLevel: updatedProfile.englishLevel,
              interests: updatedProfile.interests,
              profilePic: updatedProfile.profilePic,
              profilePicFileId: updatedProfile.profilePicFileId || undefined,
              profilePicThumbnail: updatedProfile.profilePicThumbnail || undefined,
            }
      );

      dispatch(setUserData(updatedProfile));

      Toast.show({
        type: 'success',
        text1: 'Profile picture updated!',
      });
      setPreviewVisible(false);
      setSelectedImage(null);
      await cleanupSelectedImage();
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Could not update picture',
        text2: error?.message || 'Please try again later.',
      });
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const success = await updateProfileOnServer(user);
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Profile updated successfully!',
        });
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateProfileOnServer = async (updatedUser: User) => {
    try {
      const response = await apiClient.put('/profile', {
        name: updatedUser.name,
        bio: updatedUser.bio,
        age: updatedUser.age,
        gender: updatedUser.gender,
        country: updatedUser.country,
        nativeLanguage: updatedUser.nativeLanguage,
        englishLevel: updatedUser.englishLevel,
        interests: updatedUser.interests,
      });

      if (response.data.success) {
        return true;
      }

      Toast.show({
        type: 'error',
        text1: 'Error updating profile',
        text2: response.data?.message || 'Please try again later',
      });
      return false;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error updating profile',
        text2: error.response?.data?.message || 'Please try again later',
      });
      return false;
    }
  };

  const showSelectionModal = (type: 'englishLevel' | 'nativeLanguage' | 'country' | 'interests' | 'gender') => {
    setModalType(type);
    setTempValue(user?.[type] || (type === 'interests' ? [] : ''));
    setShowModal(true);
  };

  const openInputModal = (
    field: 'name' | 'bio' | 'age',
    title: string,
    placeholder: string,
    value: string,
    keyboardType?: KeyboardTypeOptions,
    multiline?: boolean
  ) => {
    setInputModalConfig({ field, title, placeholder, keyboardType, multiline });
    setInputValue(value);
    setShowInputModal(true);
  };

  const handleInputSave = async () => {
    if (!user || !inputModalConfig) return;

    const { field } = inputModalConfig;
    let updatedUserValue: string | number = inputValue;

    if (field === 'name') {
      const trimmed = inputValue.trim();
      if (!trimmed) {
        Toast.show({
          type: 'error',
          text1: 'Invalid name',
          text2: 'Name cannot be empty',
        });
        return;
      }
      updatedUserValue = trimmed;
    }

    if (field === 'bio') {
      updatedUserValue = inputValue.trim();
    }

    if (field === 'age') {
      const age = parseInt(inputValue, 10);
      if (isNaN(age) || age < 13 || age > 120) {
        Toast.show({
          type: 'error',
          text1: 'Invalid age',
          text2: 'Please enter an age between 13 and 120',
        });
        return;
      }
      updatedUserValue = age;
    }

    const updatedUser: User = {
      ...user,
      [field]: updatedUserValue,
    };

    setModalSaving(true);
    const success = await updateProfileOnServer(updatedUser);
    setModalSaving(false);

    if (success) {
      setUser(updatedUser);
      Toast.show({
        type: 'success',
        text1: 'Changes saved',
      });
      setShowInputModal(false);
      setInputModalConfig(null);
      setInputValue('');
    }
  };

  const handleInputCancel = () => {
    setShowInputModal(false);
    setInputModalConfig(null);
    setInputValue('');
  };

  const handleModalSave = async () => {
    if (!user || !modalType || tempValue === null) return;

    const updatedUser: User = { ...user };

    switch (modalType) {
      case 'englishLevel':
        updatedUser.englishLevel = tempValue as string;
        break;
      case 'nativeLanguage':
        updatedUser.nativeLanguage = tempValue as string;
        break;
      case 'country':
        updatedUser.country = tempValue as string;
        break;
      case 'gender':
        updatedUser.gender = tempValue as string;
        break;
      case 'interests':
        updatedUser.interests = Array.isArray(tempValue) ? tempValue : [];
        break;
      default:
        break;
    }

    setModalSaving(true);
    const success = await updateProfileOnServer(updatedUser);
    setModalSaving(false);

    if (success) {
      setUser(updatedUser);
      Toast.show({
        type: 'success',
        text1: 'Changes saved',
      });
      setShowModal(false);
      setModalType(null);
      setTempValue(null);
    }
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
            <TouchableOpacity onPress={handleModalSave} disabled={modalSaving}>
              {modalSaving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.modalSaveText, dynamicStyles.modalSaveText]}>Save</Text>
              )}
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

  const renderImagePreviewModal = () => (
    <Modal
      visible={previewVisible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!uploadingImage) {
          void handleCancelPreview();
        }
      }}
    >
      <SafeAreaView style={styles.previewOverlay}>
        <View style={[styles.previewContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.previewTitle, { color: theme.text }]}>Adjust profile picture</Text>
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              style={[
                styles.previewImage,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.previewImage, styles.previewPlaceholder]}>
              <Text style={[styles.previewPlaceholderText, { color: theme.textSecondary }]}>
                No image selected
              </Text>
            </View>
          )}
          <Text style={[styles.previewHint, { color: theme.textSecondary }]}>
            Make sure your face is centered. Use the crop tool to adjust before uploading.
          </Text>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.previewButton, { backgroundColor: theme.inputBackground }]}
              onPress={() => {
                if (!uploadingImage) {
                  void handleCancelPreview();
                }
              }}
              disabled={uploadingImage}
            >
              <Text style={[styles.previewButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.previewButton,
                styles.previewConfirmButton,
                { backgroundColor: theme.primary },
                uploadingImage && styles.previewButtonDisabled,
              ]}
              onPress={() => {
                if (!uploadingImage) {
                  void handleUploadSelectedImage();
                }
              }}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.previewButtonText, { color: '#FFFFFF' }]}>Use Photo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderInputModal = () => {
    if (!showInputModal || !inputModalConfig) return null;

    const dynamicStyles = {
      modalContainer: { backgroundColor: theme.background },
      modalHeader: { borderBottomColor: theme.border, backgroundColor: theme.background },
      modalTitle: { color: theme.text },
      modalCancelText: { color: theme.textSecondary },
      modalSaveText: { color: theme.primary },
      inputModalInput: { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
      placeholder: { color: theme.textSecondary },
    };

    return (
      <Modal
        visible={showInputModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, dynamicStyles.modalContainer]}>
          <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
            <TouchableOpacity onPress={handleInputCancel}>
              <Text style={[styles.modalCancelText, dynamicStyles.modalCancelText]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{inputModalConfig.title}</Text>
            <TouchableOpacity onPress={handleInputSave} disabled={modalSaving}>
              {modalSaving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.modalSaveText, dynamicStyles.modalSaveText]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputModalContent}>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={inputModalConfig.placeholder}
              placeholderTextColor={dynamicStyles.placeholder.color}
              keyboardType={inputModalConfig.keyboardType}
              multiline={inputModalConfig.multiline}
              numberOfLines={inputModalConfig.multiline ? 5 : 1}
              style={[
                styles.inputModalInput,
                inputModalConfig.multiline && styles.inputModalTextArea,
                dynamicStyles.inputModalInput,
              ]}
              autoFocus
              editable={!modalSaving}
              textAlignVertical={inputModalConfig.multiline ? 'top' : 'center'}
            />
          </View>
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
    inputModalInput: { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
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
        <TouchableOpacity
          style={[
            styles.cameraButton,
            dynamicStyles.cameraButton,
            uploadingImage && styles.cameraButtonDisabled,
          ]}
          onPress={handleSelectProfilePicture}
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Icon name="camera" size={20} color="#FFFFFF" />
          )}
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
            () => openInputModal('name', 'Edit Name', 'Enter your name', user.name)
          )}

          {renderProfileField(
            'chatbubble-outline',
            'About me',
            user.bio || '',
            () => openInputModal('bio', 'About Me', 'Tell us about yourself', user.bio || '', undefined, true),
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
            () => openInputModal('age', 'Age', 'Enter your age', user.age?.toString() || '', 'numeric')
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
      {renderImagePreviewModal()}
      {renderInputModal()}
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
  cameraButtonDisabled: {
    opacity: 0.6,
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
  inputModalContent: {
    padding: 16,
  },
  inputModalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputModalTextArea: {
    minHeight: 160,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: PREVIEW_IMAGE_SIZE,
    height: PREVIEW_IMAGE_SIZE,
    borderRadius: PREVIEW_IMAGE_SIZE / 2,
    borderWidth: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  previewPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholderText: {
    fontSize: 16,
    textAlign: 'center',
  },
  previewHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  previewConfirmButton: {
    elevation: 2,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewButtonDisabled: {
    opacity: 0.6,
  },
});

export default EditProfileScreen; 