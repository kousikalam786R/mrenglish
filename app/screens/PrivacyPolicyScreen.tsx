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

type PrivacyNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation<PrivacyNavigationProp>();
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
          {t('settings.privacyPolicy')}
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
          <Text style={[styles.title, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>Last updated: January 2024</Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Introduction</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              MrEnglish ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Information We Collect</Text>
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>2.1 Personal Information</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We may collect personal information that you provide to us, including:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Name and email address{'\n'}
              • Profile picture and bio{'\n'}
              • Age, gender, and location{'\n'}
              • Language preferences and learning goals
            </Text>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>2.2 Usage Information</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We automatically collect information about how you use the App, including:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Practice sessions and call history{'\n'}
              • Interaction data and feedback{'\n'}
              • Device information and identifiers{'\n'}
              • Log data and error reports
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>3. How We Use Your Information</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We use the information we collect to:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Provide and maintain the App{'\n'}
              • Match you with practice partners{'\n'}
              • Personalize your learning experience{'\n'}
              • Send you notifications and updates{'\n'}
              • Improve our services and develop new features{'\n'}
              • Detect and prevent fraud or abuse{'\n'}
              • Comply with legal obligations
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Information Sharing</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We do not sell your personal information. We may share your information only in the following circumstances:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • With other users as part of the service (e.g., profile matching){'\n'}
              • With service providers who assist us in operating the App{'\n'}
              • When required by law or to protect our rights{'\n'}
              • In connection with a business transfer or merger
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Data Security</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Your Rights</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              You have the right to:
            </Text>
            <Text style={[styles.listItem, { color: theme.textSecondary }]}>
              • Access and update your personal information{'\n'}
              • Delete your account and associated data{'\n'}
              • Opt-out of certain communications{'\n'}
              • Request a copy of your data{'\n'}
              • Object to processing of your information
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>7. Children's Privacy</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              The App is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>8. International Data Transfers</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ from those in your jurisdiction.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>9. Changes to This Policy</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>10. Contact Us</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              If you have any questions about this Privacy Policy, please contact us at:{'\n\n'}
              Email: privacy@mrenglish.app{'\n'}
              Address: MrEnglish Support Team
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
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
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

export default PrivacyPolicyScreen;







