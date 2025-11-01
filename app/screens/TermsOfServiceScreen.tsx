import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

type TermsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TermsOfServiceScreen = () => {
  const navigation = useNavigation<TermsNavigationProp>();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

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
          {t('settings.termsOfService')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.surface }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Terms of Service</Text>
          <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>Last updated: January 2024</Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Acceptance of Terms</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              By accessing and using the MrEnglish mobile application ("App"), you accept and agree to be bound by the terms and provision of this agreement.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Use License</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Permission is granted to temporarily download one copy of MrEnglish for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Modify or copy the materials{'\n'}
              • Use the materials for any commercial purpose{'\n'}
              • Attempt to decompile or reverse engineer any software{'\n'}
              • Remove any copyright or other proprietary notations
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>3. User Accounts</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>4. User Conduct</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              You agree not to use the App to:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Harass, abuse, or harm other users{'\n'}
              • Post inappropriate, offensive, or illegal content{'\n'}
              • Violate any applicable laws or regulations{'\n'}
              • Impersonate any person or entity{'\n'}
              • Interfere with the operation of the App
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Privacy Policy</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Your use of the App is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your information.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Intellectual Property</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              The App and its original content, features, and functionality are owned by MrEnglish and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>7. Termination</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We may terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>8. Limitation of Liability</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              In no event shall MrEnglish, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>9. Changes to Terms</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>10. Contact Information</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              If you have any questions about these Terms of Service, please contact us at support@mrenglish.app
            </Text>
          </View>
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
  contentCard: {
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 24,
    marginLeft: 8,
    marginTop: 8,
  },
});

export default TermsOfServiceScreen;


