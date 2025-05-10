import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { updateUserProfile, updateProfilePicture, UserProfile, getUserProfile } from '../utils/profileService';

// Define route params type
type EditProfileScreenRouteProp = RouteProp<
  { EditProfile: { userData: UserProfile } },
  'EditProfile'
>;

const EditProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<EditProfileScreenRouteProp>();
  
  // Get initial user data from route params
  const initialUserData = route.params?.userData || {};
  
  // State for form fields
  const [name, setName] = useState(initialUserData.name || '');
  const [bio, setBio] = useState(initialUserData.bio || '');
  const [country, setCountry] = useState(initialUserData.country || '');
  const [interests, setInterests] = useState(
    initialUserData.interests?.join(', ') || ''
  );
  const [profilePic, setProfilePic] = useState(
    initialUserData.profilePic || 'https://randomuser.me/api/portraits/men/32.jpg'
  );
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Handle saving profile
  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      
      // Validate form
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        setLoading(false);
        return;
      }
      
      // Parse interests from comma-separated string
      const interestsArray = interests
        .split(',')
        .map((interest) => interest.trim())
        .filter((interest) => interest.length > 0);
      
      // Create updated profile object
      const profileData: Partial<UserProfile> = {
        name,
        bio,
        country,
        interests: interestsArray,
      };
      
      // Update profile on server
      const result = await updateUserProfile(profileData);
      
      if (result) {
        const profile = await getUserProfile(); 
        if (profile && profile.success && profile.user) {
          setUserData(profile.user); // ✅ This is the missing part
        }
        Alert.alert(
          'Success',
          'Profile updated successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle profile picture update
  const handleUpdateProfilePic = () => {
    // In a real implementation, you would use a library like
    // react-native-image-picker to let users select/take photos
    Alert.alert(
      'Update Profile Picture',
      'This feature will be available in a future update.',
      [{ text: 'OK' }]
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={styles.placeholder} />
          </View>
          
          <View style={styles.profilePicContainer}>
            <Image
              source={{ uri: profilePic }}
              style={styles.profilePic}
            />
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleUpdateProfilePic}
            >
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
            
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Enter your country"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.label}>Interests (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={interests}
              onChangeText={setInterests}
              placeholder="Travel, Movies, Technology, Sports, Food"
              placeholderTextColor="#999"
            />
          </View>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveProfile}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#4A90E2',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholder: {
    width: 20,
  },
  profilePicContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  changePhotoButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 20,
    color: '#333333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen; 