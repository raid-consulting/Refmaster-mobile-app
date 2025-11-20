import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { ActionButton } from '../components/ActionButton';
import { SectionCard } from '../components/SectionCard';
import { Pill } from '../components/Pill';

export const RecorderScreen: React.FC = () => (
  <View style={styles.container}>
    <Header title="Recorder" subtitle="Prepare microphone and agenda before starting." />

    <SectionCard title="Live capture" actionLabel="00:05:12">
      <View style={styles.wavePlaceholder}>
        <Text style={styles.waveText}>Waveform placeholder</Text>
      </View>
      <View style={styles.controls}>
        <ActionButton label="Pause" tone="secondary" />
        <ActionButton label="Stop & save" />
      </View>
      <View style={styles.statusRow}>
        <Pill label="Recording" tone="accent" />
        <Text style={styles.statusCopy}>Audio cached locally until upload.</Text>
      </View>
    </SectionCard>

    <SectionCard title="Agenda focus" actionLabel="Edit agenda">
      <View style={styles.agendaRow}>
        <Pill label="Now" tone="accent" />
        <Text style={styles.agendaTitle}>Budget decisions</Text>
        <Text style={styles.agendaCopy}>Confidence 72%</Text>
      </View>
      <View style={styles.agendaRow}>
        <Pill label="Next" />
        <Text style={styles.agendaTitle}>Risks & blockers</Text>
        <Text style={styles.agendaCopy}>Queued</Text>
      </View>
    </SectionCard>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 16,
  },
  wavePlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  waveText: {
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusCopy: {
    color: colors.textSecondary,
  },
  agendaRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  agendaTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  agendaCopy: {
    color: colors.textSecondary,
  },
});
