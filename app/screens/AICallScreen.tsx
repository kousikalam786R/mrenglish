import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  SafeAreaView,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Tts from 'react-native-tts';
import { AICallScreenRouteProp } from '../navigation/types';
import { translationService, SUPPORTED_LANGUAGES } from '../utils/libreTranslateService';
import { APP_CONFIG } from '../utils/config';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const AICallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<AICallScreenRouteProp>();
  const { theme, isDark } = useTheme();
  
  // Logging route params for debugging
  console.log('AICallScreen.tsx received route params:', route.params);
  
  const { topic, level, id, name } = route.params;
  
  // Gradient colors based on theme
  const gradientColors = isDark 
    ? ['#1E0071', '#00BFFF'] // Dark gradient (original)
    : ['#6B46C1', '#3B82F6']; // Light gradient (lighter purple to blue)
  
  const [callDuration, setCallDuration] = useState(0);
  const [isRobotSpeaking, setIsRobotSpeaking] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showHintModal, setShowHintModal] = useState(false);
  const [currentCaption, setCurrentCaption] = useState("How was your weekend? Did you do anything interesting?");
  const [currentHint, setCurrentHint] = useState("Try describing what you did in detail using past tense verbs.");
  const [isTtsInitialized, setIsTtsInitialized] = useState(false);
  const [isTtsReady, setIsTtsReady] = useState(false);
  
  // Translation state
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(APP_CONFIG.translation.enabled);
  const [currentTranslation, setCurrentTranslation] = useState("");
  const [translationHint, setTranslationHint] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState(APP_CONFIG.translation.userLanguage);
  const [isTranslationServiceReady, setIsTranslationServiceReady] = useState(false);
  
  // Animation for the audio waveform
  const audioAnimation = useRef(new Animated.Value(0)).current;
  
  // Sample captions that RAHA might say
  const sampleCaptions = [
    "How was your weekend? Did you do anything interesting?",
    "That sounds fun! What was your favorite part of that experience?",
    "I see! Have you always been interested in that activity?",
    "What would you recommend to someone trying that for the first time?",
    "That's fascinating! Would you like to do it again sometime?",
  ];
  
  // Sample hints to help the user respond
  const sampleHints = [
    "Try describing what you did in detail using past tense verbs.",
    "You could mention how you felt during the experience.",
    "Try using descriptive adjectives to make your response more interesting.",
    "Consider mentioning who you were with and why you chose that activity.",
    "You could compare this experience to something similar you've done before.",
  ];
  
  // Translation functions
  const translateText = async (text: string, target?: string) => {
    if (!isTranslationEnabled || !text.trim()) return text;

    try {
      setIsTranslating(true);
      const result = await translationService.translateText(text, {
        source: 'auto',
        target: target || translationLanguage,
      });
      
      if (result.error) {
        console.error('Translation error:', result.error);
        return text;
      }
      
      return result.translatedText;
    } catch (error) {
      console.error('Translation failed:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  };

  const updateTranslations = async (caption: string, hint: string) => {
    if (!isTranslationEnabled) return;

    try {
      const [translatedCaption, translatedHint] = await Promise.all([
        translateText(caption),
        translateText(hint),
      ]);
      
      setCurrentTranslation(translatedCaption);
      setTranslationHint(translatedHint);
    } catch (error) {
      console.error('Failed to update translations:', error);
    }
  };

  // Initialize TTS and Translation Service
  useEffect(() => {
    const initializeServices = async () => {
      // Initialize Translation Service
      if (isTranslationEnabled) {
        try {
          console.log('Initializing translation service...');
          const translationInitialized = await translationService.initialize();
          setIsTranslationServiceReady(translationInitialized);
          
          if (translationInitialized) {
            console.log('Translation service ready');
            // Translate initial content
            await updateTranslations(currentCaption, currentHint);
          }
        } catch (error) {
          console.error('Translation service initialization failed:', error);
        }
      }
    };

    const initializeTts = async () => {
      try {
        // Set default TTS settings
        await Tts.setDefaultLanguage('en-US');
        
        // Set platform-specific voice settings
        if (Platform.OS === 'ios') {
          // iOS voices - try different voices if one fails
          try {
            await Tts.setDefaultVoice('com.apple.ttsbundle.Samantha-compact');
          } catch {
            try {
              await Tts.setDefaultVoice('com.apple.ttsbundle.Moira-compact');
            } catch {
              // Use system default
              console.log('Using system default voice');
            }
          }
        }
        
        await Tts.setDefaultRate(0.5, true); // Slightly slower for learning
        await Tts.setDefaultPitch(1.0); // Normal pitch
        
        // Add event listeners
        Tts.addEventListener('tts-start', (event) => {
          console.log('TTS started:', event);
          setIsRobotSpeaking(true);
          if (!isTtsReady) setIsTtsReady(true);
        });
        
        Tts.addEventListener('tts-finish', (event) => {
          console.log('TTS finished:', event);
          setIsRobotSpeaking(false);
        });
        
        Tts.addEventListener('tts-cancel', (event) => {
          console.log('TTS cancelled:', event);
          setIsRobotSpeaking(false);
        });
        
        Tts.addEventListener('tts-error', (event) => {
          console.error('TTS error:', event);
          setIsRobotSpeaking(false);
        });
        
        setIsTtsInitialized(true);
        
        // Speak the initial caption after a longer delay to ensure TTS is fully ready
        setTimeout(async () => {
          try {
            // Test TTS readiness first
            await Tts.speak(' '); // Speak a space character as a test
            await Tts.stop();
            
            // Now speak the actual caption
            setTimeout(() => {
              speakText(currentCaption);
            }, 500);
          } catch (error) {
            console.error('Initial TTS test failed:', error);
            // Try again with just the caption
            setTimeout(() => {
              speakText(currentCaption);
            }, 1000);
          }
        }, 2000);
        
      } catch (error) {
        console.error('TTS initialization error:', error);
        // Fall back to visual-only mode
        setIsTtsInitialized(false);
      }
    };
    
    // Initialize both services
    initializeServices();
    initializeTts();
    
    // Cleanup function
    return () => {
      Tts.removeAllListeners('tts-start');
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
      Tts.removeAllListeners('tts-error');
      Tts.stop();
    };
  }, []);
  
  // Function to speak text
  const speakText = async (text: string) => {
    if (!isTtsInitialized || isPaused || !text.trim()) return;
    
    try {
      console.log('Speaking text:', text);
      // Stop any current speech
      await Tts.stop();
      
      // Small delay to ensure stop is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start speaking the new text
      await Tts.speak(text);
    } catch (error) {
      console.error('TTS speak error:', error);
      
      // Retry once after a delay
      setTimeout(async () => {
        try {
          await Tts.speak(text);
        } catch (retryError) {
          console.error('TTS retry failed:', retryError);
        }
      }, 500);
    }
  };
  
  // Function to stop speech
  const stopSpeech = async () => {
    try {
      await Tts.stop();
    } catch (error) {
      console.error('TTS stop error:', error);
    }
  };
  
  useEffect(() => {
    // Start call duration timer
    const timer = setInterval(() => {
      if (!isPaused) {
        setCallDuration(prev => prev + 1);
      }
    }, 1000);
    
    // Simulate back and forth conversation
    const speakingInterval = setInterval(() => {
      if (!isPaused && !isRecording) {
        // If robot was not speaking, now it will speak
        if (!isRobotSpeaking) {
          const randomIndex = Math.floor(Math.random() * sampleCaptions.length);
          const newCaption = sampleCaptions[randomIndex];
          setCurrentCaption(newCaption);
          
          // Also update the hint
          const hintIndex = Math.floor(Math.random() * sampleHints.length);
          const newHint = sampleHints[hintIndex];
          setCurrentHint(newHint);
          
          // Update translations if enabled
          if (isTranslationEnabled) {
            updateTranslations(newCaption, newHint);
          }
          
          // Speak the new caption
          speakText(newCaption);
        }
        
        setIsRobotSpeaking(prev => !prev);
      }
    }, 8000);
    
    // Start audio waveform animation when robot is speaking
    if (isRobotSpeaking && !isPaused) {
      startAudioAnimation();
    } else {
      stopAudioAnimation();
    }
    
    return () => {
      clearInterval(timer);
      clearInterval(speakingInterval);
    };
  }, [isPaused, isRobotSpeaking, isRecording]);
  
  const startAudioAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(audioAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(audioAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };
  
  const stopAudioAnimation = () => {
    audioAnimation.stopAnimation();
  };
  
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatTopicTitle = (topic?: string) => {
    if (!topic) return 'Talk about anything';
    return topic.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  
  const handleEndCall = async () => {
    // Stop TTS when ending call
    await stopSpeech();
    
    Alert.alert(
      "End Call",
      "Are you sure you want to end this call?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "End Call", 
          onPress: () => navigation.goBack(),
          style: "destructive"
        }
      ]
    );
  };
  
  const togglePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (newPausedState) {
      // If pausing, stop TTS
      await stopSpeech();
    } else {
      // If resuming and robot should be speaking, resume speech
      if (isRobotSpeaking && currentCaption) {
        await speakText(currentCaption);
      }
    }
  };
  
  const toggleCaptions = () => {
    setShowCaptions(!showCaptions);
  };
  
  const toggleHint = () => {
    setShowHintModal(!showHintModal);
  };
  
  const toggleRecording = async () => {
    // If we're starting to record, make sure the robot isn't speaking
    if (!isRecording) {
      setIsRobotSpeaking(false);
      // Stop any current TTS
      await stopSpeech();
    }
    setIsRecording(!isRecording);
  };

  const toggleTranslation = () => {
    setIsTranslationEnabled(!isTranslationEnabled);
    if (!isTranslationEnabled && isTranslationServiceReady) {
      // If turning on translation, update current translations
      updateTranslations(currentCaption, currentHint);
    }
  };
  
  // Generate random heights for audio waveform bars
  const generateWaveform = () => {
    const bars = [];
    const count = 5;
    const waveformColor = isDark ? '#00FFFF' : '#60A5FA'; // Cyan for dark, light blue for light
    
    for (let i = 0; i < count; i++) {
      const animatedHeight = audioAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 30 * (Math.random() * 0.5 + 0.75)],
      });
      
      bars.push(
        <Animated.View 
          key={i} 
          style={[
            styles.waveformBar,
            { height: animatedHeight, backgroundColor: waveformColor }
          ]} 
        />
      );
    }
    
    return bars;
  };

  return (
    <LinearGradient 
      colors={gradientColors} 
      style={styles.container}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
    >
      <StatusBar barStyle={isDark ? "light-content" : "light-content"} backgroundColor="transparent" translucent />
      
      {/* SafeArea wrapper */}
      <SafeAreaView style={styles.safeArea}>
        {/* Header with topic and timer */}
        <View style={styles.header}>
          <View style={styles.timerContainer}>
            <Icon name="time-outline" size={18} color="#fff" />
            <Text style={styles.timerText}>{formatCallDuration(callDuration)}</Text>
          </View>
          <Text style={styles.topicTitle}>{formatTopicTitle(topic)}</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Icon name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Main conversation area */}
        <View style={styles.conversationContainer}>
          {/* RAHA avatar and info */}
          <View style={styles.speakerContainer}>
            <View style={[
              styles.avatarContainer,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)', borderColor: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.6)' },
              isRobotSpeaking && !isPaused ? { borderColor: isDark ? '#00FFFF' : '#60A5FA', borderWidth: 3, shadowColor: isDark ? '#00FFFF' : '#60A5FA' } : {}
            ]}>
              <Image 
                source={{ uri: 'https://img.icons8.com/color/96/000000/robot.png' }} 
                style={styles.avatarImage}
              />
            </View>
            <Text style={styles.speakerName}>RAHA</Text>
            
            {/* Audio waveform visualization when speaking */}
            {isRobotSpeaking && !isPaused && (
              <View style={styles.waveformContainer}>
                {generateWaveform()}
              </View>
            )}
          </View>
          
          {/* Center divider with or text */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.5)' }]} />
            <View style={[styles.orContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)' }]}>
              <Text style={styles.orText}>OR</Text>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.5)' }]} />
          </View>
          
          {/* User avatar and info */}
          <View style={styles.speakerContainer}>
            <View style={[
              styles.avatarContainer,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)', borderColor: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.6)' },
              !isRobotSpeaking && !isPaused ? { borderColor: isDark ? '#00FFFF' : '#60A5FA', borderWidth: 3, shadowColor: isDark ? '#00FFFF' : '#60A5FA' } : {},
              isRecording ? { borderColor: '#FF4500', shadowColor: '#FF4500' } : {}
            ]}>
              <Image 
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                style={styles.avatarImage}
              />
              
              {/* Recording indicator */}
              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <Icon name="mic" size={18} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.speakerName}>YOU</Text>
            
            {/* Recording button */}
            <TouchableOpacity 
              style={[
                styles.recordButton,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)' },
                isRecording ? { backgroundColor: '#FF4500' } : {}
              ]} 
              onPress={toggleRecording}
            >
              <Icon 
                name={isRecording ? "stop-circle" : "mic"} 
                size={28} 
                color="#fff" 
              />
              <Text style={styles.recordButtonText}>
                {isRecording ? "STOP" : "TAP TO SPEAK"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Captions area */}
        {showCaptions && isRobotSpeaking && (
          <View style={[styles.captionContainer, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }]}>
            <View style={styles.captionHeader}>
              <View style={styles.captionTitleContainer}>
                <Icon name="chatbubble-ellipses-outline" size={18} color={theme.warning} />
                <Text style={[styles.captionTitle, { color: theme.warning }]}>RAHA said:</Text>
              </View>
              <View style={styles.captionControls}>
                {isTranslationServiceReady && (
                  <TouchableOpacity onPress={toggleTranslation} style={styles.translationToggle}>
                    <Icon 
                      name="language" 
                      size={18} 
                      color={isTranslationEnabled ? theme.warning : theme.textTertiary} 
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleCaptions}>
                  <Icon name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.captionText}>{currentCaption}</Text>
            
            {/* Translation */}
            {isTranslationEnabled && currentTranslation && (
              <View style={styles.translationContainer}>
                <View style={styles.translationHeader}>
                  <Icon name="language" size={14} color={theme.success} />
                  <Text style={[styles.translationLabel, { color: theme.success }]}>
                    {translationService.getLanguageName(translationLanguage)}:
                  </Text>
                  {isTranslating && (
                    <Icon name="refresh" size={14} color={theme.success} />
                  )}
                </View>
                <Text style={[styles.translationText, { color: theme.textSecondary }]}>{currentTranslation}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Hint modal */}
        {showHintModal && (
          <View style={[styles.hintContainer, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }]}>
            <View style={styles.hintHeader}>
              <View style={styles.hintTitleContainer}>
                <Icon name="bulb-outline" size={18} color={theme.warning} />
                <Text style={[styles.hintTitle, { color: theme.warning }]}>HINT:</Text>
              </View>
              <View style={styles.captionControls}>
                {isTranslationServiceReady && (
                  <TouchableOpacity onPress={toggleTranslation} style={styles.translationToggle}>
                    <Icon 
                      name="language" 
                      size={18} 
                      color={isTranslationEnabled ? theme.warning : theme.textTertiary} 
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleHint}>
                  <Icon name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.hintText}>{currentHint}</Text>
            
            {/* Hint Translation */}
            {isTranslationEnabled && translationHint && (
              <View style={styles.translationContainer}>
                <View style={styles.translationHeader}>
                  <Icon name="language" size={14} color={theme.success} />
                  <Text style={[styles.translationLabel, { color: theme.success }]}>
                    {translationService.getLanguageName(translationLanguage)}:
                  </Text>
                  {isTranslating && (
                    <Icon name="refresh" size={14} color={theme.success} />
                  )}
                </View>
                <Text style={[styles.translationText, { color: theme.textSecondary }]}>{translationHint}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* TTS Status Indicator */}
        {!isTtsInitialized ? (
          <View style={styles.ttsStatusContainer}>
            <Icon name="warning-outline" size={16} color="#FFC107" />
            <Text style={styles.ttsStatusText}>Voice disabled - Visual mode only</Text>
          </View>
        ) : !isTtsReady ? (
          <View style={[styles.ttsStatusContainer, {backgroundColor: 'rgba(0, 191, 255, 0.2)', borderColor: 'rgba(0, 191, 255, 0.5)'}]}>
            <Icon name="time-outline" size={16} color="#00BFFF" />
            <Text style={[styles.ttsStatusText, {color: '#00BFFF'}]}>Voice loading...</Text>
          </View>
        ) : null}
        
        {/* Translation Status Indicator */}
        {isTranslationEnabled && !isTranslationServiceReady ? (
          <View style={[styles.ttsStatusContainer, {backgroundColor: 'rgba(255, 193, 7, 0.2)', borderColor: 'rgba(255, 193, 7, 0.5)'}]}>
            <Icon name="language" size={16} color="#FFC107" />
            <Text style={[styles.ttsStatusText, {color: '#FFC107'}]}>Translation loading...</Text>
          </View>
        ) : isTranslationEnabled && isTranslationServiceReady ? (
          <View style={[styles.ttsStatusContainer, {backgroundColor: 'rgba(76, 175, 80, 0.2)', borderColor: 'rgba(76, 175, 80, 0.5)'}]}>
            <Icon name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={[styles.ttsStatusText, {color: '#4CAF50'}]}>
              Translation ready ({translationService.getLanguageName(translationLanguage)})
            </Text>
          </View>
        ) : null}
        
        {/* Bottom control bar */}
        <View style={[styles.controlBar, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)' }]}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleHint}>
            <Icon name="bulb-outline" size={22} color="#fff" />
            <Text style={styles.controlText}>Hint</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={toggleCaptions}>
            <Icon name="chatbubble-ellipses-outline" size={22} color="#fff" />
            <Text style={styles.controlText}>Caption</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={() => isTtsInitialized ? speakText(currentCaption) : null}
          >
            <Icon name="volume-high-outline" size={22} color={isTtsInitialized ? "#fff" : theme.textTertiary} />
            <Text style={[styles.controlText, {color: isTtsInitialized ? "#fff" : theme.textTertiary}]}>Speak</Text>
          </TouchableOpacity>
          
          {isTranslationServiceReady && (
            <TouchableOpacity style={styles.controlButton} onPress={toggleTranslation}>
              <Icon 
                name="language" 
                size={22} 
                color={isTranslationEnabled ? theme.success : theme.textTertiary} 
              />
              <Text style={[styles.controlText, {color: isTranslationEnabled ? theme.success : theme.textTertiary}]}>
                Translate
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.controlButton} onPress={togglePause}>
            <Icon name={isPaused ? "play" : "pause"} size={22} color="#fff" />
            <Text style={styles.controlText}>{isPaused ? "Resume" : "Pause"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={handleEndCall}>
            <View style={styles.endCallButton}>
              <Icon name="call" size={22} color="#fff" />
            </View>
            <Text style={styles.controlText}>End</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  conversationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  speakerContainer: {
    alignItems: 'center',
    width: width * 0.4,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  speakerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width * 0.2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  orText: {
    color: '#fff',
    fontSize: 12,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    width: 60,
    justifyContent: 'space-between',
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4500',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  captionContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  captionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  captionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  captionTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  hintContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  hintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hintTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  endCallButton: {
    backgroundColor: '#FF4500',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  ttsStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    margin: 16,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.5)',
  },
  ttsStatusText: {
    color: '#FFC107',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  captionControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  translationToggle: {
    marginRight: 12,
    padding: 4,
  },
  translationContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
    marginRight: 4,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});

export default AICallScreen; 