import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// import Ionicons from 'react-native-vector-icons/Ionicons';

interface LogoProps {
  size?: number;
  color?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 120, color = '#4A90E2' }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={[styles.logoText, { color, fontSize: size * 0.5 }]}>ME</Text>
      <View style={styles.globeContainer}>
        <Text style={[styles.subtitleText, { color, fontSize: size * 0.2 }]}>MrEnglish</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 3,
    borderRadius: 60,
    borderColor: '#4A90E2',
  },
  globeContainer: {
    position: 'absolute',
    bottom: 10,
  },
  logoText: {
    fontWeight: 'bold',
  },
  subtitleText: {
    fontWeight: 'bold',
  }
});

export default Logo; 