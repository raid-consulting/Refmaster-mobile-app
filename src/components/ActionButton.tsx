import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

type ActionButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  tone?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
}) => (
  <Pressable
    style={[styles.base, toneStyles[tone], disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.label, toneText[tone]]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.6,
  },
});

const toneStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
});

const toneText = StyleSheet.create({
  primary: {
    color: '#001a2b',
  },
  secondary: {
    color: colors.textPrimary,
  },
  ghost: {
    color: colors.textSecondary,
  },
});
