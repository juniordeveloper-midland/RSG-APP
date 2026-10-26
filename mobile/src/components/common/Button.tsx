import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { theme } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'clock' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'giant';
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    // Size
    switch (size) {
      case 'sm':
        list.push(styles.sizeSm);
        break;
      case 'lg':
        list.push(styles.sizeLg);
        break;
      case 'giant':
        list.push(styles.sizeGiant);
        break;
      default:
        list.push(styles.sizeMd);
    }

    // Variant
    switch (variant) {
      case 'clock':
        list.push(styles.variantClock);
        break;
      case 'secondary':
        list.push(styles.variantSecondary);
        break;
      case 'outline':
        list.push(styles.variantOutline);
        break;
      case 'danger':
        list.push(styles.variantDanger);
        break;
      default:
        list.push(styles.variantPrimary);
    }

    if (disabled || isLoading) {
      list.push(styles.disabled);
    }

    if (style) {
      list.push(style);
    }

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.textBase];

    switch (size) {
      case 'sm':
        list.push(styles.textSm);
        break;
      case 'lg':
        list.push(styles.textLg);
        break;
      case 'giant':
        list.push(styles.textGiant);
        break;
      default:
        list.push(styles.textMd);
    }

    switch (variant) {
      case 'outline':
        list.push(styles.textOutline);
        break;
      case 'secondary':
        list.push(styles.textSecondary);
        break;
      default:
        list.push(styles.textPrimary);
    }

    if (textStyle) {
      list.push(textStyle);
    }

    return list;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={getContainerStyle()}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.textOnPrimary} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
          <Text style={getTextStyle()}>{title}</Text>
          {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIconContainer: {
    marginRight: theme.spacing.sm,
  },
  rightIconContainer: {
    marginLeft: theme.spacing.sm,
  },

  // Sizes
  sizeSm: {
    minHeight: 38,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  sizeMd: {
    minHeight: theme.touchTargets.minHeight, // 48px mandated touch target
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  sizeLg: {
    minHeight: theme.touchTargets.buttonLg, // 56px
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  sizeGiant: {
    minHeight: theme.touchTargets.clockButton, // 72px
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },

  // Variants
  variantPrimary: {
    backgroundColor: theme.colors.primary,
  },
  variantClock: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  variantSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  variantOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
  },
  variantDanger: {
    backgroundColor: theme.colors.danger,
  },

  disabled: {
    opacity: 0.6,
  },

  // Typography
  textBase: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: theme.typography.fontSizes.sm,
  },
  textMd: {
    fontSize: theme.typography.fontSizes.base,
  },
  textLg: {
    fontSize: theme.typography.fontSizes.md,
  },
  textGiant: {
    fontSize: theme.typography.fontSizes.xl,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  textPrimary: {
    color: theme.colors.textOnPrimary, // Pure white text on red buttons per AGENTS.md
  },
  textSecondary: {
    color: theme.colors.text,
  },
  textOutline: {
    color: theme.colors.text,
  },
});
