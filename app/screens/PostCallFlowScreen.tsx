import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import apiClient from '../utils/apiClient';
import Toast from 'react-native-toast-message';

interface PostCallFlowScreenProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  callDuration?: number;
  interactionId?: string;
}

type PostCallFlowRouteProp = RouteProp<RootStackParamList, 'PostCallFlow'>;

const PostCallFlowScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PostCallFlowRouteProp>();
  
  console.log('PostCallFlowScreen route params:', route.params);
  
  const { userId, userName, userAvatar, callDuration, interactionId } = route.params || {};
  
  const [currentStep, setCurrentStep] = useState(1);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [selectedAdvice, setSelectedAdvice] = useState<string[]>([]);
  const [publicReview, setPublicReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if call duration is sufficient (more than 10 seconds for testing, should be 60 in production)
  useEffect(() => {
    console.log('PostCallFlowScreen mounted with params:', {
      userId,
      userName,
      callDuration,
      interactionId
    });
    
    // Validate userId format (must be a valid MongoDB ObjectId)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    if (!isValidObjectId) {
      console.log('Invalid userId format, going back:', userId);
      Toast.show({
        type: 'error',
        text1: 'Invalid user data',
        text2: 'Cannot submit feedback for this call'
      });
      navigation.goBack();
      return;
    }
    
    // TODO: Change back to 60 seconds for production
    if (callDuration && callDuration < 10) {
      console.log('Call duration too short, going back:', callDuration);
      // If call duration is less than threshold, skip feedback and go back
      navigation.goBack();
    }
  }, [callDuration, navigation, userId, userName, interactionId]);

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

  const handleNext = () => {
    if (currentStep === 1 && liked === null) {
      Alert.alert('Please select', 'Please let us know if you liked the talk.');
      return;
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSkip = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      console.log('Starting feedback submission...');

      const trimmedReview = publicReview.trim();

      // Submit feedback
      if (liked !== null) {
        console.log('Submitting feedback:', { userId, feedbackType: liked ? 'positive' : 'negative' });
        const feedbackResponse = await apiClient.post('/ratings/feedback', {
          userId,
          feedbackType: liked ? 'positive' : 'negative',
          interactionType: 'call',
          interactionId,
          ...(trimmedReview ? { message: trimmedReview } : {})
        });
        console.log('Feedback submitted successfully:', feedbackResponse.data);
      }

      // Submit compliments
      if (selectedCompliments.length > 0) {
        console.log('Submitting compliments:', selectedCompliments);
        const complimentPromises = selectedCompliments.map(compliment =>
          apiClient.post('/ratings/compliment', {
            userId,
            complimentType: compliment,
            interactionType: 'call',
            interactionId
          })
        );
        await Promise.all(complimentPromises);
        console.log('Compliments submitted successfully');
      }

      // Submit advice
      if (selectedAdvice.length > 0) {
        console.log('Submitting advice:', selectedAdvice);
        const advicePromises = selectedAdvice.map(advice =>
          apiClient.post('/ratings/advice', {
            userId,
            adviceType: advice,
            interactionType: 'call',
            interactionId
          })
        );
        await Promise.all(advicePromises);
        console.log('Advice submitted successfully');
      }

      // Submit public review if provided
      if (trimmedReview) {
        console.log('Submitting public review:', trimmedReview);
        const reviewResponse = await apiClient.post('/ratings/submit', {
          userId,
          rating: liked ? 5 : 2, // Convert like/dislike to rating
          comment: trimmedReview,
          interactionType: 'call',
          interactionId
        });
        console.log('Review submitted successfully:', reviewResponse.data);
      }

      Toast.show({
        type: 'success',
        text1: 'Feedback submitted!',
        text2: 'Thank you for your feedback'
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      Toast.show({
        type: 'error',
        text1: 'Error submitting feedback',
        text2: error.response?.data?.message || error.message || 'Please try again later'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.questionText}>Did you like the talk?</Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            liked === true && styles.optionCardSelected
          ]}
          onPress={() => setLiked(true)}
        >
          <Text style={styles.optionEmoji}>👍</Text>
          <Text style={[
            styles.optionText,
            liked === true && styles.optionTextSelected
          ]}>
            Yes, I do
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            liked === false && styles.optionCardSelected
          ]}
          onPress={() => setLiked(false)}
        >
          <Text style={styles.optionEmoji}>👎</Text>
          <Text style={[
            styles.optionText,
            liked === false && styles.optionTextSelected
          ]}>
            Not really
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Leave your feedback</Text>
      
      {/* Advice Section */}
      <View style={styles.feedbackSection}>
        <Text style={styles.subsectionTitle}>Advice</Text>
        <View style={styles.optionsGrid}>
          {adviceOptions.map((advice, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.feedbackChip,
                styles.adviceChip,
                selectedAdvice.includes(advice) && styles.feedbackChipSelected
              ]}
              onPress={() => toggleAdvice(advice)}
            >
              <Text style={[
                styles.feedbackChipText,
                selectedAdvice.includes(advice) && styles.feedbackChipTextSelected
              ]}>
                {advice}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Compliments Section */}
      <View style={styles.feedbackSection}>
        <Text style={styles.subsectionTitle}>Compliments</Text>
        <View style={styles.optionsGrid}>
          {complimentOptions.map((compliment, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.feedbackChip,
                styles.complimentChip,
                selectedCompliments.includes(compliment) && styles.feedbackChipSelected
              ]}
              onPress={() => toggleCompliment(compliment)}
            >
              <Text style={[
                styles.feedbackChipText,
                selectedCompliments.includes(compliment) && styles.feedbackChipTextSelected
              ]}>
                {compliment}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>Write a public review</Text>
      
      <View style={styles.reviewContainer}>
        <TextInput
          style={styles.reviewInput}
          placeholder="Share your opinion"
          placeholderTextColor="#999999"
          value={publicReview}
          onChangeText={setPublicReview}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {publicReview.length}/300
        </Text>
      </View>
      
      <Text style={styles.reviewDisclaimer}>
        Your review will be visible to your partner and all other users. 
        It will help them find their perfect match.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        
        {/* Step indicators */}
        <View style={styles.stepIndicators}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
          <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]} />
        </View>
        
        <View style={styles.headerRight} />
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Image 
          source={{ 
            uri: userAvatar || 'https://randomuser.me/api/portraits/men/32.jpg' 
          }} 
          style={styles.userAvatar} 
        />
        {/* <View style={styles.levelBadge}>
          <Text style={styles.levelText}>B1</Text>
        </View> */}
        <Text style={styles.userName}>{userName}</Text>
        {callDuration && (
          <Text style={styles.callDuration}>
            Duration {formatDuration(callDuration)}
          </Text>
        )}
      </View>

      {/* Step Content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

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
            styles.continueButton,
            submitting && styles.continueButtonDisabled
          ]}
          onPress={handleNext}
          disabled={submitting}
        >
          <Text style={styles.continueButtonText}>
            {submitting ? 'Submitting...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
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
  },
  closeButton: {
    fontSize: 24,
    color: '#666666',
  },
  stepIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  stepDotActive: {
    backgroundColor: '#9C27B0',
  },
  headerRight: {
    width: 24,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 24,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#FF8C00',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 24,
    right: '50%',
    marginRight: -30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 12,
    marginBottom: 4,
  },
  callDuration: {
    fontSize: 14,
    color: '#666666',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 120,
  },
  optionCardSelected: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  optionTextSelected: {
    color: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  feedbackSection: {
    marginBottom: 32,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedbackChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  adviceChip: {
    backgroundColor: '#F3E5F5',
    borderColor: '#9C27B0',
  },
  complimentChip: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  feedbackChipSelected: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  feedbackChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  feedbackChipTextSelected: {
    color: '#FFFFFF',
  },
  reviewContainer: {
    borderWidth: 1,
    borderColor: '#9C27B0',
    borderRadius: 12,
    marginBottom: 16,
    position: 'relative',
  },
  reviewInput: {
    padding: 16,
    fontSize: 16,
    color: '#333333',
    minHeight: 120,
    maxHeight: 200,
  },
  characterCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 12,
    color: '#666666',
  },
  reviewDisclaimer: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#9C27B0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default PostCallFlowScreen;
