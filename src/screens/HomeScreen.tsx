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
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { SectionCard } from '../components/SectionCard';
import { ActionButton } from '../components/ActionButton';
import { Pill } from '../components/Pill';
import { TranscriptionEvent, transcribeAudio } from '../services/transcription';

const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(jsonError);
  }
};

export const HomeScreen: React.FC = () => {
  const [plannedTitle, setPlannedTitle] = useState('Statusmøde med teamet');
  const [plannedAgenda, setPlannedAgenda] = useState(
    '• Opfølgning på leverancer\n• Risici og beslutninger\n• Næste sprint',
  );
  const [quickAgenda, setQuickAgenda] = useState('• Kort dagsorden til ad hoc optagelse');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<'da' | 'en'>('da');
  const [quickRecording, setQuickRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressStep, setProgressStep] = useState<'idle' | 'uploading' | 'transcribing' | 'completed' | 'error'>(
    'idle',
  );
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const transcriptionSubscription = useRef<(() => void) | null>(null);

  const addLogEntry = (entry: string) => {
    setActivityLog((current) => [...current, entry]);
  };

  useEffect(() => {
    return () => {
      transcriptionSubscription.current?.();
      transcriptionSubscription.current = null;
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

  const cleanupTranscription = () => {
    transcriptionSubscription.current?.();
    transcriptionSubscription.current = null;
  };

  const handleTranscriptionEvent = (language: 'da' | 'en', event: TranscriptionEvent) => {
    switch (event.type) {
      case 'status':
        if (event.message) {
          setStatusMessage(event.message);
          addLogEntry(event.message);
        }
        break;
      case 'progress':
        if (event.step) {
          setProgressStep(event.step);
        }
        if (typeof event.progress === 'number') {
          setTranscribeProgress(event.progress);
        }
        break;
      case 'partial':
        setProgressStep('transcribing');
        setIsTranscribing(true);
        if (typeof event.progress === 'number') {
          setTranscribeProgress(event.progress);
        }
        if (event.text) {
          setTranscript(event.text);
        }
        if (event.message) {
          setStatusMessage(event.message);
          addLogEntry(event.message);
        }
        break;
      case 'final':
        setTranscript(event.text ?? '');
        setTranscribeProgress(100);
        setProgressStep('completed');
        setIsTranscribing(false);
        setStatusMessage(
          event.message ?? (language === 'da' ? 'Transskription klar' : 'Transcription ready')
        );
        addLogEntry(
          event.message ??
            (language === 'da' ? 'Transskription fuldført.' : 'Transcription completed.')
        );
        cleanupTranscription();
        break;
      case 'error':
        setIsTranscribing(false);
        setProgressStep('error');
        setStatusMessage(
          event.message ??
            (language === 'da'
              ? 'Kunne ikke gennemføre transskription'
              : 'Unable to transcribe audio')
        );
        if (event.message) {
          addLogEntry(event.message);
        }
        cleanupTranscription();
        break;
      case 'closed':
        cleanupTranscription();
        break;
      default:
        break;
    }
  };

  const startTranscription = async (language: 'da' | 'en', agenda: string, audioUri: string) => {
    cleanupTranscription();
    setIsTranscribing(true);
    setTranscript('');
    setProgressStep('uploading');
    setTranscribeProgress(5);
    setActivityLog([]);

    const uploadingMessage =
      language === 'da'
        ? 'Uploader lyd til transskription...'
        : 'Uploading audio for transcription...';
    setStatusMessage(uploadingMessage);
    addLogEntry(uploadingMessage);

    try {
      const unsubscribe = await transcribeAudio({
        audioUri,
        language,
        agenda,
        onEvent: (event) => handleTranscriptionEvent(language, event),
      });

      transcriptionSubscription.current = unsubscribe;
    } catch (error) {
      console.error('Failed to transcribe audio', error);
      setIsTranscribing(false);
      setProgressStep('error');
      const baseMessage =
        language === 'da'
          ? 'Kunne ikke starte transskription'
          : 'Unable to start transcription';
      const detail = describeError(error);
      const fullMessage = `${baseMessage}: ${detail}`;
      setStatusMessage(fullMessage);
      addLogEntry(fullMessage);
    }
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
      setActivityLog([]);
      setProgressStep('idle');
      addLogEntry(
        transcriptionLanguage === 'da'
          ? 'Optagelse startet. Tilføj noter mens du optager.'
          : 'Recording started. Add notes while you capture audio.'
      );
      setQuickRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      setTranscript('');
      setIsTranscribing(false);
    } catch (error) {
      console.error('Failed to start quick recording', error);
      const detail = describeError(error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? `Kunne ikke starte optagelse: ${detail}`
          : `Unable to start recording: ${detail}`,
      );
      setProgressStep('error');
      addLogEntry(
        transcriptionLanguage === 'da'
          ? `Fejl: Optagelsen kunne ikke startes. ${detail}`
          : `Error: Unable to start recording. ${detail}`
      );
    }
  };

  const stopQuickRecording = async () => {
    if (!quickRecording) return;

    try {
      const recordingUri = quickRecording.getURI();
      await quickRecording.stopAndUnloadAsync();
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? 'Optagelse stoppet — transskriberer'
          : 'Recording stopped — transcribing',
      );
      setProgressStep('uploading');
      setTranscribeProgress(0);
      addLogEntry(
        transcriptionLanguage === 'da'
          ? 'Optagelse stoppet. Starter upload...'
          : 'Recording stopped. Starting upload...'
      );
      setIsRecording(false);
      setQuickRecording(null);
      if (recordingUri) {
        await startTranscription(transcriptionLanguage, quickAgenda, recordingUri);
      } else {
        setProgressStep('error');
        const message =
          transcriptionLanguage === 'da'
            ? 'Kunne ikke finde lydfilen efter optagelsen'
            : 'Could not access the recording file';
        setStatusMessage(message);
        addLogEntry(message);
      }
    } catch (error) {
      console.error('Failed to stop quick recording', error);
      const detail = describeError(error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? `Kunne ikke stoppe optagelsen: ${detail}`
          : `Unable to stop recording: ${detail}`,
      );
      setProgressStep('error');
      addLogEntry(
        transcriptionLanguage === 'da'
          ? `Fejl: Optagelsen kunne ikke stoppes. ${detail}`
          : `Error: Unable to stop recording. ${detail}`
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
            {progressStep !== 'idle' && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    {progressStep === 'uploading'
                      ? transcriptionLanguage === 'da'
                        ? 'Uploader lyd...'
                        : 'Uploading audio...'
                      : progressStep === 'transcribing'
                        ? transcriptionLanguage === 'da'
                          ? 'Transskriberer lyd...'
                          : 'Transcribing audio...'
                        : progressStep === 'completed'
                          ? transcriptionLanguage === 'da'
                            ? 'Transskription færdig'
                            : 'Transcription finished'
                          : transcriptionLanguage === 'da'
                            ? 'Der opstod en fejl'
                            : 'An error occurred'}
                  </Text>
                  <Text style={styles.progressValue}>{Math.min(transcribeProgress, 100)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(transcribeProgress, 100)}%` }]} />
                </View>
              </View>
            )}
            {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
            {activityLog.length > 0 && (
              <View style={styles.logBox}>
                <Text style={styles.logLabel}>
                  {transcriptionLanguage === 'da' ? 'Statuslog' : 'Activity log'}
                </Text>
                {activityLog.map((entry, index) => (
                  <Text key={index} style={styles.logEntry}>
                    {`• ${entry}`}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </SectionCard>

        <SectionCard
          title={transcriptionLanguage === 'da' ? 'Transskription' : 'Transcription'}
          actionLabel={
            transcript
              ? transcriptionLanguage === 'da'
                ? 'Del med mødedeltagere'
                : 'Share with attendees'
              : undefined
          }
        >
          <View style={styles.transcriptHeader}>
            <Pill
              label={
                isRecording
                  ? transcriptionLanguage === 'da'
                    ? 'Optager'
                    : 'Recording'
                  : isTranscribing
                    ? transcriptionLanguage === 'da'
                      ? 'Behandler lyd'
                      : 'Processing audio'
                    : transcript
                      ? transcriptionLanguage === 'da'
                        ? 'Klar til deling'
                        : 'Ready to share'
                      : transcriptionLanguage === 'da'
                        ? 'Ingen transskription endnu'
                        : 'No transcript yet'
              }
              tone={isRecording || isTranscribing || transcript ? 'accent' : 'default'}
            />
            <Text style={styles.transcriptStatus}>
              {progressStep === 'transcribing'
                ? transcriptionLanguage === 'da'
                  ? 'Transskriberer den seneste optagelse'
                  : 'Transcribing your latest recording'
                : transcript
                  ? transcriptionLanguage === 'da'
                    ? 'Seneste transskription klar nedenfor'
                    : 'Latest transcript available below'
                  : transcriptionLanguage === 'da'
                    ? 'Starter når du laver den første optagelse'
                    : 'Will appear after your first recording'}
            </Text>
          </View>

          <View style={styles.transcriptContent}>
            <Text style={styles.transcriptLabel}>
              {transcriptionLanguage === 'da' ? 'Seneste transskription' : 'Latest transcript'}
            </Text>
            {transcript ? (
              <Text style={styles.transcriptText}>{transcript}</Text>
            ) : (
              <Text style={styles.transcriptPlaceholder}>
                {transcriptionLanguage === 'da'
                  ? 'Transskriptionen vises her, så snart din optagelse er behandlet.'
                  : 'Your transcript will appear here as soon as the recording has been processed.'}
              </Text>
            )}
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
  progressSection: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  progressValue: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f2c44',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  statusMessage: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  logBox: {
    gap: 4,
  },
  logLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  logEntry: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
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
  transcriptHeader: {
    gap: 6,
  },
  transcriptStatus: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
  transcriptPlaceholder: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
