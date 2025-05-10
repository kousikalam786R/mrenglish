import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface TypingIndicatorProps {
  isTyping: boolean;
  username?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isTyping, 
  username = 'User'
}) => {
  // Animation values for the three dots
  const dot1Animation = useRef(new Animated.Value(0)).current;
  const dot2Animation = useRef(new Animated.Value(0)).current;
  const dot3Animation = useRef(new Animated.Value(0)).current;
  
  // Set up the animation sequence
  useEffect(() => {
    if (isTyping) {
      startAnimation();
    } else {
      // Reset animations when not typing
      dot1Animation.setValue(0);
      dot2Animation.setValue(0);
      dot3Animation.setValue(0);
    }
  }, [isTyping]);
  
  // Animate dots in sequence
  const startAnimation = () => {
    Animated.sequence([
      // First dot
      Animated.timing(dot1Animation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.ease
      }),
      // Second dot
      Animated.timing(dot2Animation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.ease
      }),
      // Third dot
      Animated.timing(dot3Animation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.ease
      }),
      // Reset all dots
      Animated.parallel([
        Animated.timing(dot1Animation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(dot2Animation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(dot3Animation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.ease
        })
      ])
    ]).start((finished) => {
      // Restart animation if we're still typing
      if (finished && isTyping) {
        startAnimation();
      }
    });
  };
  
  // Interpolate opacity values
  const dot1Opacity = dot1Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1]
  });
  
  const dot2Opacity = dot2Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1]
  });
  
  const dot3Opacity = dot3Animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1]
  });
  
  if (!isTyping) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{username} is typing</Text>
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: 10,
  },
  text: {
    fontSize: 12,
    color: '#888888',
    marginRight: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#888888',
    marginHorizontal: 2,
  },
});

export default TypingIndicator; 