import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthScreenNavigationProp } from '../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const WELCOME_SHOWN_KEY = '@mrenglish_welcome_shown';

interface WelcomeSlide {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const welcomeSlides: WelcomeSlide[] = [
  {
    id: 1,
    title: 'Practice English Speaking',
    description: 'Improve your English skills through real conversations with AI-powered partners',
    icon: 'chatbubbles',
    color: '#4A90E2',
  },
  {
    id: 2,
    title: 'AI-Powered Learning',
    description: 'Get instant feedback and personalized practice sessions tailored to your level',
    icon: 'school',
    color: '#6C5CE7',
  },
  {
    id: 3,
    title: 'Practice Anytime, Anywhere',
    description: 'Connect with practice partners and improve your fluency on your schedule',
    icon: 'globe',
    color: '#25AE88',
  },
];

// Function to check if welcome has been shown
const hasWelcomeBeenShown = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(WELCOME_SHOWN_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking welcome screen status:', error);
    return false;
  }
};

const WelcomeScreen = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Check if welcome has been shown on mount
  useEffect(() => {
    const checkWelcomeStatus = async () => {
      try {
        const hasShown = await hasWelcomeBeenShown();
        if (hasShown) {
          // If already shown, navigate directly to SignIn
          navigation.replace('SignIn');
        }
      } catch (error) {
        console.error('Error checking welcome status:', error);
      }
    };
    
    checkWelcomeStatus();
  }, [navigation]);

  const handleGetStarted = async () => {
    try {
      // Mark welcome screen as shown
      await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      // Navigate to SignIn
      navigation.replace('SignIn');
    } catch (error) {
      console.error('Error saving welcome screen status:', error);
      // Navigate anyway
      navigation.replace('SignIn');
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      navigation.replace('SignIn');
    } catch (error) {
      console.error('Error saving welcome screen status:', error);
      navigation.replace('SignIn');
    }
  };

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }
  };

  const scrollToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  const renderSlide = (slide: WelcomeSlide, index: number) => {
    return (
      <View key={slide.id} style={styles.slide}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: slide.color + '20' }]}>
            <Ionicons name={slide.icon as any} size={80} color={slide.color} />
          </View>
        </View>
        
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideDescription}>{slide.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {welcomeSlides.map((slide, index) => renderSlide(slide, index))}
      </ScrollView>

      {/* Indicators */}
      <View style={styles.indicatorContainer}>
        {welcomeSlides.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.indicator,
              currentSlide === index && styles.indicatorActive,
            ]}
            onPress={() => scrollToSlide(index)}
          />
        ))}
      </View>

      {/* Get Started Button */}
      <View style={styles.buttonContainer}>
        {currentSlide === welcomeSlides.length - 1 ? (
          <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => scrollToSlide(currentSlide + 1)}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#4A90E2" style={styles.arrowIcon} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  iconContainer: {
    marginBottom: 60,
    alignItems: 'center',
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  slideDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: '#4A90E2',
  },
  buttonContainer: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    paddingTop: 20,
  },
  getStartedButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 30,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 30,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#4A90E2',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  arrowIcon: {
    marginLeft: 4,
  },
});

export default WelcomeScreen;

// Export function to check if welcome has been shown (for use in other components)
export { hasWelcomeBeenShown };
