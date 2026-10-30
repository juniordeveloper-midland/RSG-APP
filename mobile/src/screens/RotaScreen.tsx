import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { theme } from '../theme';
import { api } from '../services/api';
import { RotaItem } from '../types/shift';

export const RotaScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [rotaItems, setRotaItems] = useState<RotaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'today'>('all');
  const [isCachedData, setIsCachedData] = useState<boolean>(false);

  const fetchRota = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await api.getMyRota();
      setRotaItems(data);
      setIsCachedData(false);
    } catch (err: any) {
      setServerError(err.message || 'Failed to load shifts from server.');
      setIsCachedData(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh when the screen opens
  useFocusEffect(
    useCallback(() => {
      fetchRota();
    }, [])
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredRota = rotaItems.filter((item) => {
    const start = String(item.start_date || '').slice(0, 10);
    const end = item.end_date ? String(item.end_date).slice(0, 10) : null;
    const isExcluded = Boolean(item.excluded_dates?.includes(todayStr));

    if (filter === 'today') {
      return start <= todayStr && (!end || end >= todayStr) && !isExcluded;
    }
    if (filter === 'upcoming') {
      return !end || end >= todayStr;
    }
    return true;
  });

  const renderItem = ({ item }: { item: RotaItem }) => {
    const shift = item.shift;
    const branch = shift.branch;
    const start = String(item.start_date || '').slice(0, 10);
    const end = item.end_date ? String(item.end_date).slice(0, 10) : null;
    const isToday =
      start <= todayStr &&
      (!end || end >= todayStr) &&
      !item.excluded_dates?.includes(todayStr);

    return (
      <Card style={styles.shiftCard} highlightBorder={isToday}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shiftName}>{shift.name}</Text>
            {branch && (
              <View style={styles.branchRow}>
                <MaterialCommunityIcons name="office-building" size={14} color={theme.colors.textMuted} />
                <Text style={styles.branchName}>{branch.name}</Text>
              </View>
            )}
          </View>

          <Badge
            label={isToday ? 'Today' : 'Assigned'}
            variant={isToday ? 'success' : 'info'}
          />
        </View>

        {branch?.address && (
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.colors.textDim} />
            <Text style={styles.addressText} numberOfLines={1}>
              {branch.address}
            </Text>
          </View>
        )}

        <View style={styles.detailsDivider} />

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabel}>Time Window</Text>
            <Text style={styles.metaCellValue}>
              {shift.start_time} - {shift.end_time}
            </Text>
          </View>

          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabel}>Active Dates</Text>
            <Text style={styles.metaCellValue}>
              {start} → {end || 'Ongoing'}
            </Text>
          </View>

          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabel}>Validation</Text>
            <Text style={styles.metaCellValue}>
              {shift.check_type === 'gps' ? 'GPS Radius' : 'QR Checkpoint'}
            </Text>
          </View>

          <View style={styles.metaCell}>
            <Text style={styles.metaCellLabel}>Lunch Deduction</Text>
            <Text style={styles.metaCellValue}>
              {shift.lunch_deduction_minutes} mins
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Assigned Rota"
        subtitle="Operational Shift Schedule"
        onPressQueue={() => navigation.navigate('More')}
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'all' && styles.filterTabTextActive,
            ]}
          >
            All Shifts ({rotaItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'today' && styles.filterTabActive]}
          onPress={() => setFilter('today')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'today' && styles.filterTabTextActive,
            ]}
          >
            Today's Duty
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'upcoming' && styles.filterTabActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'upcoming' && styles.filterTabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {/* Real Server Error Notice */}
      {serverError && (
        <View style={styles.errorNotice}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.errorNoticeText}>{serverError}</Text>
          <TouchableOpacity onPress={fetchRota} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isCachedData && !serverError && (
        <View style={styles.cachedNotice}>
          <MaterialCommunityIcons name="cloud-off-outline" size={16} color={theme.colors.warning} />
          <Text style={styles.cachedNoticeText}>
            Showing cached schedule from local storage (Offline Mode).
          </Text>
        </View>
      )}

      <FlatList
        data={filteredRota}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchRota}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={56} color={theme.colors.textDim} />
              <Text style={styles.emptyTitle}>No shift assigned</Text>
              <Text style={styles.emptySubtitle}>
                You currently have no shifts assigned for the selected filter.
              </Text>
              <Button
                title="Refresh"
                onPress={fetchRota}
                variant="primary"
                style={{ marginTop: 16 }}
              />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.backgroundDarker,
    gap: theme.spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary, // #eb0505 per AGENTS.md
    borderColor: theme.colors.primary,
  },
  filterTabText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: '700',
  },
  cachedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 6,
    gap: 6,
  },
  cachedNoticeText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.warning,
    fontWeight: '500',
  },
  listContent: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.xxl,
  },
  shiftCard: {
    marginBottom: theme.spacing.base,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  shiftName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '800',
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
  detailsDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.sm,
  },
  metaCell: {
    width: '50%',
  },
  metaCellLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textDim,
    marginBottom: 2,
  },
  metaCellValue: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.giant,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: theme.spacing.xl,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerBg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 10,
    gap: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  retryBtnText: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
  },
});
