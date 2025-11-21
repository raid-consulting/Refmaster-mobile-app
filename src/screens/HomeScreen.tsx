import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { SectionCard } from '../components/SectionCard';
import { ActionButton } from '../components/ActionButton';
import { Pill } from '../components/Pill';

export const HomeScreen: React.FC = () => {
  const [plannedTitle, setPlannedTitle] = useState('Statusmøde med teamet');
  const [plannedAgenda, setPlannedAgenda] = useState(
    '• Opfølgning på leverancer\n• Risici og beslutninger\n• Næste sprint',
  );
  const [quickAgenda, setQuickAgenda] = useState('• Kort dagsorden til ad hoc optagelse');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Header title="Optag møder enkelt" subtitle="Vælg et af de to forløb og få transskription på dansk." />

      <SectionCard title="1. Planlagt møde" actionLabel="Med dagsorden">
        <Text style={styles.helper}>Gem dagsorden og start optagelse, så transskriptionen følger punkterne.</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mødetitel</Text>
          <TextInput
            style={styles.input}
            placeholder="Titel for mødet"
            placeholderTextColor={colors.textSecondary}
            value={plannedTitle}
            onChangeText={setPlannedTitle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Dagsorden</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Tilføj punkter med linjeskift"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={plannedAgenda}
            onChangeText={setPlannedAgenda}
          />
        </View>
        <ActionButton label="Gem plan og start optagelse" />
        <View style={styles.transcriptBox}>
          <Pill label="Transskription" tone="accent" />
          <Text style={styles.meta}>Lyd gemmes lokalt og bliver automatisk transskriberet til dagsordenen.</Text>
        </View>
      </SectionCard>

      <SectionCard title="2. Hurtig optagelse" actionLabel="Start nu">
        <Text style={styles.helper}>Indtast en kort dagsorden og begynd optagelsen med det samme.</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Dagsorden (frivillig)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Skriv hvad mødet handler om"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={quickAgenda}
            onChangeText={setQuickAgenda}
          />
        </View>
        <ActionButton label="Start optagelse uden plan" tone="secondary" />
        <View style={styles.transcriptBox}>
          <Pill label="Live" tone="accent" />
          <Text style={styles.meta}>Transskriptionen kører i baggrunden, og du kan tilføje noter mens der optages.</Text>
        </View>
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  transcriptBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
