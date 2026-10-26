import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Input } from '../components/common/Input';
import { theme } from '../theme';
import { api } from '../services/api';
import { locationService } from '../services/location';
import { generateRequestId } from '../utils/uuid';
import { PatrolScanResult } from '../types/patrol';

interface ScanLogEntry {
  id: string;
  tokenPreview: string;
  timestamp: string;
  status: 'synced' | 'pending';
  isAnomaly: boolean;
  anomalyReason?: string | null;
}

export const PatrolScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [recentScans, setRecentScans] = useState<ScanLogEntry[]>([]);
  const [manualToken, setManualToken] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [lastScanResult, setLastScanResult] = useState<PatrolScanResult | null>(null);

  const processPatrolToken = async (rawToken: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Acquire current GPS position
      const loc = await locationService.getCurrentPosition();
      const requestId = generateRequestId();

      // 2. Submit to backend patrol scanner
      const result = await api.scanPatrolQr({
        token: rawToken.trim(),
        lat: loc.lat,
        lng: loc.lng,
        accuracy_m: loc.accuracy_m,
        device_time: loc.device_time,
        request_id: requestId,
      });

      const isOfflineResult = 'isOffline' in result && result.isOffline;
      const scanData: Partial<PatrolScanResult> = 'data' in result ? (result.data as PatrolScanResult) : (result as PatrolScanResult);

      setLastScanResult(scanData as PatrolScanResult);

      const logItem: ScanLogEntry = {
        id: requestId,
        tokenPreview: rawToken.slice(0, 16) + '...',
        timestamp: new Date().toLocaleTimeString(),
        status: isOfflineResult ? 'pending' : 'synced',
        isAnomaly: scanData.is_anomaly || false,
        anomalyReason: scanData.anomaly_reason,
      };

      setRecentScans((prev) => [logItem, ...prev.slice(0, 9)]);

      if (isOfflineResult) {
        Alert.alert(
          'Scan Enqueued Offline',
          'Patrol checkpoint scan saved locally with GPS and UTC timestamp. Will sync automatically when connection is restored.'
        );
      } else if (scanData.is_anomaly) {
        Alert.alert(
          'Scan Recorded with Anomaly Warning',
          `Checkpoint scanned successfully, but flagged as anomaly: ${scanData.anomaly_reason || 'Rapid duplicate scan or out of perimeter'}.`
        );
      } else {
        Alert.alert('Checkpoint Verified', 'Patrol checkpoint recorded and validated in real time.');
      }
    } catch (err: any) {
      Alert.alert('Patrol Scan Failed', err.message || 'Unable to verify patrol checkpoint.');
    } finally {
      setIsProcessing(false);
      // Wait 3 seconds before allowing next scan to prevent rapid spam
      setTimeout(() => {
        setScanned(false);
      }, 3000);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    processPatrolToken(data);
  };

  const handleManualSubmit = () => {
    if (!manualToken.trim()) {
      Alert.alert('Input Error', 'Please enter a signed QR patrol token.');
      return;
    }
    processPatrolToken(manualToken);
    setManualToken('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="QR Patrol Scanner"
        subtitle="Signed Token Verification"
        onPressQueue={() => navigation.navigate('More')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Camera Scanner Viewfinder */}
        <Card style={styles.scannerCard}>
          <View style={styles.viewfinderContainer}>
            {Platform.OS === 'web' ? (
              <View style={styles.webFallbackContainer}>
                <MaterialCommunityIcons name="qrcode-scan" size={64} color={theme.colors.primary} />
                <Text style={styles.webFallbackTitle}>Camera Viewfinder</Text>
                <Text style={styles.webFallbackSubtitle}>
                  Camera scanner is active on mobile devices. Use manual token input below to test patrol scans.
                </Text>
              </View>
            ) : !permission ? (
              <ActivityIndicator color={theme.colors.primary} size="large" />
            ) : !permission.granted ? (
              <View style={styles.permissionContainer}>
                <MaterialCommunityIcons name="camera-off" size={48} color={theme.colors.warning} />
                <Text style={styles.permissionText}>Camera permission required for QR scanning.</Text>
                <Button
                  title="Grant Camera Access"
                  onPress={requestPermission}
                  size="sm"
                  variant="primary"
                  style={{ marginTop: theme.spacing.sm }}
                />
              </View>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              >
                {/* Viewfinder Target Reticle */}
                <View style={styles.reticleOverlay}>
                  <View style={styles.reticleFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                  <Text style={styles.reticleHint}>Align QR Code inside targeting frame</Text>
                </View>
              </CameraView>
            )}

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color={theme.colors.primary} size="large" />
                <Text style={styles.processingText}>Verifying HMAC signature & GPS...</Text>
              </View>
            )}
          </View>

          {/* Toggle Manual Input */}
          <TouchableOpacity
            style={styles.manualToggle}
            onPress={() => setShowManualInput(!showManualInput)}
          >
            <MaterialCommunityIcons name="keyboard-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.manualToggleText}>
              {showManualInput ? 'Hide Manual Token Entry' : 'Manual / Demo Token Entry'}
            </Text>
          </TouchableOpacity>

          {showManualInput && (
            <View style={styles.manualInputSection}>
              <Input
                label="Signed Checkpoint Token"
                placeholder="Paste signed patrol token payload..."
                value={manualToken}
                onChangeText={setManualToken}
                autoCapitalize="none"
              />
              <Button
                title="Verify & Submit Checkpoint"
                onPress={handleManualSubmit}
                isLoading={isProcessing}
                variant="primary"
                size="md"
              />
            </View>
          )}
        </Card>

        {/* Recent Scans Log Section */}
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <MaterialCommunityIcons name="history" size={18} color={theme.colors.text} />
              <Text style={styles.historyTitle}>Recent Patrol Checkpoints</Text>
            </View>
            <Text style={styles.historyCount}>{recentScans.length} recorded</Text>
          </View>

          {recentScans.length === 0 ? (
            <View style={styles.noHistoryBox}>
              <MaterialCommunityIcons name="barcode-scan" size={32} color={theme.colors.textDim} />
              <Text style={styles.noHistoryText}>No checkpoint scans recorded in this session.</Text>
            </View>
          ) : (
            recentScans.map((scan) => (
              <View key={scan.id} style={styles.scanLogItem}>
                <View style={styles.scanLogLeft}>
                  <Text style={styles.scanToken}>{scan.tokenPreview}</Text>
                  <Text style={styles.scanTime}>{scan.timestamp}</Text>
                  {scan.isAnomaly && (
                    <Text style={styles.scanAnomalyReason}>
                      ⚠️ Anomaly: {scan.anomalyReason || 'Rapid scan'}
                    </Text>
                  )}
                </View>

                <View style={styles.scanLogRight}>
                  <Badge
                    label={scan.status === 'synced' ? 'Synced' : 'Pending'}
                    variant={scan.status === 'synced' ? 'synced' : 'pending'}
                  />
                  {scan.isAnomaly && (
                    <Badge label="Anomaly" variant="danger" style={{ marginTop: 4 }} />
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
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
  scannerCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: theme.spacing.base,
  },
  viewfinderContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  reticleFrame: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: theme.colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  reticleHint: {
    color: '#ffffff',
    fontSize: theme.typography.fontSizes.xs,
    marginTop: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  processingText: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
  },
  permissionContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  permissionText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.sm,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  webFallbackContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  webFallbackTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  webFallbackSubtitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: theme.spacing.md,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  manualToggleText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  manualInputSection: {
    padding: theme.spacing.base,
    backgroundColor: theme.colors.backgroundDarker,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  historyCard: {
    marginBottom: theme.spacing.base,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  historyCount: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
  },
  noHistoryBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: 6,
  },
  noHistoryText: {
    color: theme.colors.textDim,
    fontSize: theme.typography.fontSizes.xs,
  },
  scanLogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scanLogLeft: {
    flex: 1,
  },
  scanToken: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  scanTime: {
    color: theme.colors.textDim,
    fontSize: theme.typography.fontSizes.xs,
    marginTop: 2,
  },
  scanAnomalyReason: {
    color: theme.colors.danger,
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  scanLogRight: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing.sm,
  },
});
