import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { theme } from '../theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Input } from '../components/common/Input';
import { authStorage } from '../services/storage';

export const MoreScreen: React.FC = () => {
  const {
    user,
    logout,
    biometricsEnabled,
    toggleBiometrics,
    biometricStatus,
  } = useAuth();

  const {
    pendingCount,
    isSyncing,
    queueItems,
    syncNow,
    retryFailed,
    refreshQueue,
  } = useOffline();

  const [serverUrl, setServerUrl] = useState<string>('');
  const [isEditingServer, setIsEditingServer] = useState<boolean>(false);

  React.useEffect(() => {
    authStorage.getServerUrl().then(setServerUrl);
  }, []);

  const handleSaveServer = async () => {
    if (!serverUrl.trim()) return;
    await authStorage.setServerUrl(serverUrl);
    setIsEditingServer(false);
    Alert.alert('Server Configured', `Connected to: ${serverUrl}`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Sign Out',
      'Are you sure you want to log out of the RSG Guard Terminal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Officer Terminal" subtitle="Profile & Offline Management" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Digital Employee ID Badge Card */}
        <Card style={styles.idCard}>
          {/* Card Top Strip */}
          <View style={styles.idCardHeader}>
            <View style={styles.idCardBrand}>
              <View style={styles.idCardLogo}>
                <MaterialCommunityIcons name="shield-check" size={20} color={theme.colors.textOnPrimary} />
              </View>
              <View>
                <Text style={styles.idCardCompany}>REGION SECURITY GUARDING</Text>
                <Text style={styles.idCardSub}>OFFICIAL CREDENTIAL BADGE</Text>
              </View>
            </View>

            <Badge label="VERIFIED" variant="success" />
          </View>

          {/* Security Hologram Strip Effect */}
          <View style={styles.hologramStrip}>
            <Text style={styles.hologramText}>
              • RSG SECURE OPERATIONAL IDENTITY • RSG SECURE OPERATIONAL IDENTITY •
            </Text>
          </View>

          {/* Officer Details Grid */}
          <View style={styles.idBody}>
            {/* Officer Avatar / Photo Placeholder */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={54} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.idBadgeNumber}>
                {user?.id_number || 'SIA-RSG-2026'}
              </Text>
            </View>

            <View style={styles.idDetails}>
              <Text style={styles.officerName}>{user?.name || 'Security Officer'}</Text>
              <Text style={styles.officerRole}>
                {user?.role === 'manager' ? 'Operations Manager' : 'Frontline Guard Officer'}
              </Text>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Assigned Branch:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {user?.branch?.name || user?.branch_name || 'Central London Hub'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Official Email:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Security Status:</Text>
                <Text style={[styles.detailValue, { color: theme.colors.success }]}>
                  ACTIVE LICENSED
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Offline Queue Management Section */}
        <Card style={styles.sectionCard} highlightBorder>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="database-sync" size={20} color={theme.colors.text} />
              <Text style={styles.sectionTitle}>Offline Queue Storage</Text>
            </View>
            <Badge
              label={pendingCount > 0 ? `${pendingCount} Pending` : 'All Synced'}
              variant={pendingCount > 0 ? 'warning' : 'synced'}
            />
          </View>

          <Text style={styles.sectionDescription}>
            Attendance and patrol scans are stored locally in SQLite whenever network drops. Offline items are never marked as verified until acknowledged by server.
          </Text>

          <View style={styles.syncActionsRow}>
            <Button
              title={isSyncing ? 'Synchronizing...' : 'Sync Queue Now'}
              onPress={syncNow}
              isLoading={isSyncing}
              size="md"
              variant="primary"
              style={{ flex: 1 }}
              leftIcon={<MaterialCommunityIcons name="cloud-upload" size={18} color="#fff" />}
            />
            <Button
              title="Refresh"
              onPress={refreshQueue}
              size="md"
              variant="secondary"
              leftIcon={<MaterialCommunityIcons name="refresh" size={18} color="#fff" />}
            />
          </View>

          {/* Queue Item List */}
          <View style={styles.queueListContainer}>
            <Text style={styles.queueListTitle}>Recent Queue Actions ({queueItems.length}):</Text>

            {queueItems.length === 0 ? (
              <Text style={styles.emptyQueueText}>SQLite queue is clear. No offline transactions.</Text>
            ) : (
              queueItems.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.queueItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.queueActionType}>
                      {item.action_type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.queueTime}>
                      {new Date(item.created_at).toLocaleTimeString()} • ID: {item.request_id.slice(0, 8)}...
                    </Text>
                    {item.last_error && (
                      <Text style={styles.queueError}>Err: {item.last_error}</Text>
                    )}
                  </View>

                  <Badge
                    label={item.status === 'synced' ? 'Synced' : item.status === 'failed' ? 'Failed' : 'Pending'}
                    variant={item.status === 'synced' ? 'synced' : item.status === 'failed' ? 'danger' : 'pending'}
                  />
                </View>
              ))
            )}
          </View>
        </Card>

        {/* Device & Security Preferences Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Hardware</Text>

          {/* Biometrics Toggle */}
          <View style={styles.preferenceRow}>
            <View style={styles.prefTextCol}>
              <Text style={styles.prefLabel}>
                {biometricStatus.biometryType === 'FaceID'
                  ? 'Face ID Quick Unlock'
                  : 'Biometric Touch Unlock'}
              </Text>
              <Text style={styles.prefSubtitle}>
                {biometricStatus.isAvailable
                  ? 'Fast authentication without entering password'
                  : 'Hardware biometrics not supported or not enrolled on device'}
              </Text>
            </View>

            <Switch
              value={biometricsEnabled}
              onValueChange={toggleBiometrics}
              disabled={!biometricStatus.isAvailable}
              thumbColor={biometricsEnabled ? theme.colors.primary : theme.colors.borderLight}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryMuted,
              }}
            />
          </View>

          {/* Server Connection Endpoint */}
          <View style={[styles.preferenceRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.prefTextCol}>
              <Text style={styles.prefLabel}>Backend Server URL</Text>
              <Text style={styles.prefSubtitle}>{serverUrl || 'Default host'}</Text>
            </View>

            <Button
              title={isEditingServer ? 'Close' : 'Change'}
              onPress={() => setIsEditingServer(!isEditingServer)}
              size="sm"
              variant="secondary"
            />
          </View>

          {isEditingServer && (
            <View style={styles.serverEditBox}>
              <Input
                label="Host Address"
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.0.2.2:4000"
                autoCapitalize="none"
              />
              <Button
                title="Save & Connect"
                onPress={handleSaveServer}
                size="sm"
                variant="primary"
              />
            </View>
          )}
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out of Terminal"
          onPress={handleLogout}
          variant="outline"
          size="lg"
          leftIcon={<MaterialCommunityIcons name="logout" size={20} color={theme.colors.danger} />}
          textStyle={{ color: theme.colors.danger }}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.xxl,
  },
  idCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: '#2b2b2b',
    borderColor: '#4d4d4d',
    borderWidth: 1.5,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.base,
  },
  idCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.backgroundDarker,
  },
  idCardBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  idCardLogo: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idCardCompany: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  idCardSub: {
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 0.8,
  },
  hologramStrip: {
    backgroundColor: 'rgba(235, 5, 5, 0.18)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(235, 5, 5, 0.3)',
    paddingVertical: 3,
    overflow: 'hidden',
  },
  hologramText: {
    fontSize: 9,
    color: '#ff6666',
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  idBody: {
    flexDirection: 'row',
    padding: theme.spacing.base,
    gap: theme.spacing.base,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 96,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idBadgeNumber: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  idDetails: {
    flex: 1,
  },
  officerName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  officerRole: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  detailItem: {
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 10,
    color: theme.colors.textDim,
  },
  detailValue: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.text,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: theme.spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sectionDescription: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  syncActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  queueListContainer: {
    backgroundColor: theme.colors.backgroundDarker,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  queueListTitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyQueueText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  queueItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  queueActionType: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  queueTime: {
    fontSize: 10,
    color: theme.colors.textDim,
  },
  queueError: {
    fontSize: 10,
    color: theme.colors.danger,
    marginTop: 2,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  prefTextCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  prefLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  prefSubtitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  serverEditBox: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.backgroundDarker,
    borderRadius: theme.borderRadius.sm,
  },
  logoutBtn: {
    marginTop: theme.spacing.sm,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
});
