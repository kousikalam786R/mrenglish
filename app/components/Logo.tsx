import React from 'react';
import { View, Image, StyleSheet, ImageStyle } from 'react-native';

interface LogoProps {
  size?: number;
  style?: ImageStyle;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  rounded?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 120, 
  style,
  resizeMode = 'contain',
  rounded = true
}) => {
  // Logo will fill almost the entire circle, accounting for border
  // Account for 3px border on each side (6px total)
  const logoSize = size - 6;
  
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
          { width: logoSize, height: logoSize },
          rounded && { borderRadius: logoSize /0.5},
          style
        ]}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    // borderWidth: 3,
    // borderColor: '#4A90E2',
    //backgroundColor: '#E3F2FD', // Light blue background
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
    // elevation: 3,
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  logo: {
    backgroundColor: '#E3F2FD', // Light blue background
  },
});

export default Logo; 