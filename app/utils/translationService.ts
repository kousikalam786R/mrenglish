import { APP_CONFIG } from './config';

// LibreTranslate API configuration
const LIBRETRANSLATE_CONFIG = {
  // Free public instance - you can also use your own self-hosted instance
  baseUrl: 'https://libretranslate.com',
  apiKey: '', // Optional: add your API key here for higher rate limits
  timeout: 10000, // 10 seconds timeout
};

// Language code mappings
export const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'bn': 'Bengali',
  'tr': 'Turkish',
  'pl': 'Polish',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'uk': 'Ukrainian',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'et': 'Estonian',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'mt': 'Maltese',
  'el': 'Greek',
  'he': 'Hebrew',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'tl': 'Filipino',
  'sw': 'Swahili',
  'am': 'Amharic',
  'yo': 'Yoruba',
  'ig': 'Igbo',
  'ha': 'Hausa',
  'zu': 'Zulu',
  'af': 'Afrikaans',
  'fa': 'Persian',
  'ur': 'Urdu',
  'hy': 'Armenian',
  'ka': 'Georgian',
  'az': 'Azerbaijani',
  'kk': 'Kazakh',
  'ky': 'Kyrgyz',
  'uz': 'Uzbek',
  'mn': 'Mongolian',
  'ne': 'Nepali',
  'si': 'Sinhala',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
  'or': 'Odia',
  'as': 'Assamese',
  'my': 'Myanmar',
  'km': 'Khmer',
  'lo': 'Lao',
  'bo': 'Tibetan',
  'dz': 'Dzongkha',
};

// Translation cache to avoid redundant API calls
const translationCache = new Map<string, string>();

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

export interface TranslationOptions {
  source?: string;
  target: string;
  alternatives?: number;
  format?: 'text' | 'html';
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: {
    confidence: number;
    language: string;
  };
  alternatives?: string[];
  error?: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  targets: string[];
}

export class LibreTranslateService {
  private static instance: LibreTranslateService;
  private availableLanguages: LanguageInfo[] = [];
  private isInitialized = false;

  private constructor() {}

  static getInstance(): LibreTranslateService {
    if (!LibreTranslateService.instance) {
      LibreTranslateService.instance = new LibreTranslateService();
    }
    return LibreTranslateService.instance;
  }

  /**
   * Initialize the service by fetching available languages
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('Initializing LibreTranslate service...');
      const languages = await this.getAvailableLanguages();
      this.availableLanguages = languages;
      this.isInitialized = true;
      console.log('LibreTranslate service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize LibreTranslate service:', error);
      return false;
    }
  }

  /**
   * Get list of available languages from LibreTranslate
   */
  async getAvailableLanguages(): Promise<LanguageInfo[]> {
    try {
      const response = await fetch(`${LIBRETRANSLATE_CONFIG.baseUrl}/languages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(LIBRETRANSLATE_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const languages: LanguageInfo[] = await response.json();
      return languages;
    } catch (error) {
      console.error('Error fetching available languages:', error);
      // Return fallback languages if API call fails
      return this.getFallbackLanguages();
    }
  }

  /**
   * Translate text using LibreTranslate API
   */
  async translateText(
    text: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    // Input validation
    if (!text || text.trim().length === 0) {
      return { translatedText: '', error: 'Empty text provided' };
    }

    if (!options.target) {
      return { translatedText: text, error: 'Target language not specified' };
    }

    // Check cache first
    const cacheKey = `${text}_${options.source || 'auto'}_${options.target}`;
    if (translationCache.has(cacheKey)) {
      console.log('Translation found in cache');
      return { translatedText: translationCache.get(cacheKey)! };
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
    }
    lastRequestTime = Date.now();

    try {
      // Prepare request body
      const requestBody: any = {
        q: text,
        source: options.source || 'auto',
        target: options.target,
        format: options.format || 'text',
      };

      // Add alternatives if requested
      if (options.alternatives && options.alternatives > 0) {
        requestBody.alternatives = options.alternatives;
      }

      // Add API key if available
      if (LIBRETRANSLATE_CONFIG.apiKey) {
        requestBody.api_key = LIBRETRANSLATE_CONFIG.apiKey;
      }

      console.log('Translating text:', text.substring(0, 50) + '...');
      
      const response = await fetch(`${LIBRETRANSLATE_CONFIG.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(LIBRETRANSLATE_CONFIG.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      
      // Cache the result
      if (result.translatedText) {
        translationCache.set(cacheKey, result.translatedText);
        
        // Limit cache size
        if (translationCache.size > 1000) {
          const firstKey = translationCache.keys().next().value;
          translationCache.delete(firstKey);
        }
      }

      console.log('Translation successful');
      return {
        translatedText: result.translatedText || text,
        detectedLanguage: result.detectedLanguage,
        alternatives: result.alternatives,
      };

    } catch (error) {
      console.error('Translation error:', error);
      
      // Return fallback result
      return {
        translatedText: text,
        error: error instanceof Error ? error.message : 'Translation failed',
      };
    }
  }

  /**
   * Detect the language of given text
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number } | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      const response = await fetch(`${LIBRETRANSLATE_CONFIG.baseUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          api_key: LIBRETRANSLATE_CONFIG.apiKey || undefined,
        }),
        signal: AbortSignal.timeout(LIBRETRANSLATE_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        language: result[0]?.language || 'en',
        confidence: result[0]?.confidence || 0,
      };

    } catch (error) {
      console.error('Language detection error:', error);
      return null;
    }
  }

  /**
   * Get fallback languages when API is unavailable
   */
  private getFallbackLanguages(): LanguageInfo[] {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
      code,
      name,
      targets: Object.keys(SUPPORTED_LANGUAGES).filter(target => target !== code),
    }));
  }

  /**
   * Get language name from code
   */
  getLanguageName(code: string): string {
    return SUPPORTED_LANGUAGES[code as keyof typeof SUPPORTED_LANGUAGES] || code;
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(code: string): boolean {
    return code in SUPPORTED_LANGUAGES;
  }

  /**
   * Get user's preferred language from app config
   */
  getUserLanguage(): string {
    return APP_CONFIG.defaultLanguage || 'en';
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    translationCache.clear();
    console.log('Translation cache cleared');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return translationCache.size;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Batch translate multiple texts
   */
  async translateBatch(
    texts: string[],
    options: TranslationOptions
  ): Promise<TranslationResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // LibreTranslate supports batch translation
    try {
      const requestBody: any = {
        q: texts,
        source: options.source || 'auto',
        target: options.target,
        format: options.format || 'text',
      };

      if (LIBRETRANSLATE_CONFIG.apiKey) {
        requestBody.api_key = LIBRETRANSLATE_CONFIG.apiKey;
      }

      const response = await fetch(`${LIBRETRANSLATE_CONFIG.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(LIBRETRANSLATE_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle both single and batch responses
      if (Array.isArray(result.translatedText)) {
        return result.translatedText.map((text: string, index: number) => ({
          translatedText: text,
          detectedLanguage: result.detectedLanguage,
        }));
      } else {
        // Single response, convert to array
        return [{ translatedText: result.translatedText }];
      }

    } catch (error) {
      console.error('Batch translation error:', error);
      
      // Fallback to individual translations
      const results: TranslationResult[] = [];
      for (const text of texts) {
        const result = await this.translateText(text, options);
        results.push(result);
      }
      return results;
    }
  }
}

// Export singleton instance
export const translationService = LibreTranslateService.getInstance();

// Helper functions for common use cases
export const translateToUserLanguage = async (text: string): Promise<string> => {
  const userLang = translationService.getUserLanguage();
  const result = await translationService.translateText(text, {
    target: userLang,
  });
  return result.translatedText;
};

export const translateFromUserLanguage = async (text: string, targetLang: string): Promise<string> => {
  const userLang = translationService.getUserLanguage();
  const result = await translationService.translateText(text, {
    source: userLang,
    target: targetLang,
  });
  return result.translatedText;
};

export const detectAndTranslate = async (text: string, targetLang: string): Promise<TranslationResult> => {
  return await translationService.translateText(text, {
    source: 'auto',
    target: targetLang,
  });
}; 