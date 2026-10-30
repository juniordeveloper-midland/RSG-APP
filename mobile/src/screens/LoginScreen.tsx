import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authStorage } from '../services/storage';
import { API_URL } from '../config';
import { pingBaseUrl } from '../api/client';

export const LoginScreen: React.FC = () => {
  const {
    login,
    loginWithBiometrics,
    biometricStatus,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [connTesting, setConnTesting] = useState(false);
  const [connMessage, setConnMessage] = useState<string | null>(null);
  const [connOk, setConnOk] = useState<boolean | null>(null);

  useEffect(() => {
    authStorage.getServerUrl().then(setServerUrl);
  }, []);

  // Biometric unlock is OPTIONAL and manual-only: it is never auto-triggered
  // on mount, so it can never block normal email/password login.
  const handleBiometricUnlock = async () => {
    setErrorMessage(null);
    await loginWithBiometrics();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const code: string | undefined = err?.code;

      // Timeout / unreachable (no response): tell the user exactly which URL
      // we tried so they can fix Wi-Fi or the API URL in settings.
      if (
        err?.isTimeout ||
        err?.isNetworkError ||
        status === 0 ||
        code === 'NETWORK_ERROR' ||
        code === 'TIMEOUT'
      ) {
        setErrorMessage(
          `Cannot reach server at ${serverUrl || API_URL}. Check Wi-Fi and API URL.`
        );
      } else if (status === 401) {
        setErrorMessage('Invalid email or password.');
      } else if (status === 403) {
        // Suspended account (or other 403) – show the backend's own message.
        setErrorMessage(
          err?.message ||
            'This account has been suspended. Please contact operations management.'
        );
      } else {
        // Any other error – surface status + message for diagnostics.
        setErrorMessage(
          `Error ${status ?? 'unknown'}: ${err?.message || 'Login failed. Please try again.'}`
        );
      }
    } finally {
      // ALWAYS release the spinner, even on unhandled rejection paths.
      setIsLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleSaveServerUrl = async () => {
    await authStorage.setServerUrl(serverUrl);
    setShowServerConfig(false);
    Alert.alert('Server Configured', `API URL updated to: ${serverUrl}`);
  };

  // Probe GET <baseURL>/health with a 5s timeout and surface a themed result
  // ("Server reachable" or "Cannot reach <URL>").
  const handleTestConnection = async () => {
    const target = (serverUrl || API_URL).replace(/\/+$/, '');
    setConnTesting(true);
    setConnMessage(null);
    setConnOk(null);
    try {
      await pingBaseUrl(target, 5000);
      setConnOk(true);
      setConnMessage('Server reachable');
    } catch {
      setConnOk(false);
      setConnMessage(`Cannot reach ${target}`);
    } finally {
      setConnTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/rsg-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>REGION SECURITY GUARDING</Text>
            <Text style={styles.appTagline}>Guard Patrol & Attendance Terminal</Text>
          </View>

          {/* Login Card */}
          <Card style={styles.card} highlightBorder>
            <Text style={styles.cardTitle}>Officer Authentication</Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Input
              label="Employee Email"
              placeholder="guard1@region.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon={<MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textMuted} />}
            />

            <Button
              title="Sign In to Guard App"
              onPress={handleLogin}
              variant="primary"
              size="lg"
              isLoading={isLoading}
              style={styles.loginButton}
            />

            {/* Biometric Unlock Option */}
            {biometricStatus.isAvailable && (
              <Button
                title={
                  biometricStatus.biometryType === 'FaceID'
                    ? 'Unlock with Face ID'
                    : 'Unlock with Biometrics'
                }
                onPress={handleBiometricUnlock}
                variant="outline"
                size="md"
                leftIcon={
                  <MaterialCommunityIcons
                    name={biometricStatus.biometryType === 'FaceID' ? 'face-recognition' : 'fingerprint'}
                    size={22}
                    color={theme.colors.text}
                  />
                }
                style={styles.biometricButton}
              />
            )}

            {/* Quick Demo Fill Pills */}
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Quick Demo Sign In:</Text>
              <View style={styles.demoPillsRow}>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => fillDemo('guard1@region.com', 'Guard123!')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoPillText}>Guard 1</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => fillDemo('guard2@region.com', 'Guard123!')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoPillText}>Guard 2</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => fillDemo('manager@region.com', 'Manager123!')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoPillText}>Manager</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Server Config Toggle */}
          <TouchableOpacity
            style={styles.serverConfigToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <MaterialCommunityIcons name="server-network" size={16} color={theme.colors.textDim} />
            <Text style={styles.serverConfigToggleText}>
              Backend: {serverUrl || 'Default'}
            </Text>
          </TouchableOpacity>

          {/* Dev-only: show the active API URL so the login target is visible. */}
          {__DEV__ && (
            <Text style={styles.debugText}>[DEV] API URL: {serverUrl || API_URL}</Text>
          )}

          {/* Test connection: probe GET <baseURL>/health with a 5s timeout. */}
          <View style={styles.testConnRow}>
            <Button
              title="Test connection"
              onPress={handleTestConnection}
              variant="outline"
              size="sm"
              isLoading={connTesting}
              leftIcon={<MaterialCommunityIcons name="lan-connect" size={18} color={theme.colors.text} />}
            />
          </View>

          {connMessage && (
            <View
              style={[
                styles.connResultBox,
                connOk ? styles.connResultOk : styles.connResultFail,
              ]}
            >
              <MaterialCommunityIcons
                name={connOk ? 'check-circle' : 'alert-circle'}
                size={16}
                color={connOk ? theme.colors.success : theme.colors.danger}
              />
              <Text
                style={[
                  styles.connResultText,
                  { color: connOk ? theme.colors.success : theme.colors.danger },
                ]}
              >
                {connMessage}
              </Text>
            </View>
          )}

          {showServerConfig && (
            <Card style={styles.serverConfigCard}>
              <Input
                label="Backend API Host URL"
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.0.2.2:4000"
                autoCapitalize="none"
              />
              <Button
                title="Save Server Address"
                onPress={handleSaveServerUrl}
                size="sm"
                variant="secondary"
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background, // #333333 per AGENTS.md
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.base,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: theme.spacing.md,
    // subtle red glow on Android via elevation, iOS via shadow
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  appName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerBg,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.fontSizes.xs,
    lineHeight: 16,
  },
  loginButton: {
    marginTop: theme.spacing.sm,
  },
  biometricButton: {
    marginTop: theme.spacing.md,
  },
  demoSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  demoTitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    marginBottom: theme.spacing.xs,
  },
  demoPillsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  demoPill: {
    flex: 1,
    backgroundColor: theme.colors.backgroundDarker,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  demoPillText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  serverConfigToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
  },
  serverConfigToggleText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
  },
  debugText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testConnRow: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  connResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
  },
  connResultOk: {
    backgroundColor: theme.colors.successBg,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  connResultFail: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  connResultText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.xs,
    lineHeight: 16,
  },
  serverConfigCard: {
    marginTop: theme.spacing.sm,
  },
});
