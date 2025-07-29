import Tts from 'react-native-tts';
import { Platform } from 'react-native';

export interface TTSHelperInterface {
  initializeTTS: () => Promise<boolean>;
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  getAvailableVoices: () => Promise<any[]>;
  testTTS: () => Promise<boolean>;
}

export class TTSHelper implements TTSHelperInterface {
  private isInitialized: boolean = false;

  async initializeTTS(): Promise<boolean> {
    try {
      console.log('Initializing TTS...');
      
      // Set default language
      await Tts.setDefaultLanguage('en-US');
      
      // Platform-specific voice configuration
      if (Platform.OS === 'ios') {
        try {
          await Tts.setDefaultVoice('com.apple.ttsbundle.Samantha-compact');
        } catch {
          console.log('Samantha voice not available, trying Moira...');
          try {
            await Tts.setDefaultVoice('com.apple.ttsbundle.Moira-compact');
          } catch {
            console.log('Using system default voice');
          }
        }
      }
      
      // Set speech parameters
      await Tts.setDefaultRate(0.5);
      await Tts.setDefaultPitch(1.0);
      
      this.isInitialized = true;
      console.log('TTS initialized successfully');
      return true;
      
    } catch (error) {
      console.error('TTS initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('TTS not initialized');
    }
    
    try {
      await Tts.stop();
      await Tts.speak(text);
    } catch (error) {
      console.error('TTS speak error:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await Tts.stop();
    } catch (error) {
      console.error('TTS stop error:', error);
    }
  }

  async getAvailableVoices(): Promise<any[]> {
    try {
      const voices = await Tts.voices();
      console.log('Available voices:', voices);
      return voices;
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  }

  async testTTS(): Promise<boolean> {
    try {
      console.log('Testing TTS...');
      
      // Initialize if not already done
      if (!this.isInitialized) {
        const initSuccess = await this.initializeTTS();
        if (!initSuccess) return false;
      }
      
      // Test speak
      await this.speak('Hello! This is a test of the text to speech system.');
      console.log('TTS test completed successfully');
      return true;
      
    } catch (error) {
      console.error('TTS test failed:', error);
      return false;
    }
  }
}

export const ttsHelper = new TTSHelper(); 