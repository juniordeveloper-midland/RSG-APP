import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { useOffline } from '../../context/OfflineContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onPressQueue?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onPressQueue,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const { pendingCount, isSyncing, syncNow } = useOffline();

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="shield-check" size={20} color={theme.colors.textOnPrimary} />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.rightSection}>
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={onPressQueue || syncNow}
              activeOpacity={0.7}
              style={styles.offlineChip}
            >
              <MaterialCommunityIcons
                name={isSyncing ? 'cloud-sync' : 'cloud-alert'}
                size={16}
                color={theme.colors.warning}
              />
              <Text style={styles.offlineChipText}>
                {isSyncing ? 'Syncing...' : `${pendingCount} Pending`}
              </Text>
            </TouchableOpacity>
          )}

          {rightAction}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundDarker,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginLeft: 38,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningBg,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 4,
  },
  offlineChipText: {
    color: theme.colors.warning,
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
  },
});
