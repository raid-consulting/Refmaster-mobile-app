import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type SectionCardProps = {
  title: string;
  actionLabel?: string;
  children?: ReactNode;
};

export const SectionCard: React.FC<SectionCardProps> = ({ title, actionLabel, children }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
    </View>
    <View style={styles.body}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  action: {
    color: colors.primary,
    fontWeight: '600',
  },
  body: {
    gap: 10,
  },
});
