import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { theme } from '../theme';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Header } from '../components/common/Header';
import { api } from '../services/api';
import { offlineDb } from '../services/database';
import {
  locationService,
  LocationSnapshot,
  GeofenceCheckResult,
  calculateHaversineDistanceMeters,
} from '../services/location';
import { generateRequestId } from '../utils/uuid';
import { Shift, RotaItem, Branch } from '../types/shift';
import { AttendanceRecord } from '../types/attendance';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { pendingCount, isSyncing, syncNow } = useOffline();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<Partial<AttendanceRecord> | null>(null);
  const [isClockedIn, setIsClockedIn] = useState<boolean>(false);
  const [isAttendancePending, setIsAttendancePending] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Live Location State
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceCheckResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Load shift data & cached attendance
  const loadShiftData = async () => {
    try {
      // 1. Check cached active attendance
      const cached = await offlineDb.getCache<Partial<AttendanceRecord>>('active_attendance');
      if (cached && cached.status === 'in_progress') {
        setCurrentAttendance(cached);
        setIsClockedIn(true);
        if (cached.check_in_time) {
          const startMs = new Date(cached.check_in_time).getTime();
          const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          setElapsedSeconds(diff);
        }
      } else {
        setCurrentAttendance(null);
        setIsClockedIn(false);
      }

      // 2. Fetch today's assigned rota
      const rota = await api.getMyRota();
      if (rota && rota.length > 0) {
        // Take earliest today or first assigned shift
        setActiveShift(rota[0].shift);
      } else if (user?.branch) {
        // Fallback default shift using user's branch
        setActiveShift({
          id: 'shift-default',
          branch_id: user.branch.id,
          name: 'Scheduled Branch Duty',
          start_time: '08:00',
          end_time: '16:00',
          check_type: 'gps',
          overtime_enabled: true,
          overtime_limit_hours: 4,
          lunch_deduction_minutes: 30,
          is_active: true,
          branch: {
            ...user.branch,
            is_active: user.branch.is_active ?? true,
          },
        });
      }
    } catch {
      // Offline fallback: check cached rota
      const cachedRota = await offlineDb.getCache<RotaItem[]>('my_rota');
      if (cachedRota && cachedRota.length > 0) {
        setActiveShift(cachedRota[0].shift);
      }
    }
  };

  // Acquire live GPS position
  const refreshLocation = async () => {
    setLocationError(null);
    try {
      const pos = await locationService.getCurrentPosition();
      setLocationSnapshot(pos);

      const targetBranch = activeShift?.branch || (user?.branch ? { ...user.branch, is_active: user.branch.is_active ?? true } : undefined);
      if (targetBranch) {
        const check = locationService.checkGeofence(pos, targetBranch);
        setGeofenceResult(check);
      }
    } catch (err: any) {
      setLocationError(err.message || 'GPS location error');
      setLocationSnapshot(null);
      setGeofenceResult(null);
    }
  };

  useEffect(() => {
    loadShiftData();
    refreshLocation();
  }, [user]);

  // Live timer tick when clocked in
  useEffect(() => {
    if (isClockedIn) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isClockedIn]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadShiftData(), refreshLocation(), syncNow()]);
    setRefreshing(false);
  };

  const formatTimer = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleClockToggle = async () => {
    if (!activeShift) {
      Alert.alert('No Shift Assigned', 'You do not currently have a shift assigned to clock in/out.');
      return;
    }

    setIsActionLoading(true);

    try {
      // 1. Get GPS coordinates
      const loc = await locationService.getCurrentPosition();
      setLocationSnapshot(loc);

      const branch: Branch | undefined = activeShift.branch || (user?.branch ? { ...user.branch, is_active: user.branch.is_active ?? true } : undefined);
      if (!branch) {
        Alert.alert('Branch Error', 'Assigned branch details not available.');
        setIsActionLoading(false);
        return;
      }

      // Check geofence
      const geofence = locationService.checkGeofence(loc, branch);
      setGeofenceResult(geofence);

      if (!geofence.isWithinGeofence && activeShift.check_type === 'gps') {
        Alert.alert(
          'Geofence Violation',
          geofence.errorMessage ||
            `You must be within ${branch.radius_m}m of ${branch.name}. Current distance: ${geofence.distanceMeters}m.`
        );
        setIsActionLoading(false);
        return;
      }

      const requestId = generateRequestId();

      if (!isClockedIn) {
        // Clock In
        const result = await api.checkIn({
          shift_id: activeShift.id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy_m: loc.accuracy_m,
          device_time: loc.device_time,
          method: 'gps',
          request_id: requestId,
        });

        setIsClockedIn(true);
        const recordData = 'data' in result ? (result.data as Partial<AttendanceRecord>) : result;
        setCurrentAttendance(recordData);

        if ('isOffline' in result && result.isOffline) {
          setIsAttendancePending(true);
          Alert.alert(
            'Clock-In Saved Offline',
            'No connection to RSG server. Your clock-in has been saved securely to the offline queue with UTC timestamp and will sync once connection resumes.'
          );
        } else {
          setIsAttendancePending(false);
          Alert.alert('Shift Started', `Clocked into ${activeShift.name} successfully.`);
        }
      } else {
        // Clock Out
        const result = await api.checkOut({
          shift_id: activeShift.id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy_m: loc.accuracy_m,
          device_time: loc.device_time,
          method: 'gps',
          request_id: requestId,
        });

        setIsClockedIn(false);
        setCurrentAttendance(null);

        if ('isOffline' in result && result.isOffline) {
          Alert.alert(
            'Clock-Out Saved Offline',
            'Clock-out has been recorded locally in the offline queue and will sync automatically.'
          );
        } else {
          Alert.alert('Shift Concluded', `Successfully clocked out of ${activeShift.name}.`);
        }
      }
    } catch (err: any) {
      Alert.alert('Attendance Error', err.message || 'Operation failed. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const branch = activeShift?.branch || user?.branch;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="RSG Operations"
        subtitle={user ? `${user.name} • ${user.role.toUpperCase()}` : undefined}
        onPressQueue={() => navigation.navigate('More')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Offline Warning Banner (if queue has pending items) */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.offlineBanner}
            onPress={() => navigation.navigate('More')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="cloud-sync-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.offlineBannerText}>
              {pendingCount} offline action(s) waiting to sync. Tap to inspect.
            </Text>
            {isSyncing && (
              <Badge label="Syncing" variant="warning" />
            )}
          </TouchableOpacity>
        )}

        {/* Live Shift Card */}
        <Card style={styles.shiftCard} highlightBorder>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.shiftCardTitle}>
                {activeShift ? activeShift.name : 'No Shift Assigned'}
              </Text>
              <Text style={styles.shiftCardSubtitle}>
                {branch ? `${branch.name}` : 'Awaiting branch allocation'}
              </Text>
            </View>

            <Badge
              label={
                isClockedIn
                  ? isAttendancePending
                    ? 'Pending Sync (Offline)'
                    : 'Active On Duty'
                  : 'Off Duty'
              }
              variant={
                isClockedIn
                  ? isAttendancePending
                    ? 'pending'
                    : 'success'
                  : 'neutral'
              }
            />
          </View>

          {/* Shift Schedule Details */}
          {activeShift && (
            <View style={styles.shiftMetaGrid}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textMuted} />
                <Text style={styles.metaLabel}>Schedule:</Text>
                <Text style={styles.metaValue}>
                  {activeShift.start_time} - {activeShift.end_time}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="map-marker-radius" size={16} color={theme.colors.textMuted} />
                <Text style={styles.metaLabel}>Geofence:</Text>
                <Text style={styles.metaValue}>
                  {branch ? `${branch.radius_m}m radius` : 'N/A'}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={theme.colors.textMuted} />
                <Text style={styles.metaLabel}>Lunch break:</Text>
                <Text style={styles.metaValue}>
                  {activeShift.lunch_deduction_minutes} mins
                </Text>
              </View>

              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="shield-check" size={16} color={theme.colors.textMuted} />
                <Text style={styles.metaLabel}>Check method:</Text>
                <Text style={styles.metaValue}>
                  {activeShift.check_type.toUpperCase()}
                </Text>
              </View>
            </View>
          )}

          {/* Live Timer Section */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>
              {isClockedIn ? 'ON-DUTY DURATION (UTC)' : 'DUTY TIMER'}
            </Text>
            <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
          </View>
        </Card>

        {/* GPS Live Geofence Status Card */}
        <Card style={styles.gpsCard}>
          <View style={styles.gpsHeaderRow}>
            <View style={styles.gpsTitleRow}>
              <MaterialCommunityIcons
                name={
                  geofenceResult?.isWithinGeofence
                    ? 'crosshairs-gps'
                    : 'crosshairs-question'
                }
                size={20}
                color={
                  geofenceResult?.isWithinGeofence
                    ? theme.colors.success
                    : theme.colors.warning
                }
              />
              <Text style={styles.gpsTitle}>GPS Geofence Status</Text>
            </View>

            <TouchableOpacity onPress={refreshLocation} style={styles.refreshGpsBtn}>
              <MaterialCommunityIcons name="refresh" size={16} color={theme.colors.textMuted} />
              <Text style={styles.refreshGpsText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {locationError ? (
            <View style={styles.gpsErrorRow}>
              <MaterialCommunityIcons name="alert" size={18} color={theme.colors.danger} />
              <Text style={styles.gpsErrorText}>{locationError}</Text>
            </View>
          ) : locationSnapshot && branch ? (
            <View style={styles.gpsInfoGrid}>
              <View style={styles.gpsInfoItem}>
                <Text style={styles.gpsInfoLabel}>Distance from site:</Text>
                <Text
                  style={[
                    styles.gpsInfoValue,
                    geofenceResult?.isWithinGeofence
                      ? { color: theme.colors.success }
                      : { color: theme.colors.danger },
                  ]}
                >
                  {geofenceResult?.distanceMeters ?? '...'}m (Max {branch.radius_m}m)
                </Text>
              </View>

              <View style={styles.gpsInfoItem}>
                <Text style={styles.gpsInfoLabel}>GPS Accuracy:</Text>
                <Text style={styles.gpsInfoValue}>
                  ±{locationSnapshot.accuracy_m}m
                </Text>
              </View>

              <View style={styles.gpsInfoItem}>
                <Text style={styles.gpsInfoLabel}>Geofence Status:</Text>
                <Badge
                  label={geofenceResult?.isWithinGeofence ? 'Inside Site Radius' : 'Outside Boundary'}
                  variant={geofenceResult?.isWithinGeofence ? 'success' : 'danger'}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.gpsLoadingText}>Acquiring high-accuracy satellite fix...</Text>
          )}
        </Card>

        {/* Big Red Clock In / Clock Out Button */}
        <View style={styles.clockButtonContainer}>
          <Button
            title={isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}
            onPress={handleClockToggle}
            variant={isClockedIn ? 'danger' : 'clock'}
            size="giant"
            isLoading={isActionLoading}
            leftIcon={
              <MaterialCommunityIcons
                name={isClockedIn ? 'logout-variant' : 'login-variant'}
                size={28}
                color={theme.colors.textOnPrimary}
              />
            }
            style={styles.giantClockBtn}
          />
          <Text style={styles.clockButtonHint}>
            {isClockedIn
              ? 'Tap to conclude duty & calculate overtime / lunch deduction'
              : 'Tap to clock in at current GPS coordinates (idempotent UTC sync)'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background, // #333333 per AGENTS.md
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.xxl,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningBg,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  offlineBannerText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
  },
  shiftCard: {
    marginBottom: theme.spacing.base,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  shiftCardTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '800',
    color: theme.colors.text,
  },
  shiftCardSubtitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  shiftMetaGrid: {
    backgroundColor: theme.colors.backgroundDarker,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.xs,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '600',
  },
  timerContainer: {
    backgroundColor: theme.colors.backgroundDarker,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timerLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  timerText: {
    fontSize: theme.typography.fontSizes.hero,
    fontWeight: '900',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  gpsCard: {
    marginBottom: theme.spacing.xl,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  gpsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshGpsText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  gpsErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  gpsErrorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.fontSizes.xs,
    flex: 1,
  },
  gpsInfoGrid: {
    gap: 6,
  },
  gpsInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsInfoLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  gpsInfoValue: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  gpsLoadingText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    fontStyle: 'italic',
  },
  clockButtonContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  giantClockBtn: {
    width: '100%',
  },
  clockButtonHint: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
  },
});
