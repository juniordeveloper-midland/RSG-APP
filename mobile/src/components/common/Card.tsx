import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  highlightBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, highlightBorder = false }) => {
  return (
    <View
      style={[
        styles.card,
        highlightBorder && styles.highlight,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface, // #3d3d3d per AGENTS.md
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border, // #4a4a4a per AGENTS.md
    padding: theme.spacing.base,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  highlight: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary, // #eb0505 accent
  },
});
