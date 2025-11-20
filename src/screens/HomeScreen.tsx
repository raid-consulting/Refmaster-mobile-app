import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { SectionCard } from '../components/SectionCard';
import { MeetingListItem } from '../components/MeetingListItem';
import { ActionButton } from '../components/ActionButton';
import { Pill } from '../components/Pill';

const meetings = [
  {
    id: '1',
    title: 'Platform Steering Sync',
    datetime: 'Today · 3:00 PM',
    agendaCount: 4,
    status: 'scheduled' as const,
  },
  {
    id: '2',
    title: 'Vendor Due Diligence',
    datetime: 'Tomorrow · 9:30 AM',
    agendaCount: 3,
    status: 'scheduled' as const,
  },
  {
    id: '3',
    title: 'Retro: Release 1.0',
    datetime: 'Wed · 10:00 AM',
    agendaCount: 5,
    status: 'complete' as const,
  },
];

export const HomeScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Header title="Welcome back" subtitle="Capture meetings and align transcripts to agendas." />

    <SectionCard title="Jump back in" actionLabel="Open"> 
      <View style={styles.row}> 
        <View style={styles.progressCard}> 
          <Text style={styles.progressLabel}>Draft Agenda</Text> 
          <Text style={styles.progressValue}>Quarterly Planning</Text> 
          <Pill label="4 items" tone="accent" /> 
        </View> 
        <View style={styles.progressCard}> 
          <Text style={styles.progressLabel}>Last Recording</Text> 
          <Text style={styles.progressValue}>Interview w/ HQ</Text> 
          <Pill label="Transcribed" /> 
        </View> 
      </View>
      <ActionButton label="Start new meeting" />
    </SectionCard>

    <SectionCard title="Upcoming meetings" actionLabel="View all">
      <View style={styles.list}>
        {meetings.map((meeting) => (
          <MeetingListItem key={meeting.id} {...meeting} />
        ))}
      </View>
    </SectionCard>

    <SectionCard title="Recorder prep" actionLabel="Checklist">
      <View style={styles.checklistRow}>
        <Pill label="Mic access" tone="accent" />
        <Text style={styles.meta}>Request permission before capturing audio.</Text>
      </View>
      <View style={styles.checklistRow}>
        <Pill label="Storage" tone="accent" />
        <Text style={styles.meta}>Files stay local until you upload for transcription.</Text>
      </View>
      <View style={styles.checklistRow}>
        <Pill label="Agenda" tone="accent" />
        <Text style={styles.meta}>Create or import agenda to enable alignment.</Text>
      </View>
    </SectionCard>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  progressCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  checklistRow: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
