import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;
  overlay: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Accent colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // UI element colors
  border: string;
  divider: string;
  inputBackground: string;
  inputBorder: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Special colors
  shadow: string;
}

export const themes: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#FFFFFF',
    surface: '#F6F6F9',
    card: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.35)',
    
    text: '#2C2C47',
    textSecondary: '#6F6F89',
    textTertiary: '#898BA4',
    
    primary: '#4A90E2',
    primaryLight: '#6BA3E8',
    primaryDark: '#357ABD',
    
    border: '#E6E6F0',
    divider: '#E6E6F0',
    inputBackground: '#F7F7FC',
    inputBorder: '#ECECF4',
    
    success: '#4CAF50',
    error: '#D64545',
    warning: '#FF9800',
    info: '#4A90E2',
    
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    background: '#1A1A2E',
    surface: '#16213E',
    card: '#0F3460',
    overlay: 'rgba(0, 0, 0, 0.7)',
    
    text: '#FFFFFF',
    textSecondary: '#B0B3C7',
    textTertiary: '#6F6F89',
    
    primary: '#4A90E2',
    primaryLight: '#6BA3E8',
    primaryDark: '#357ABD',
    
    border: '#2A2A3E',
    divider: '#2A2A3E',
    inputBackground: '#1F1F35',
    inputBorder: '#2A2A3E',
    
    success: '#66BB6A',
    error: '#EF5350',
    warning: '#FFA726',
    info: '#42A5F5',
    
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  fadeAnim: Animated.Value;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@mrenglish_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isInitialized, setIsInitialized] = useState(false);
  const fadeAnim = useState(new Animated.Value(1))[0];

  // Determine if dark mode should be active
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const theme = isDark ? themes.dark : themes.light;

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadThemePreference();
  }, []);

  // Update theme when system color scheme changes (if mode is 'system')
  useEffect(() => {
    if (themeMode === 'system') {
      // Theme will automatically update when systemColorScheme changes
    }
  }, [systemColorScheme, themeMode]);

  // Save theme preference to storage and animate transition
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Update theme
        setThemeModeState(mode);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });

      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, [fadeAnim]);

  // Toggle between light and dark (skips system)
  const toggleTheme = useCallback(async () => {
    const newMode = isDark ? 'light' : 'dark';
    await setThemeMode(newMode);
  }, [isDark, setThemeMode]);

  // Don't render until theme is loaded to prevent flash
  if (!isInitialized) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDark,
        setThemeMode,
        toggleTheme,
        fadeAnim,
      }}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
        }}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        {children}
      </Animated.View>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};









