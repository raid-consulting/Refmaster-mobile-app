import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type PillProps = {
  label: string;
  tone?: 'default' | 'accent' | 'danger';
};

export const Pill: React.FC<PillProps> = ({ label, tone = 'default' }) => {
  const palette = pillPalettes[tone];
  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}> 
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
};

const pillPalettes = {
  default: {
    background: '#112a44',
    text: colors.textPrimary,
    border: colors.border,
  },
  accent: {
    background: '#1f3650',
    text: colors.accent,
    border: '#27496e',
  },
  danger: {
    background: '#2d1a1a',
    text: colors.danger,
    border: '#442020',
  },
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
