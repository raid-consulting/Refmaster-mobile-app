import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio, Recording } from 'expo-av';
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
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<'da' | 'en'>('da');
  const [quickRecording, setQuickRecording] = useState<Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const transcriptionTimers = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      transcriptionTimers.current.forEach(clearTimeout);
      transcriptionTimers.current = [];
      if (quickRecording) {
        quickRecording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [quickRecording]);

  const formatDuration = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const resetTranscriptionTimers = () => {
    transcriptionTimers.current.forEach(clearTimeout);
    transcriptionTimers.current = [];
  };

  const simulateTranscription = (language: 'da' | 'en', agenda: string) => {
    resetTranscriptionTimers();
    setIsTranscribing(true);
    setTranscript('');

    const prompt = agenda.trim() ? agenda.trim() : language === 'da' ? 'hurtigt møde' : 'quick meeting';
    const localizedLines =
      language === 'da'
        ? [
            '• Optagelse gemt lokalt og sendt til transskription.',
            `• Emne: ${prompt}.`,
            '• Deltagere er enige om næste skridt og action items.',
            '• Transskriptionen er klar til deling.',
          ]
        : [
            '• Recording saved locally and queued for transcription.',
            `• Topic: ${prompt}.`,
            '• Participants aligned on next steps and action items.',
            '• Transcript is ready to share.',
          ];

    localizedLines.forEach((line, index) => {
      const timer = setTimeout(() => {
        setTranscript((current) => (current ? `${current}\n${line}` : line));
        if (index === localizedLines.length - 1) {
          setIsTranscribing(false);
          setStatusMessage(language === 'da' ? 'Transskription klar' : 'Transcription ready');
        }
      }, 900 * (index + 1));
      transcriptionTimers.current.push(timer);
    });
  };

  const startQuickRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusMessage(
          transcriptionLanguage === 'da'
            ? 'Tillad mikrofonadgang for at optage'
            : 'Please allow microphone access to record',
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        500,
      );

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDuration(status.durationMillis ?? 0);
        }
      });

      setStatusMessage(transcriptionLanguage === 'da' ? 'Optagelse startet' : 'Recording started');
      setQuickRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      setTranscript('');
      setIsTranscribing(false);
    } catch (error) {
      console.error('Failed to start quick recording', error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? 'Kunne ikke starte optagelse'
          : 'Unable to start recording',
      );
    }
  };

  const stopQuickRecording = async () => {
    if (!quickRecording) return;

    try {
      await quickRecording.stopAndUnloadAsync();
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? 'Optagelse stoppet — transskriberer'
          : 'Recording stopped — transcribing',
      );
      setIsRecording(false);
      setQuickRecording(null);
      simulateTranscription(transcriptionLanguage, quickAgenda);
    } catch (error) {
      console.error('Failed to stop quick recording', error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? 'Kunne ikke stoppe optagelsen'
          : 'Unable to stop recording',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Header
          title="Optag møder enkelt"
          subtitle="Vælg et af de to forløb og få transskription på dansk."
        />

        <SectionCard title="1. Planlagt møde" actionLabel="Med dagsorden">
          <Text style={styles.helper}>
            Gem dagsorden og start optagelse, så transskriptionen følger punkterne.
          </Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mødetitel</Text>
            <TextInput
              style={styles.input}
              placeholder="Titel for mødet"
              placeholderTextColor={colors.textSecondary}
              value={plannedTitle}
              onChangeText={setPlannedTitle}
              returnKeyType="done"
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
              textAlignVertical="top"
            />
          </View>
          <ActionButton label="Gem plan og start optagelse" />
          <View style={styles.transcriptBox}>
            <Pill label="Transskription" tone="accent" />
            <Text style={styles.meta}>
              Lyd gemmes lokalt og bliver automatisk transskriberet til dagsordenen.
            </Text>
          </View>
        </SectionCard>

        <SectionCard title="2. Hurtig optagelse" actionLabel="Start nu">
          <Text style={styles.helper}>Indtast en kort dagsorden og begynd optagelsen med det samme.</Text>
          <View style={styles.languageRow}>
            <Text style={styles.label}>Transskriptionssprog</Text>
            <View style={styles.languageChips}>
              {[
                { code: 'da' as const, label: 'Dansk' },
                { code: 'en' as const, label: 'English' },
              ].map((option) => {
                const selected = transcriptionLanguage === option.code;
                return (
                  <Text
                    key={option.code}
                    onPress={() => setTranscriptionLanguage(option.code)}
                    style={[styles.languageChip, selected && styles.languageChipSelected]}
                  >
                    {option.label}
                  </Text>
                );
              })}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Dagsorden (frivillig)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Skriv hvad mødet handler om"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={quickAgenda}
              onChangeText={setQuickAgenda}
              textAlignVertical="top"
            />
          </View>
          <ActionButton
            label={isRecording ? 'Stop optagelse' : 'Start optagelse uden plan'}
            tone={isRecording ? 'primary' : 'secondary'}
            onPress={isRecording ? stopQuickRecording : startQuickRecording}
          />
          <View style={styles.transcriptBox}>
            <View style={styles.statusRow}>
              <Pill label={isRecording ? 'Live' : 'Klar'} tone={isRecording ? 'accent' : 'default'} />
              {isRecording && <Text style={styles.liveTime}>{formatDuration(recordingDuration)}</Text>}
            </View>
            <Text style={styles.meta}>
              {isRecording
                ? 'Optager og transskriberer i baggrunden. Tilføj noter mens du optager.'
                : isTranscribing
                  ? 'Transskriberer optagelsen...'
                  : transcript
                    ? transcriptionLanguage === 'da'
                      ? 'Transskription gemt fra seneste optagelse.'
                      : 'Transcript saved from latest recording.'
                    : 'Klar til næste hurtige optagelse.'}
            </Text>
            {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
            {transcript ? (
              <View style={styles.transcriptContent}>
                <Text style={styles.transcriptLabel}>
                  {transcriptionLanguage === 'da' ? 'Seneste transskription' : 'Latest transcript'}
                </Text>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            ) : null}
          </View>
        </SectionCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  languageRow: {
    gap: 8,
  },
  languageChips: {
    flexDirection: 'row',
    gap: 8,
  },
  languageChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  languageChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: '#001a2b',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveTime: {
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusMessage: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  transcriptContent: {
    gap: 6,
    marginTop: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0d2439',
  },
  transcriptLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  transcriptText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
});
