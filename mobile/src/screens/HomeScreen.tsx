import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
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
  LocationServiceError,
  LocationErrorType,
} from '../services/location';
import { generateRequestId } from '../utils/uuid';
import { Shift, RotaItem, Branch } from '../types/shift';
import { AttendanceRecord } from '../types/attendance';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { pendingCount, isSyncing, syncNow } = useOffline();

  const [rotaList, setRotaList] = useState<RotaItem[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
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
  const [locationErrorType, setLocationErrorType] = useState<LocationErrorType | null>(null);

  const timerRef = useRef<any>(null);

  // 1. Load shift data & ask server for active attendance
  const loadShiftData = async () => {
    setServerError(null);
    try {
        // Step A: Ask server if this guard is currently checked in
        let activeAtt: any = null;
        try {
          activeAtt = await api.getCurrentAttendance();
        } catch (attErr: any) {
          // Fall back to offline cached attendance if network error
          activeAtt = await offlineDb.getCache<Partial<AttendanceRecord>>('active_attendance');
        }

        if (activeAtt && (activeAtt.status === 'checked_in' || activeAtt.status === 'in_progress')) {
          setCurrentAttendance(activeAtt);
          setIsClockedIn(true);
            if (activeAtt.shift) {
              setActiveShift(activeAtt.shift);
            }
          } else {
            setCurrentAttendance(null);
            setIsClockedIn(false);
          }

          // Step B: Fetch assigned rota from server
          const rota = await api.getMyRota();
          setRotaList(rota);

          if (rota && rota.length > 0) {
            const todayStr = new Date().toISOString().slice(0, 10);
            // Find shift assigned for today
            const todayItem = rota.find((r) => {
              const start = String(r.start_date || '').slice(0, 10);
              const end = r.end_date ? String(r.end_date).slice(0, 10) : null;
              const isExcluded = Boolean(r.excluded_dates?.includes(todayStr));
              return start <= todayStr && (!end || end >= todayStr) && !isExcluded;
            });

            if (todayItem) {
              if (!activeAtt || !activeAtt.shift) {
                setActiveShift(todayItem.shift);
              }
            } else if (!activeAtt || !activeAtt.shift) {
              setActiveShift(rota[0].shift);
            }
          } else if (!activeAtt || !activeAtt.shift) {
            setActiveShift(null);
          }
        } catch (err: any) {
          setServerError(err.message || 'Failed to load shifts from server.');
          // Check offline fallback cache
          const cachedRota = await offlineDb.getCache<RotaItem[]>('my_rota');
          if (cachedRota && cachedRota.length > 0) {
            setRotaList(cachedRota);
            if (!activeShift) {
              setActiveShift(cachedRota[0].shift);
            }
          } else if (!activeShift) {
            setRotaList([]);
          }
        }
      };

      // 2. Acquire live GPS position
      const refreshLocation = async () => {
        setLocationError(null);
        setLocationErrorType(null);
        try {
          const pos = await locationService.getCurrentPosition();
          setLocationSnapshot(pos);

          const targetBranch =
            activeShift?.branch ||
            (user?.branch ? { ...user.branch, is_active: user.branch.is_active ?? true } : undefined);

          if (targetBranch) {
            const check = locationService.checkGeofence(pos, targetBranch);
            setGeofenceResult(check);
          }
        } catch (err: any) {
          if (err instanceof LocationServiceError) {
            setLocationError(err.message);
            setLocationErrorType(err.type);
          } else {
            setLocationError(err.message || 'GPS location error');
            setLocationErrorType('UNKNOWN');
          }
          setLocationSnapshot(null);
          setGeofenceResult(null);
        }
      };

      // Refresh when the screen opens / gains focus
      useFocusEffect(
        useCallback(() => {
          loadShiftData();
          refreshLocation();
        }, [user])
      );

      // 3. Live timer tick from real server check-in time, ticking every second
      useEffect(() => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          const checkInIso =
            currentAttendance?.check_in_at ||
            currentAttendance?.check_in_time ||
            currentAttendance?.device_time;

          if (isClockedIn && checkInIso) {
            const updateTimer = () => {
              const startMs = new Date(checkInIso).getTime();
              if (!isNaN(startMs)) {
                const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
                setElapsedSeconds(diff);
              }
            };

            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
          } else {
            setElapsedSeconds(0);
          }

          return () => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          };
    }, [
      isClockedIn,
      currentAttendance?.check_in_at,
      currentAttendance?.check_in_time,
      currentAttendance?.device_time,
    ]);

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
        // Stop the button from sending twice: disable it while running
        if (isActionLoading) return;

        const targetShift = activeShift || (currentAttendance as any)?.shift;
        const targetShiftId = targetShift?.id || currentAttendance?.shift_id;

        if (!isClockedIn && !targetShift) {
          Alert.alert('No Shift Assigned', 'You do not currently have a shift assigned to clock in.');
          return;
        }

        if (isClockedIn && !targetShiftId) {
          Alert.alert('Attendance Error', 'No active shift identifier found to clock out.');
          return;
        }

        setIsActionLoading(true);

        try {
          // 1. Get GPS coordinates with permission & services check
          const loc = await locationService.getCurrentPosition();
          setLocationSnapshot(loc);
          setLocationError(null);
          setLocationErrorType(null);

          const targetBranch: Branch | undefined =
            targetShift?.branch ||
            (user?.branch ? { ...user.branch, is_active: user.branch.is_active ?? true } : undefined);

          if (targetBranch) {
            const geofence = locationService.checkGeofence(loc, targetBranch);
            setGeofenceResult(geofence);

              if (!geofence.isWithinGeofence && targetShift?.check_type === 'gps') {
                const msg =
                  geofence.errorMessage ||
                  `You are ${geofence.distanceMeters} m from ${targetBranch.name}, allowed ${targetBranch.radius_m} m`;
                Alert.alert('Geofence Boundary Violation', msg);
                setIsActionLoading(false);
                return;
              }
            }

            const requestId = generateRequestId();

            if (!isClockedIn) {
              // Clock In using current high-accuracy position
              const result = await api.checkIn({
                shift_id: targetShiftId!,
                lat: loc.lat,
                lng: loc.lng,
                accuracy_m: loc.accuracy_m,
                device_time: loc.device_time,
                method: 'gps',
                request_id: requestId,
              });

              const recordData: any =
                'data' in result ? (result.data as Partial<AttendanceRecord>) : result;

              const fullRecord = {
                ...recordData,
                check_in_at: recordData.check_in_at || recordData.check_in_time || loc.device_time,
                shift: recordData.shift || targetShift,
              };

              // Update the screen straight away
              setCurrentAttendance(fullRecord);
              setIsClockedIn(true);

              if ('isOffline' in result && result.isOffline) {
                setIsAttendancePending(true);
                Alert.alert(
                  'Clock-In Saved Offline',
                  'No connection to RSG server. Your clock-in has been saved securely to the offline queue with UTC timestamp and will sync once connection resumes.'
                );
              } else {
                setIsAttendancePending(false);
                Alert.alert('Shift Started', `Clocked into ${targetShift?.name || 'shift'} successfully.`);
              }
            } else {
              // Clock Out using current high-accuracy position
              const result = await api.checkOut({
                shift_id: targetShiftId!,
                lat: loc.lat,
                lng: loc.lng,
                accuracy_m: loc.accuracy_m,
                device_time: loc.device_time,
                method: 'gps',
                request_id: requestId,
              });

              // Update the screen straight away
              setIsClockedIn(false);
              setCurrentAttendance(null);
              setElapsedSeconds(0);

              if ('isOffline' in result && result.isOffline) {
                Alert.alert(
                  'Clock-Out Saved Offline',
                  'Clock-out has been recorded locally in the offline queue and will sync automatically.'
                );
              } else {
                Alert.alert(
                  'Shift Concluded',
                  `Successfully clocked out of ${targetShift?.name || 'shift'}.`
                );
              }

              // Refresh rota and state from server
              await loadShiftData();
            }
          } catch (err: any) {
            // If the server says 409, refresh the state from server and show clear message
            const is409 =
              err.status === 409 ||
              err.code === 'ACTIVE_SHIFT_EXISTS' ||
              (typeof err.message === 'string' &&
                err.message.toLowerCase().includes('already has an active checked-in shift'));

            if (is409) {
              try {
                const active = await api.getCurrentAttendance();
                if (active) {
                  setCurrentAttendance(active);
                  setIsClockedIn(true);
                  if (active.shift) {
                    setActiveShift(active.shift);
                  }
                  const timeStr = active.check_in_at
                    ? new Date(active.check_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    : 'earlier';
                  Alert.alert(
                    'Already Checked In',
                    `You are already checked in since ${timeStr}. Your duty timer is now running and you can clock out when your shift ends.`
                  );
                  return;
                }
              } catch {
                setIsClockedIn(true);
                Alert.alert(
                  'Already Checked In',
                  'You are already checked in on duty. You can now clock out when ready.'
                );
                return;
              }
            }

            if (err instanceof LocationServiceError) {
              setLocationError(err.message);
              setLocationErrorType(err.type);
              if (err.type === 'PERMISSION_DENIED') {
                Alert.alert('Location Permission Denied', err.message, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => locationService.openSettings() },
                ]);
              } else if (err.type === 'SERVICES_DISABLED') {
                Alert.alert('Location Turned Off', err.message, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => locationService.openSettings() },
                ]);
              } else if (err.type === 'POOR_ACCURACY') {
                Alert.alert('Weak GPS Signal', err.message);
              } else {
                Alert.alert('Location Error', err.message);
              }
            } else {
              // Show the real error message from the server
              const errorMsg = err.message || 'Operation failed. Please try again.';
              Alert.alert('Attendance Error', errorMsg);
            }
          } finally {
            setIsActionLoading(false);
          }
        };

        const branch = activeShift?.branch || user?.branch;
        const todayStr = new Date().toISOString().slice(0, 10);
        const checkInTimestamp =
          currentAttendance?.check_in_at || currentAttendance?.check_in_time;

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

              {/* Real Server Error Banner */}
              {serverError && (
                <Card style={styles.errorCard}>
                  <View style={styles.errorHeaderRow}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color={theme.colors.danger} />
                    <Text style={styles.errorCardTitle}>Server Error</Text>
                  </View>
                  <Text style={styles.errorCardText}>{serverError}</Text>
                  <Button
                    title="Refresh"
                    variant="primary"
                    size="sm"
                    onPress={onRefresh}
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                  />
                </Card>
              )}

              {/* Live Shift Card */}
              {activeShift ? (
                  <Card style={styles.shiftCard} highlightBorder={isClockedIn}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftCardTitle}>{activeShift.name}</Text>
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
                    <View style={styles.shiftMetaGrid}>
                      {isClockedIn && checkInTimestamp && (
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons
                            name="clock-check-outline"
                            size={16}
                            color={theme.colors.success}
                          />
                          <Text style={styles.metaLabel}>Checked in:</Text>
                          <Text style={[styles.metaValue, { color: theme.colors.success }]}>
                            {new Date(checkInTimestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            ({new Date(checkInTimestamp).toISOString().slice(11, 16)} UTC)
                          </Text>
                        </View>
                      )}

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

                    {/* Live Timer Section */}
                    <View style={styles.timerContainer}>
                      <Text style={styles.timerLabel}>
                        {isClockedIn ? 'ON-DUTY DURATION (UTC)' : 'DUTY TIMER'}
                      </Text>
                      <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
                    </View>
                  </Card>
                  ) : !serverError ? (
                  <Card style={styles.shiftCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftCardTitle}>No shift assigned</Text>
                        <Text style={styles.shiftCardSubtitle}>
                          You currently have no operational shifts assigned for duty.
                        </Text>
                      </View>
                      <Badge label="Unassigned" variant="neutral" />
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Refresh"
                        variant="primary"
                        onPress={onRefresh}
                        leftIcon={<MaterialCommunityIcons name="refresh" size={18} color={theme.colors.textOnPrimary} />}
                      />
                    </View>
                  </Card>
        ) : null}

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
                      <View style={styles.gpsErrorContainer}>
                        <View style={styles.gpsErrorRow}>
                          <MaterialCommunityIcons name="alert" size={18} color={theme.colors.danger} />
                          <Text style={styles.gpsErrorText}>{locationError}</Text>
                        </View>
                        {(locationErrorType === 'PERMISSION_DENIED' || locationErrorType === 'SERVICES_DISABLED') && (
                          <Button
                            title="Open Settings"
                            variant="secondary"
                            size="sm"
                            onPress={() => locationService.openSettings()}
                            style={{ marginTop: 8, alignSelf: 'flex-start' }}
                          />
                        )}
                      </View>
                    ) : locationSnapshot && branch ? (
                      <View style={styles.gpsInfoGrid}>
                        <View style={styles.gpsInfoItem}>
                          <Text style={styles.gpsInfoLabel}>Distance from branch:</Text>
                          <Text
                            style={[
                              styles.gpsInfoValue,
                              geofenceResult?.isWithinGeofence
                                ? { color: theme.colors.success }
                                : { color: theme.colors.danger },
                            ]}
                          >
                            {`You are ${geofenceResult?.distanceMeters ?? '...'} m from ${branch.name}, allowed ${branch.radius_m} m`}
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
                      disabled={isActionLoading || (!activeShift && !isClockedIn)}
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
                        : activeShift
                          ? 'Tap to clock in at current GPS coordinates (idempotent UTC sync)'
                          : 'Shift assignment required to clock in'}
                    </Text>
                  </View>

                  {/* Assigned Shifts Section (Today and Coming Days) */}
                  <View style={styles.assignedShiftsSection}>
                    <View style={styles.sectionHeaderRow}>
                      <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} />
                      <Text style={styles.sectionTitle}>
                        Assigned Shifts ({rotaList.length})
                      </Text>
                    </View>

                    {rotaList.length === 0 ? (
                      <Card style={styles.emptyRotaCard}>
                        <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={theme.colors.textDim} />
                        <Text style={styles.emptyRotaTitle}>No shift assigned</Text>
                        <Text style={styles.emptyRotaText}>
                          No upcoming or active shifts found on your account.
                        </Text>
                        <Button
                          title="Refresh"
                          variant="primary"
                          size="sm"
                          onPress={onRefresh}
                          style={{ marginTop: 12 }}
                        />
                      </Card>
                    ) : (
                      rotaList.map((item) => {
                        const shift = item.shift;
                        const b = shift.branch;
                        const start = String(item.start_date || '').slice(0, 10);
                        const end = item.end_date ? String(item.end_date).slice(0, 10) : null;
                        const isToday =
                          start <= todayStr &&
                          (!end || end >= todayStr) &&
                          !item.excluded_dates?.includes(todayStr);

                        return (
                          <Card key={item.id} style={styles.rotaItemCard} highlightBorder={isToday}>
                            <View style={styles.cardHeaderRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.rotaShiftName}>{shift.name}</Text>
                                {b && (
                                  <View style={styles.branchRow}>
                                    <MaterialCommunityIcons name="office-building" size={14} color={theme.colors.textMuted} />
                                    <Text style={styles.branchName}>{b.name}</Text>
                                  </View>
                                )}
                              </View>
                              <Badge
                                label={isToday ? 'Today' : 'Upcoming'}
                                variant={isToday ? 'success' : 'info'}
                              />
                            </View>

                            <View style={styles.rotaTimeRow}>
                              <MaterialCommunityIcons name="clock-outline" size={15} color={theme.colors.primary} />
                              <Text style={styles.rotaTimeText}>
                                {shift.start_time} - {shift.end_time}
                              </Text>
                              <Text style={styles.rotaDateRange}>
                                • {start} {end ? `→ ${end}` : '(Ongoing)'}
                              </Text>
                            </View>

                            {b?.address && (
                              <View style={styles.addressRow}>
                                <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.colors.textDim} />
                                <Text style={styles.addressText} numberOfLines={1}>
                                  {b.address}
                                </Text>
                              </View>
                            )}
                          </Card>
                        );
                      })
                    )}
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
        errorCard: {
          backgroundColor: theme.colors.dangerBg,
          borderColor: theme.colors.danger,
          borderWidth: 1,
          marginBottom: theme.spacing.base,
        },
        errorHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        },
        errorCardTitle: {
          fontSize: theme.typography.fontSizes.sm,
          fontWeight: '700',
          color: theme.colors.danger,
        },
        errorCardText: {
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.text,
          lineHeight: 18,
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
        gpsErrorContainer: {
          paddingVertical: 4,
        },
        gpsErrorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        gpsErrorText: {
          color: theme.colors.danger,
          fontSize: theme.typography.fontSizes.xs,
          flex: 1,
          lineHeight: 18,
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
          marginBottom: theme.spacing.xl,
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
        assignedShiftsSection: {
          marginTop: theme.spacing.md,
        },
        sectionHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: theme.spacing.md,
        },
        sectionTitle: {
          fontSize: theme.typography.fontSizes.md,
          fontWeight: '800',
          color: theme.colors.text,
        },
        emptyRotaCard: {
          alignItems: 'center',
          paddingVertical: theme.spacing.xl,
        },
        emptyRotaTitle: {
          fontSize: theme.typography.fontSizes.sm,
          fontWeight: '700',
          color: theme.colors.textMuted,
          marginTop: 8,
        },
        emptyRotaText: {
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.textDim,
          textAlign: 'center',
          marginTop: 4,
        },
        rotaItemCard: {
          marginBottom: theme.spacing.sm,
        },
        rotaShiftName: {
          fontSize: theme.typography.fontSizes.sm,
          fontWeight: '700',
          color: theme.colors.text,
        },
        branchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        },
        branchName: {
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.textMuted,
        },
        rotaTimeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
        },
        rotaTimeText: {
          fontSize: theme.typography.fontSizes.xs,
          fontWeight: '700',
          color: theme.colors.text,
        },
        rotaDateRange: {
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.textDim,
        },
        addressRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
        },
        addressText: {
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.textDim,
        },
      });
