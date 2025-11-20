import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

type ActionButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  tone?: 'primary' | 'secondary' | 'ghost';
};

export const ActionButton: React.FC<ActionButtonProps> = ({ label, onPress, tone = 'primary' }) => (
  <Pressable style={[styles.base, toneStyles[tone]]} onPress={onPress}>
    <Text style={[styles.label, toneText[tone]]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
    fontSize: 14,
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
