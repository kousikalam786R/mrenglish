import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';

interface PostCallFeedbackScreenProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  callDuration?: number;
  interactionId?: string;
}

type PostCallRouteProp = RouteProp<RootStackParamList, 'PostCallFeedback'>;

const PostCallFeedbackScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PostCallRouteProp>();
  
  const { userId, userName, userAvatar, callDuration, interactionId } = route.params || {};
  
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [selectedAdvice, setSelectedAdvice] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const complimentOptions = [
    'Great speaking partner',
    'Speaks clearly',
    'Interesting person',
    'Respectful and polite',
    'Attentive listener',
    'Helps me with my English',
    'Helps me express myself',
    'Patient teacher',
    'Good pronunciation',
    'Friendly and welcoming'
  ];

  const adviceOptions = [
    'Speak more',
    'Listen more',
    'Improve the audio quality',
    'Improve the pronunciation',
    'Be kinder',
    'Find a quiet place',
    'Get a stable internet',
    'Be less intrusive',
    'Don\'t flirt',
    'Speak slower',
    'Speak louder',
    'Use simpler words',
    'Ask more questions',
    'Be more patient',
    'Focus on grammar'
  ];

  const toggleCompliment = (compliment: string) => {
    setSelectedCompliments(prev => 
      prev.includes(compliment) 
        ? prev.filter(c => c !== compliment)
        : [...prev, compliment]
    );
  };

  const toggleAdvice = (advice: string) => {
    setSelectedAdvice(prev => 
      prev.includes(advice) 
        ? prev.filter(a => a !== advice)
        : [...prev, advice]
    );
  };

  const handleSubmit = async () => {
    if (selectedCompliments.length === 0 && selectedAdvice.length === 0) {
      Alert.alert('No Feedback', 'Please select at least one compliment or advice before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      // Submit compliments
      const complimentPromises = selectedCompliments.map(compliment =>
        apiClient.post('/ratings/compliment', {
          userId,
          complimentType: compliment,
          interactionType: 'call',
          interactionId
        })
      );

      // Submit advice
      const advicePromises = selectedAdvice.map(advice =>
        apiClient.post('/ratings/advice', {
          userId,
          adviceType: advice,
          interactionType: 'call',
          interactionId
        })
      );

      await Promise.all([...complimentPromises, ...advicePromises]);

      Toast.show({
        type: 'success',
        text1: 'Feedback submitted!',
        text2: 'Thank you for your feedback'
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error submitting feedback',
        text2: 'Please try again later'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Feedback',
      'Are you sure you want to skip giving feedback?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => navigation.goBack() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Call</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userName}</Text>
          {callDuration && (
            <Text style={styles.callDuration}>
              Call duration: {Math.floor(callDuration / 60)}m {callDuration % 60}s
            </Text>
          )}
        </View>

        {/* Compliments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Give Compliments</Text>
          <Text style={styles.sectionSubtitle}>Select what you liked about this conversation</Text>
          
          <View style={styles.optionsGrid}>
            {complimentOptions.map((compliment, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionChip,
                  selectedCompliments.includes(compliment) && styles.optionChipSelected
                ]}
                onPress={() => toggleCompliment(compliment)}
              >
                <Text style={[
                  styles.optionText,
                  selectedCompliments.includes(compliment) && styles.optionTextSelected
                ]}>
                  {compliment}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Advice Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Give Advice</Text>
          <Text style={styles.sectionSubtitle}>Help them improve their conversation skills</Text>
          
          <View style={styles.optionsGrid}>
            {adviceOptions.map((advice, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionChip,
                  selectedAdvice.includes(advice) && styles.optionChipSelected
                ]}
                onPress={() => toggleAdvice(advice)}
              >
                <Text style={[
                  styles.optionText,
                  selectedAdvice.includes(advice) && styles.optionTextSelected
                ]}>
                  {advice}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.submitButton,
              (selectedCompliments.length === 0 && selectedAdvice.length === 0) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={submitting || (selectedCompliments.length === 0 && selectedAdvice.length === 0)}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  backButton: {
    fontSize: 24,
    color: '#666666',
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
    paddingHorizontal: 16,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginBottom: 24,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  callDuration: {
    fontSize: 16,
    color: '#666666',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 8,
  },
  optionChipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  optionText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 24,
    marginBottom: 32,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default PostCallFeedbackScreen;
