import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { SectionCard } from '../components/SectionCard';
import { Pill } from '../components/Pill';
import { ActionButton } from '../components/ActionButton';

const transcript = [
  { id: 't1', agenda: 'Budget decisions', text: 'We align on forecast and capex guardrails for Q3.', confidence: 0.72 },
  { id: 't2', agenda: 'Risks & blockers', text: 'Dependencies on vendor handoff remain open.', confidence: 0.64 },
  { id: 't3', agenda: 'Timeline', text: 'Pilot rollout stays on track for next month.', confidence: 0.83 },
];

export const ReviewScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Header title="Review & align" subtitle="Match transcript segments to agenda points." />

    <SectionCard title="Highlights" actionLabel="Share">
      <View style={styles.highlightRow}>
        <Text style={styles.highlightText}>Generated transcript draft • 18m audio</Text>
        <Pill label="Auto-align" />
      </View>
      <ActionButton label="Export markdown" tone="secondary" />
    </SectionCard>

    <SectionCard title="Transcript alignment" actionLabel="Regenerate">
      <View style={styles.list}>
        {transcript.map((item) => (
          <View key={item.id} style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <Pill label={item.agenda} tone="accent" />
              <Text style={styles.confidence}>Confidence {(item.confidence * 100).toFixed(0)}%</Text>
            </View>
            <Text style={styles.transcriptText}>{item.text}</Text>
          </View>
        ))}
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
  highlightRow: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  highlightText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidence: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  transcriptText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
});
