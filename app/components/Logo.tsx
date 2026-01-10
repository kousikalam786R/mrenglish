import React from 'react';
import { View, Image, StyleSheet, ImageStyle } from 'react-native';

interface LogoProps {
  size?: number;
  style?: ImageStyle;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  rounded?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 100, 
  style,
  resizeMode = 'contain',
  rounded = true
}) => {
  return (
    <View style={[
      styles.container,
      rounded && { borderRadius: size / 2 },
      { width: size, height: size },
    ]}>
      <Image 
        source={require('../assets/images/mrenglish-logo.png')}
        style={[
          styles.logo,
          { width: size, height: size },
          rounded && { borderRadius: size / 2 },
          style
        ]}
        resizeMode={resizeMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    // borderWidth: 3,
    // borderColor: '#4A90E2',
    //backgroundColor: '#E3F2FD', // Light blue background
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
    // elevation: 3,
  },
  logo: {
    backgroundColor: '#E3F2FD', // Light blue background
  },
});

export default Logo; 