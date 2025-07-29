import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { 
  translationService, 
  SUPPORTED_LANGUAGES,
  TranslationResult 
} from '../utils/libreTranslateService';

interface TranslationDemoProps {
  onClose?: () => void;
}

const TranslationDemo: React.FC<TranslationDemoProps> = ({ onClose }) => {
  const [inputText, setInputText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('bn'); // Bengali
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);
  
  useEffect(() => {
    initializeService();
  }, []);

  const initializeService = async () => {
    try {
      const initialized = await translationService.initialize();
      setIsServiceReady(initialized);
      
      if (!initialized) {
        Alert.alert(
          'Translation Service',
          'Failed to initialize translation service. Please check your internet connection.'
        );
      }
    } catch (error) {
      console.error('Service initialization error:', error);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some text to translate');
      return;
    }

    if (!isServiceReady) {
      Alert.alert('Error', 'Translation service is not ready');
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translationService.translateText(inputText, {
        source: sourceLanguage,
        target: targetLanguage,
        alternatives: 2,
      });

      setTranslationResult(result);

      if (result.error) {
        Alert.alert('Translation Error', result.error);
      }
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDetectLanguage = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some text to detect language');
      return;
    }

    try {
      const detection = await translationService.detectLanguage(inputText);
      if (detection) {
        Alert.alert(
          'Language Detection',
          `Detected language: ${translationService.getLanguageName(detection.language)} (${detection.confidence}% confidence)`
        );
        setSourceLanguage(detection.language);
      } else {
        Alert.alert('Detection Failed', 'Could not detect the language');
      }
    } catch (error) {
      console.error('Language detection error:', error);
      Alert.alert('Error', 'Language detection failed');
    }
  };

  const getLanguageOptions = () => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
      code,
      name,
    }));
  };

  const clearAll = () => {
    setInputText('');
    setTranslationResult(null);
    setSourceLanguage('auto');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LibreTranslate Demo</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      {/* Service Status */}
      <View style={[styles.statusContainer, { backgroundColor: isServiceReady ? '#E8F5E8' : '#FFF3CD' }]}>
        <Icon 
          name={isServiceReady ? "checkmark-circle" : "warning"} 
          size={16} 
          color={isServiceReady ? "#4CAF50" : "#FF9800"} 
        />
        <Text style={[styles.statusText, { color: isServiceReady ? "#4CAF50" : "#FF9800" }]}>
          {isServiceReady ? 'Translation service ready' : 'Translation service initializing...'}
        </Text>
      </View>

      {/* Input Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input Text</Text>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Enter text to translate..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.detectButton]} 
            onPress={handleDetectLanguage}
            disabled={!isServiceReady || !inputText.trim()}
          >
            <Icon name="search" size={16} color="#fff" />
            <Text style={styles.buttonText}>Detect Language</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.clearButton]} 
            onPress={clearAll}
          >
            <Icon name="refresh" size={16} color="#fff" />
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Language Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Languages</Text>
        <View style={styles.languageRow}>
          <View style={styles.languageSelect}>
            <Text style={styles.languageLabel}>From:</Text>
            <Text style={styles.languageValue}>
              {sourceLanguage === 'auto' ? 'Auto-detect' : translationService.getLanguageName(sourceLanguage)}
            </Text>
          </View>
          
          <Icon name="arrow-forward" size={20} color="#666" style={styles.arrowIcon} />
          
          <View style={styles.languageSelect}>
            <Text style={styles.languageLabel}>To:</Text>
            <Text style={styles.languageValue}>
              {translationService.getLanguageName(targetLanguage)}
            </Text>
          </View>
        </View>
      </View>

      {/* Translate Button */}
      <TouchableOpacity 
        style={[styles.translateButton, (!isServiceReady || !inputText.trim()) && styles.disabledButton]} 
        onPress={handleTranslate}
        disabled={!isServiceReady || !inputText.trim() || isTranslating}
      >
        {isTranslating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="language" size={20} color="#fff" />
        )}
        <Text style={styles.translateButtonText}>
          {isTranslating ? 'Translating...' : 'Translate'}
        </Text>
      </TouchableOpacity>

      {/* Translation Result */}
      {translationResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translation Result</Text>
          
          {translationResult.detectedLanguage && (
            <View style={styles.detectionInfo}>
              <Icon name="information-circle" size={16} color="#2196F3" />
              <Text style={styles.detectionText}>
                Detected: {translationService.getLanguageName(translationResult.detectedLanguage.language)} 
                ({translationResult.detectedLanguage.confidence}% confidence)
              </Text>
            </View>
          )}
          
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>{translationResult.translatedText}</Text>
          </View>
          
          {translationResult.alternatives && translationResult.alternatives.length > 0 && (
            <View style={styles.alternativesContainer}>
              <Text style={styles.alternativesTitle}>Alternative translations:</Text>
              {translationResult.alternatives.map((alt, index) => (
                <Text key={index} style={styles.alternativeText}>• {alt}</Text>
              ))}
            </View>
          )}
          
          {translationResult.error && (
            <View style={styles.errorContainer}>
              <Icon name="warning" size={16} color="#f44336" />
              <Text style={styles.errorText}>{translationResult.error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Cache Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cache Info</Text>
        <Text style={styles.cacheInfo}>
          Cached translations: {translationService.getCacheSize()}
        </Text>
        <TouchableOpacity 
          style={[styles.button, styles.clearCacheButton]} 
          onPress={() => {
            translationService.clearCache();
            Alert.alert('Cache Cleared', 'Translation cache has been cleared');
          }}
        >
          <Icon name="trash" size={16} color="#fff" />
          <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: '#fafafa',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  detectButton: {
    backgroundColor: '#2196F3',
  },
  clearButton: {
    backgroundColor: '#FF9800',
  },
  clearCacheButton: {
    backgroundColor: '#f44336',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageSelect: {
    flex: 1,
    alignItems: 'center',
  },
  languageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  languageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  arrowIcon: {
    marginHorizontal: 16,
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  detectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  detectionText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#2196F3',
  },
  resultContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  alternativesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
  },
  alternativesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 6,
  },
  alternativeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  errorText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#f44336',
  },
  cacheInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});

export default TranslationDemo; 