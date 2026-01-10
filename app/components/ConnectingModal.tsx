/**
 * Connecting Modal Component
 * 
 * LAZY-LOADING UX IMPROVEMENT:
 * Shows instant feedback after invitation acceptance while WebRTC is setting up.
 * 
 * Why this improves UX:
 * - WebRTC setup (offer/answer/ICE negotiation) takes 2-5 seconds
 * - Without this modal, the UI feels blank/unresponsive during this delay
 * - This modal appears immediately, providing visual feedback that connection is in progress
 * - User knows the system is working, reducing perceived wait time
 * 
 * Lifecycle:
 * - Appears when: callState.status === "connecting" (immediately after invitation acceptance)
 * - Hides when: callState.status === "connected" | "ended" | "idle"
 * - Rendered at App root level (above all navigation) for maximum visibility
 * 
 * DO NOT place inside CallScreen or navigation stacks - must be at root level
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { CallStatus, resetCallState } from '../redux/slices/callSlice';

const { width } = Dimensions.get('window');

const ConnectingModal: React.FC = () => {
  const dispatch = useDispatch();
  const callState = useSelector((state: RootState) => state.call.activeCall);
  
  // Show modal when status is CONNECTING
  // Hide when connected, ended, or idle
  // This provides instant feedback after invitation acceptance while WebRTC is setting up
  const visible = callState.status === CallStatus.CONNECTING;
  
  // Timeout to close modal if connection takes too long (30 seconds)
  // This prevents the modal from showing indefinitely if connection fails
  const connectingStartTime = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (visible) {
      // Record when connecting started
      connectingStartTime.current = Date.now();
      console.log('🟢 [ConnectingModal] ConnectingModal mounted');
      
      // Timeout only resets Redux UI state.
      // Call termination and WebRTC cleanup are handled by callFlowService.
      timeoutRef.current = setTimeout(() => {
        const elapsed = Date.now() - (connectingStartTime.current || Date.now());
        console.warn('⏰ [ConnectingModal] Connection timeout after', Math.round(elapsed / 1000), 'seconds');
        console.warn('   Resetting call state to close modal');
        
        dispatch(resetCallState());
        
        console.log('✅ [ConnectingModal] Call state reset - modal should close');
      }, 30000); // 30 seconds timeout
    } else {
      // Clear timeout if modal is hidden (connection succeeded or was cancelled)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      connectingStartTime.current = null;
      console.log('🔴 [ConnectingModal] ConnectingModal unmounted');
    }
    
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, dispatch]);
  
  // Debug logs for connecting state transitions
  useEffect(() => {
    if (callState.status === CallStatus.CONNECTING) {
      console.log('🔵 [ConnectingModal] Call state → connecting');
    }
  }, [callState.status]);
  
  // Animation values for dots
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;
  const dot4Anim = useRef(new Animated.Value(0.3)).current;
  const dot5Anim = useRef(new Animated.Value(0.3)).current;
  
  // Animate dots with sequential wave animation
  useEffect(() => {
    if (visible) {
      const animateDot = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      // Create sequential wave animation (each dot lights up one after another)
      const anim1 = animateDot(dot1Anim, 0);
      const anim2 = animateDot(dot2Anim, 150);
      const anim3 = animateDot(dot3Anim, 300);
      const anim4 = animateDot(dot4Anim, 450);
      const anim5 = animateDot(dot5Anim, 600);
      
      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      anim5.start();
      
      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        anim4.stop();
        anim5.stop();
        dot1Anim.setValue(0.3);
        dot2Anim.setValue(0.3);
        dot3Anim.setValue(0.3);
        dot4Anim.setValue(0.3);
        dot5Anim.setValue(0.3);
      };
    }
  }, [visible, dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // ✅ REQUIREMENT 5: Block UI during CONNECTING state
      // Modal blocks all interaction until CONNECTED or ENDED
      // This prevents user from navigating away during WebRTC setup
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>Connecting with your partner…</Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>Please wait a moment</Text>
          
          {/* Loading Dots */}
          <View style={styles.loadingContainer}>
            <View style={styles.dotsContainer}>
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot1,
                  {
                    opacity: dot1Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [{
                      scale: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    }],
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot2,
                  {
                    opacity: dot2Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot3,
                  {
                    opacity: dot3Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot4,
                  {
                    opacity: dot4Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.dot, 
                  styles.dot5,
                  {
                    opacity: dot5Anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    width: width * 0.8,
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1', // Purple color matching the app theme
  },
  dot1: {},
  dot2: {},
  dot3: {},
  dot4: {},
  dot5: {},
});

export default ConnectingModal;

