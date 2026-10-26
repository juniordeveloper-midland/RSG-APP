import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'synced' | 'neutral';
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  icon,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
      case 'synced':
        return {
          bg: theme.colors.successBg,
          text: theme.colors.success,
          border: 'rgba(16, 185, 129, 0.4)',
        };
      case 'warning':
      case 'pending':
        return {
          bg: theme.colors.warningBg,
          text: theme.colors.warning,
          border: 'rgba(245, 158, 11, 0.4)',
        };
      case 'danger':
        return {
          bg: theme.colors.dangerBg,
          text: theme.colors.danger,
          border: 'rgba(239, 68, 68, 0.4)',
        };
      case 'info':
        return {
          bg: theme.colors.infoBg,
          text: theme.colors.info,
          border: 'rgba(59, 130, 246, 0.4)',
        };
      default:
        return {
          bg: theme.colors.surface,
          text: theme.colors.textMuted,
          border: theme.colors.border,
        };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
