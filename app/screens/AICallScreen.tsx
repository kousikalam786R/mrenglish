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
import { AICallScreenRouteProp } from '../navigation/types';

const { width, height } = Dimensions.get('window');

const AICallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<AICallScreenRouteProp>();
  
  // Logging route params for debugging
  console.log('AICallScreen.tsx received route params:', route.params);
  
  const { topic, level, id, name } = route.params;
  
  const [callDuration, setCallDuration] = useState(0);
  const [isRobotSpeaking, setIsRobotSpeaking] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showHintModal, setShowHintModal] = useState(false);
  const [currentCaption, setCurrentCaption] = useState("How was your weekend? Did you do anything interesting?");
  const [currentHint, setCurrentHint] = useState("Try describing what you did in detail using past tense verbs.");
  
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
        setIsRobotSpeaking(prev => !prev);
        
        // If switching to robot speaking, change the caption
        if (!isRobotSpeaking) {
          const randomIndex = Math.floor(Math.random() * sampleCaptions.length);
          setCurrentCaption(sampleCaptions[randomIndex]);
          
          // Also update the hint
          const hintIndex = Math.floor(Math.random() * sampleHints.length);
          setCurrentHint(sampleHints[hintIndex]);
        }
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
  
  const handleEndCall = () => {
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
  
  const togglePause = () => {
    setIsPaused(!isPaused);
  };
  
  const toggleCaptions = () => {
    setShowCaptions(!showCaptions);
  };
  
  const toggleHint = () => {
    setShowHintModal(!showHintModal);
  };
  
  const toggleRecording = () => {
    // If we're starting to record, make sure the robot isn't speaking
    if (!isRecording) {
      setIsRobotSpeaking(false);
    }
    setIsRecording(!isRecording);
  };
  
  // Generate random heights for audio waveform bars
  const generateWaveform = () => {
    const bars = [];
    const count = 5;
    
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
            { height: animatedHeight }
          ]} 
        />
      );
    }
    
    return bars;
  };

  return (
    <LinearGradient 
      colors={['#1E0071', '#00BFFF']} 
      style={styles.container}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
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
              isRobotSpeaking && !isPaused ? styles.activeSpeaker : {}
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
            <View style={styles.dividerLine} />
            <View style={styles.orContainer}>
              <Text style={styles.orText}>OR</Text>
            </View>
            <View style={styles.dividerLine} />
          </View>
          
          {/* User avatar and info */}
          <View style={styles.speakerContainer}>
            <View style={[
              styles.avatarContainer,
              !isRobotSpeaking && !isPaused ? styles.activeSpeaker : {},
              isRecording ? styles.recordingActive : {}
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
                isRecording ? styles.recordingButton : {}
              ]} 
              onPress={toggleRecording}
            >
              <Icon 
                name={isRecording ? "stop-circle" : "mic"} 
                size={28} 
                color={isRecording ? "#fff" : "#fff"} 
              />
              <Text style={styles.recordButtonText}>
                {isRecording ? "STOP" : "TAP TO SPEAK"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Captions area */}
        {showCaptions && isRobotSpeaking && (
          <View style={styles.captionContainer}>
            <View style={styles.captionHeader}>
              <View style={styles.captionTitleContainer}>
                <Icon name="chatbubble-ellipses-outline" size={18} color="#FFD700" />
                <Text style={styles.captionTitle}>RAHA said:</Text>
              </View>
              <TouchableOpacity onPress={toggleCaptions}>
                <Icon name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.captionText}>{currentCaption}</Text>
          </View>
        )}
        
        {/* Hint modal */}
        {showHintModal && (
          <View style={styles.hintContainer}>
            <View style={styles.hintHeader}>
              <View style={styles.hintTitleContainer}>
                <Icon name="bulb-outline" size={18} color="#FFD700" />
                <Text style={styles.hintTitle}>HINT:</Text>
              </View>
              <TouchableOpacity onPress={toggleHint}>
                <Icon name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>{currentHint}</Text>
          </View>
        )}
        
        {/* Bottom control bar */}
        <View style={styles.controlBar}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleHint}>
            <Icon name="bulb-outline" size={22} color="#fff" />
            <Text style={styles.controlText}>Hint</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={toggleCaptions}>
            <Icon name="chatbubble-ellipses-outline" size={22} color="#fff" />
            <Text style={styles.controlText}>Caption</Text>
          </TouchableOpacity>
          
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeSpeaker: {
    borderColor: '#00FFFF',
    borderWidth: 3,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  recordingActive: {
    borderColor: '#FF4500',
    shadowColor: '#FF4500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  orContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#00FFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recordingButton: {
    backgroundColor: '#FF4500',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  captionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    color: '#FFD700',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    color: '#FFD700',
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
});

export default AICallScreen; 