import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { Pill } from './Pill';

type MeetingListItemProps = {
  title: string;
  datetime: string;
  agendaCount: number;
  status: 'scheduled' | 'recording' | 'complete';
};

const statusCopy: Record<MeetingListItemProps['status'], string> = {
  scheduled: 'Scheduled',
  recording: 'Recording',
  complete: 'Transcribed',
};

export const MeetingListItem: React.FC<MeetingListItemProps> = ({ title, datetime, agendaCount, status }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Pill
        label={statusCopy[status]}
        tone={status === 'recording' ? 'accent' : status === 'complete' ? 'default' : 'default'}
      />
    </View>
    <Text style={styles.meta}>{datetime}</Text>
    <Text style={styles.meta}>{agendaCount} agenda items</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
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
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
