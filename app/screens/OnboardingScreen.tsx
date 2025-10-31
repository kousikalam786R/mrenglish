import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { updateUserProfile, UserProfile } from '../utils/profileService';
import { useAppDispatch } from '../redux/hooks';
import { setUserData } from '../redux/slices/userSlice';
import { signInSuccess } from '../redux/slices/authSlice';

type GoalOption = {
  value: string;
  title: string;
  description: string;
  icon: string;
};

type EnglishLevelOption = {
  value: string;
  title: string;
  description: string;
};

type GenderOption = {
  value: 'Male' | 'Female';
  title: string;
  icon: string;
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'improve_english',
    title: 'Improve my English',
    description: 'I want to improve my speaking skills and not forget what I learned before.',
    icon: '🎓',
  },
  {
    value: 'make_friends',
    title: 'Make friends with natives',
    description: 'I want to create valuable connections with people at my home country or abroad.',
    icon: '🤝',
  },
];

const ENGLISH_LEVELS: EnglishLevelOption[] = [
  {
    value: 'A1',
    title: 'A1 · Beginner',
    description: 'I can introduce myself and ask simple questions. Use basic greetings.',
  },
  {
    value: 'A2',
    title: 'A2 · Elementary',
    description: 'I can chat about daily life and describe my hometown. Handle small talk.',
  },
  {
    value: 'B1',
    title: 'B1 · Intermediate',
    description: 'I can discuss hobbies and share travel stories. Maintain a conversation smoothly.',
  },
  {
    value: 'B2',
    title: 'B2 · Upper intermediate',
    description: 'I can discuss movies and current events. Express opinions and use idioms.',
  },
  {
    value: 'C1',
    title: 'C1 · Advanced',
    description: 'I can tell detailed stories and share complex ideas. Very high English level.',
  },
  {
    value: 'C2',
    title: 'C2 · Proficiency',
    description: 'I can have deep discussions and use idioms naturally. Speak fluently like a native.',
  },
];

const GENDER_OPTIONS: GenderOption[] = [
  {
    value: 'Male',
    title: 'Male',
    icon: 'male-outline',
  },
  {
    value: 'Female',
    title: 'Female',
    icon: 'female-outline',
  },
];

const LANGUAGES = [
  'Afar',
  'Abkhazian – Аҧсуа',
  'Afrikaans',
  'Akan – Akana',
  'Amharic – አማርኛ',
  'Arabic – العربية',
  'Assamese – অসমীয়া',
  'Avar – Авар',
  'Bengali – বাংলা',
  'Bulgarian – Български',
  'Chinese – 中文',
  'English',
  'French – Français',
  'German – Deutsch',
  'Hindi – हिन्दी',
  'Indonesian – Bahasa Indonesia',
  'Japanese – 日本語',
  'Korean – 한국어',
  'Portuguese – Português',
  'Russian – Русский',
  'Spanish – Español',
  'Swahili – Kiswahili',
  'Turkish – Türkçe',
  'Urdu – اردو',
  'Vietnamese – Tiếng Việt',
];

const SUCCESS_MESSAGES = [
  'Analyzing your responses',
  'Optimizing smart matches',
  'Finding the best partners',
  'Building your learning path',
];

type FormState = {
  goal?: string;
  nativeLanguage?: string;
  englishLevel?: string;
  gender?: 'Male' | 'Female';
  age?: string;
};

const TOTAL_STEPS = 4;

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>({});
  const [languageQuery, setLanguageQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedSuccessSteps, setCompletedSuccessSteps] = useState(0);
  const [hasFinalized, setHasFinalized] = useState(false);

  const filteredLanguages = useMemo(() => {
    if (!languageQuery.trim()) {
      return LANGUAGES;
    }

    return LANGUAGES.filter(language =>
      language.toLowerCase().includes(languageQuery.trim().toLowerCase()),
    );
  }, [languageQuery]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (showSuccess && !hasFinalized && completedSuccessSteps < SUCCESS_MESSAGES.length) {
      timer = setTimeout(() => {
        setCompletedSuccessSteps(prev => prev + 1);
      }, 600);
    }

    if (showSuccess && !hasFinalized && completedSuccessSteps === SUCCESS_MESSAGES.length) {
      timer = setTimeout(() => {
        finalizeOnboarding();
      }, 700);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccess, completedSuccessSteps, hasFinalized]);

  const updateFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleContinue = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleGoBack = () => {
    if (showSuccess) {
      return;
    }

    if (currentStep === 0) {
      navigation.goBack();
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const isContinueDisabled = () => {
    switch (currentStep) {
      case 0:
        return !form.goal;
      case 1:
        return !form.nativeLanguage;
      case 2:
        return !form.englishLevel;
      case 3:
        return !form.gender || !form.age;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (isSaving || showSuccess) {
      return;
    }

    if (!form.goal || !form.nativeLanguage || !form.englishLevel || !form.gender || !form.age) {
      Alert.alert('Missing Information', 'Please complete all the fields to continue.');
      return;
    }

    setIsSaving(true);

    try {
      const ageValue = Number(form.age);
      const profilePayload = {
        goal: form.goal,
        nativeLanguage: form.nativeLanguage,
        englishLevel: form.englishLevel,
        gender: form.gender,
        age: Number.isNaN(ageValue) ? undefined : ageValue,
      };

      const updatedProfile = await updateUserProfile(profilePayload);

      const cachedUser = await AsyncStorage.getItem('user');
      const cachedProfile: UserProfile = cachedUser ? JSON.parse(cachedUser) : {};

      const mergedProfile: UserProfile = {
        ...cachedProfile,
        ...profilePayload,
        ...(updatedProfile || {}),
      };

      await AsyncStorage.setItem('user', JSON.stringify(mergedProfile));
      dispatch(setUserData(mergedProfile));

      setShowSuccess(true);
    } catch (error: any) {
      console.error('Onboarding submission error:', error);
      Alert.alert('Oops!', 'We could not save your details right now. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const finalizeOnboarding = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');

      if (token && userId) {
        dispatch(signInSuccess({ token, userId }));
      }
      setHasFinalized(true);
    } catch (error) {
      console.error('Error finalizing onboarding:', error);
    }
  };

  const renderProgress = () => {
    return (
      <View style={styles.progressContainer}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <View
              key={`progress-${index}`}
              style={[
                styles.progressDot,
                (isActive || isCompleted) && styles.progressDotActive,
                isCompleted && styles.progressDotCompleted,
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderGoalStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.questionTitle}>What is your goal?</Text>
      <Text style={styles.questionSubtitle}>Pick the option that best matches what you want to achieve.</Text>

      {GOAL_OPTIONS.map(option => {
        const isSelected = form.goal === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.cardOption, isSelected && styles.cardOptionSelected]}
            onPress={() => updateFormField('goal', option.value)}
            activeOpacity={0.9}
          >
            <Text style={styles.cardIcon}>{option.icon}</Text>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={22} color="#6C5CE7" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderLanguageStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.questionTitle}>What is your native language?</Text>
      <Text style={styles.questionSubtitle}>We’ll use this to personalize your practice partners.</Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#A0A0B2" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your language"
          placeholderTextColor="#A0A0B2"
          value={languageQuery}
          onChangeText={setLanguageQuery}
        />
      </View>

      <View style={styles.languageList}>
        {filteredLanguages.map(language => {
          const isSelected = form.nativeLanguage === language;
          return (
            <TouchableOpacity
              key={language}
              style={styles.languageItem}
              onPress={() => updateFormField('nativeLanguage', language)}
              activeOpacity={0.7}
            >
              <Text style={styles.languageText}>{language}</Text>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderEnglishLevelStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.questionTitle}>What is your English level?</Text>
      <Text style={styles.questionSubtitle}>Choose the level that best describes your current skills.</Text>

      {ENGLISH_LEVELS.map(option => {
        const isSelected = form.englishLevel === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.levelOption, isSelected && styles.levelOptionSelected]}
            onPress={() => updateFormField('englishLevel', option.value)}
            activeOpacity={0.85}
          >
            <View style={styles.levelHeader}>
              <Text style={[styles.levelTitle, isSelected && styles.levelTitleSelected]}>{option.title}</Text>
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </View>
            <Text style={styles.levelDescription}>{option.description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderGenderStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.questionTitle}>Who are you?</Text>
      <Text style={styles.questionSubtitle}>Tell us a little about yourself so we can match you better.</Text>

      <View style={styles.genderContainer}>
        {GENDER_OPTIONS.map(option => {
          const isSelected = form.gender === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.genderCard, isSelected && styles.genderCardSelected]}
              onPress={() => updateFormField('gender', option.value)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={option.icon}
                size={42}
                color={isSelected ? '#6C5CE7' : '#A0A0B2'}
              />
              <Text style={[styles.genderTitle, isSelected && styles.genderTitleSelected]}>{option.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.ageLabel}>Enter your age</Text>
      <TextInput
        style={styles.ageInput}
        keyboardType="number-pad"
        maxLength={2}
        value={form.age ?? ''}
        onChangeText={text => updateFormField('age', text.replace(/[^0-9]/g, ''))}
        placeholder="Your age"
        placeholderTextColor="#A0A0B2"
      />

      <Text style={styles.ageHint}>People talk more with those who answer honestly 😊</Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconWrapper}>
        <View style={styles.successIconRing}>
          <Ionicons name="checkmark" size={42} color="#fff" />
        </View>
      </View>

      <Text style={styles.successTitle}>Setting up your personalized app experience</Text>

      <View style={styles.successList}>
        {SUCCESS_MESSAGES.map((message, index) => {
          const isComplete = index < completedSuccessSteps;
          return (
            <View key={message} style={styles.successRow}>
              <View style={[styles.successBullet, isComplete && styles.successBulletComplete]}>
                {isComplete && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.successMessage}>{message}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.successFooter}>Trusted by speakers in 120 countries</Text>
    </View>
  );

  const renderStepContent = () => {
    if (showSuccess) {
      return renderSuccess();
    }

    switch (currentStep) {
      case 0:
        return renderGoalStep();
      case 1:
        return renderLanguageStep();
      case 2:
        return renderEnglishLevelStep();
      case 3:
        return renderGenderStep();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleGoBack} disabled={showSuccess}>
              <Ionicons name="chevron-back" size={26} color="#4F4F6B" />
            </TouchableOpacity>
            {!showSuccess && renderProgress()}
            <View style={{ width: 26 }} />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>

          {!showSuccess && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryButton, (isContinueDisabled() || isSaving) && styles.primaryButtonDisabled]}
                onPress={handleContinue}
                disabled={isContinueDisabled() || isSaving}
                activeOpacity={0.9}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {currentStep === TOTAL_STEPS - 1 ? 'Finish' : 'Continue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 36,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E7E7F3',
    marginHorizontal: 3,
  },
  progressDotActive: {
    backgroundColor: '#C7C4FF',
  },
  progressDotCompleted: {
    backgroundColor: '#6C5CE7',
  },
  stepContainer: {
    marginTop: 24,
  },
  questionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2C2C47',
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 15,
    color: '#6F6F85',
    marginBottom: 24,
    lineHeight: 20,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#F8F7FF',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0EEFF',
  },
  cardOptionSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#F3F1FF',
  },
  cardIcon: {
    fontSize: 36,
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#36364A',
    marginBottom: 6,
  },
  cardTitleSelected: {
    color: '#4F3DD8',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6F6F85',
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2C2C47',
  },
  languageList: {
    paddingBottom: 16,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  languageText: {
    fontSize: 16,
    color: '#2C2C47',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D8D8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  levelOption: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFFE',
    backgroundColor: '#F9F9FF',
    marginBottom: 14,
  },
  levelOptionSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#F3F1FF',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#36364A',
  },
  levelTitleSelected: {
    color: '#4F3DD8',
  },
  levelDescription: {
    fontSize: 14,
    color: '#6F6F85',
    lineHeight: 20,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C9C8E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#6C5CE7',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C5CE7',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 6,
    borderRadius: 18,
    backgroundColor: '#F7F6FF',
    borderWidth: 1,
    borderColor: '#ECEBFF',
  },
  genderCardSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#F1EFFF',
  },
  genderTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#4A4A62',
  },
  genderTitleSelected: {
    color: '#4F3DD8',
  },
  ageLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A4A62',
    marginBottom: 10,
  },
  ageInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E4FA',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2C2C47',
    backgroundColor: '#FBFBFF',
    marginBottom: 10,
  },
  ageHint: {
    fontSize: 13,
    color: '#8B8BA4',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#B7B4EC',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C47',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  successList: {
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 36,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  successBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D8F4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F3FF',
  },
  successBulletComplete: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  successMessage: {
    fontSize: 15,
    color: '#4A4A62',
  },
  successFooter: {
    fontSize: 14,
    color: '#8B8BA4',
  },
});

export default OnboardingScreen;

