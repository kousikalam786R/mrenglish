import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

type AboutNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Import package.json data
const packageData = {
  name: 'mrenglish',
  version: '0.0.1',
};

const AboutScreen = () => {
  const navigation = useNavigation<AboutNavigationProp>();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@mrenglish.app');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://mrenglish.app');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary + '15' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('settings.about')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.surface }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="chatbubbles" size={64} color={theme.primary} />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>MrEnglish</Text>
          <Text style={[styles.appVersion, { color: theme.textSecondary }]}>
            Version {packageData.version}
          </Text>
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            MrEnglish helps you build speaking confidence through real-time practice with tutors and AI. 
            Practice English conversation, improve your pronunciation, and connect with language learners from around the world.
          </Text>
        </View>

        {/* Features Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Key Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="people" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                Practice with real partners
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="mic" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                Voice and video calls
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                AI-powered practice sessions
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="chatbubbles" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                Real-time messaging
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="trophy" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                Track your progress
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="globe" size={20} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                Multiple language support
              </Text>
            </View>
          </View>
        </View>

        {/* App Info Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>App Name:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{packageData.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Version:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{packageData.version}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Platform:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>React Native</Text>
          </View>
        </View>

        {/* Contact Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Us</Text>
          <Text style={[styles.description, { color: theme.textSecondary, marginBottom: 16 }]}>
            Have questions or feedback? We'd love to hear from you!
          </Text>
          
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
            onPress={handleEmailPress}
          >
            <Ionicons name="mail" size={20} color={theme.primary} />
            <Text style={[styles.contactButtonText, { color: theme.primary }]}>
              support@mrenglish.app
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30', marginTop: 12 }]}
            onPress={handleWebsitePress}
          >
            <Ionicons name="globe" size={20} color={theme.primary} />
            <Text style={[styles.contactButtonText, { color: theme.primary }]}>
              Visit Our Website
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textTertiary }]}>
            © 2024 MrEnglish. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  featureList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6F0',
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
});

export default AboutScreen;







