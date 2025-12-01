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
import { Audio, AVPlaybackStatus } from 'expo-av';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { SectionCard } from '../components/SectionCard';
import { ActionButton } from '../components/ActionButton';
import { Pill } from '../components/Pill';
import {
  TranscriptionEvent,
  TranscriptionResult,
  transcribeAudio,
} from '../services/transcription';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
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
  const playbackSound = useRef<Audio.Sound | null>(null);
  const [transcriptionPhase, setTranscriptionPhase] = useState<
    'idle' | 'recording' | 'stopping' | 'uploading' | 'transcribing' | 'done' | 'error'
  >('idle');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const transcriptionPhaseRef = useRef(transcriptionPhase);

  const addLogEntry = (entry: string) => {
    setActivityLog((current) => [...current, entry]);
  };

  useEffect(() => {
    transcriptionPhaseRef.current = transcriptionPhase;
  }, [transcriptionPhase]);

  useEffect(() => {
    return () => {
      transcriptionSubscription.current?.();
      transcriptionSubscription.current = null;
      if (quickRecording) {
        quickRecording.stopAndUnloadAsync().catch(() => {});
      }
      playbackSound.current?.unloadAsync().catch(() => {});
      playbackSound.current = null;
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

  const updateTranscribeProgress = (
    step?: 'uploading' | 'transcribing' | 'completed',
    progress?: number,
  ) => {
    const stepMinimums: Record<'uploading' | 'transcribing' | 'completed', number> = {
      uploading: 10,
      transcribing: 50,
      completed: 100,
    };

    setTranscribeProgress((current) => {
      if (typeof progress === 'number') return progress;
      if (step && typeof stepMinimums[step] === 'number') {
        return Math.max(current, stepMinimums[step]);
      }
      return current;
    });
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
          if (event.step === 'uploading') {
            setTranscriptionPhase('uploading');
          }
          if (event.step === 'transcribing') {
            setTranscriptionPhase('transcribing');
          }
        }
        updateTranscribeProgress(event.step, event.progress);
        break;
      case 'partial':
        setProgressStep('transcribing');
        setTranscriptionPhase('transcribing');
        setIsTranscribing(true);
        updateTranscribeProgress('transcribing', event.progress);
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
        setTranscriptionPhase('done');
        setTranscriptionError(null);
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
        setTranscriptionPhase('error');
        setTranscribeProgress(0);
        setStatusMessage(
          event.message ??
            (language === 'da'
              ? 'Kunne ikke gennemføre transskription'
              : 'Unable to transcribe audio')
        );
        setTranscriptionError(event.message ?? null);
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

  const describeFriendlyTranscriptionError = (
    language: 'da' | 'en',
    result: { code?: string; message: string },
  ) => {
    const fallbackMessage =
      language === 'da'
        ? 'Noget gik galt under transskriptionen. Prøv igen.'
        : 'Something went wrong during transcription. Please try again.';

    switch (result.code) {
      case 'aborted':
        return language === 'da'
          ? 'Transskriptionsanmodningen blev afbrudt. Prøv igen.'
          : 'The transcription request was aborted. Please try again.';
      case 'network_error':
        return language === 'da'
          ? 'Netværksfejl under transskription. Tjek forbindelsen og prøv igen.'
          : 'Network problem during transcription. Please try again.';
      case 'timeout':
        return language === 'da'
          ? 'Transskriptionen tog for lang tid. Tjek forbindelsen og prøv igen.'
          : 'The transcription timed out. Check your connection and try again.';
      case 'http_error':
        return language === 'da'
          ? 'Serveren kunne ikke transskribere lyden. Prøv igen senere.'
          : 'The server could not transcribe the audio. Please try again shortly.';
      default:
        return result.message || fallbackMessage;
    }
  };

  const startTranscription = async (language: 'da' | 'en', agenda: string, audioUri: string) => {
    cleanupTranscription();
    setIsTranscribing(true);
    setTranscript('');
    setProgressStep('uploading');
    setTranscribeProgress(12);
    setActivityLog([]);
    setTranscriptionPhase('uploading');
    setTranscriptionError(null);
    console.log('[RecorderScreen] Preparing transcription', { audioUri, language });

    const uploadingMessage =
      language === 'da'
        ? 'Uploader lyd til transskription...'
        : 'Uploading audio for transcription...';
    setStatusMessage(uploadingMessage);
    addLogEntry(uploadingMessage);

    const describeClosedWithoutResult = () =>
      language === 'da'
        ? 'Transskriptionen blev lukket uden resultat'
        : 'The transcription closed without a result';

    const isTranscriptionResult = (value: unknown): value is TranscriptionResult =>
      !!value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean';

    const hasResultPromise = (
      value: unknown,
    ): value is { resultPromise: Promise<TranscriptionResult> } => {
      if (!value || typeof value !== 'object' || !('resultPromise' in value)) return false;
      return (value as { resultPromise?: unknown }).resultPromise instanceof Promise;
    };

    const extractResultPromise = (
      response: unknown,
      fallback: Promise<TranscriptionResult>,
    ): Promise<TranscriptionResult> => {
      if (isTranscriptionResult(response)) {
        return Promise.resolve(response);
      }

      if (hasResultPromise(response)) {
        return response.resultPromise;
      }

      return fallback;
    };

    let resolveResult: ((result: TranscriptionResult) => void) | null = null;
    let settled = false;
    const resultPromiseFromEvents = new Promise<TranscriptionResult>((resolve) => {
      resolveResult = resolve;
    });

    const settleResult = (result: TranscriptionResult) => {
      if (settled) return;
      settled = true;
      resolveResult?.(result);
    };

    const wrappedOnEvent = (event: TranscriptionEvent) => {
      handleTranscriptionEvent(language, event);

      if (event.type === 'final') {
        settleResult({ ok: true, text: event.text ?? '' });
      }

      if (event.type === 'error') {
        settleResult({
          ok: false,
          code: 'error',
          message:
            event.message ??
            (language === 'da'
              ? 'Transskriptionen mislykkedes'
              : 'Transcription failed'),
        });
      }

      if (event.type === 'closed' && !settled) {
        settleResult({ ok: false, code: 'aborted', message: describeClosedWithoutResult() });
      }
    };

    try {
      setTranscriptionPhase('transcribing');
      setProgressStep('transcribing');
      updateTranscribeProgress('transcribing');
      console.log('[RecorderScreen] Calling transcribeAudio', {
        audioUri,
        language,
        agendaLength: agenda.length,
      });
      const response = await transcribeAudio({
        audioUri,
        language,
        agenda,
        onEvent: wrappedOnEvent,
      });

      if (typeof response === 'function') {
        transcriptionSubscription.current = response;
      }

      const resultPromise = extractResultPromise(response, resultPromiseFromEvents);
      const transcriptionResult = await resultPromise.catch((error) => {
        console.error('[RecorderScreen] Transcription promise rejected', error);
        const fallbackMessage =
          language === 'da'
            ? 'Noget gik galt under transskriptionen. Prøv igen.'
            : 'Something went wrong during transcription. Please try again.';
        return {
          ok: false,
          code: 'error',
          message: describeError(error) || fallbackMessage,
        } satisfies TranscriptionResult;
      });

      settleResult(transcriptionResult);

      console.log('[RecorderScreen] Transcription result from helper', {
        ok: transcriptionResult.ok,
        code: transcriptionResult.ok ? 'success' : transcriptionResult.code,
      });

      if (transcriptionResult.ok) {
        setTranscript(transcriptionResult.text);
        setTranscribeProgress(100);
        setProgressStep('completed');
        setTranscriptionPhase('done');
        setTranscriptionError(null);
        console.log('[RecorderScreen] Transcription succeeded', {
          snippet: transcriptionResult.text.slice(0, 80),
        });
        const successMessage =
          language === 'da' ? 'Transskription fuldført.' : 'Transcription completed.';
        setStatusMessage(successMessage);
        addLogEntry(successMessage);
      } else {
        const friendly = describeFriendlyTranscriptionError(language, transcriptionResult);
        setTranscriptionPhase('error');
        setProgressStep('error');
        setTranscriptionError(friendly);
        setStatusMessage(friendly);
        addLogEntry(friendly);
        setTranscribeProgress(0);
        console.error('[RecorderScreen] Transcription failed', { code: transcriptionResult.code });
      }
    } catch (error) {
      console.error('[RecorderScreen] Transcription threw unexpectedly', error);
      const detail = describeError(error);
      const fallbackMessage =
        language === 'da'
          ? 'Noget gik galt under transskriptionen. Prøv igen.'
          : 'Something went wrong during transcription. Please try again.';
      setProgressStep('error');
      setTranscriptionPhase('error');
      setTranscriptionError(detail || fallbackMessage);
      setStatusMessage(fallbackMessage);
      addLogEntry(fallbackMessage);
      setTranscribeProgress(0);
    } finally {
      setIsTranscribing(false);
      console.log('[RecorderScreen] Transcription flow cleanup', { phase: transcriptionPhaseRef.current });
    }
  };

  const resetTranscriptionUi = () => {
    setProgressStep('idle');
    setTranscriptionPhase('idle');
    setTranscriptionError(null);
    setStatusMessage('');
    setTranscribeProgress(0);
    setActivityLog([]);
    setIsTranscribing(false);
    console.log('[RecorderScreen] Transcription UI reset', {
      transcriptionPhase: 'idle',
      progress: 0,
    });
  };

  const startQuickRecording = async () => {
    console.log('[RecorderScreen] Start recording requested');
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusMessage(
          transcriptionLanguage === 'da'
            ? 'Tillad mikrofonadgang for at optage'
            : 'Please allow microphone access to record',
        );
        setTranscriptionPhase('error');
        setTranscriptionError('Microphone permission not granted');
        return;
      }

      if (playbackSound.current) {
        const status = await playbackSound.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await playbackSound.current.pauseAsync();
          await playbackSound.current.setPositionAsync(0);
        }
        setIsPlaying(false);
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
      setTranscriptionPhase('recording');
      setTranscriptionError(null);
      console.log('[RecorderScreen] Recording started', {
        language: transcriptionLanguage,
        agendaLength: quickAgenda.length,
      });
    } catch (error) {
      console.error('Failed to start quick recording', error);
      const detail = describeError(error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? `Kunne ikke starte optagelse: ${detail}`
          : `Unable to start recording: ${detail}`,
      );
      setProgressStep('error');
      setTranscriptionPhase('error');
      setTranscriptionError(detail);
      addLogEntry(
        transcriptionLanguage === 'da'
          ? `Fejl: Optagelsen kunne ikke startes. ${detail}`
          : `Error: Unable to start recording. ${detail}`
      );
    }
  };

  const stopQuickRecording = async () => {
    console.log('[RecorderScreen] Stop & Transcribe pressed', {
      hasRecording: !!quickRecording,
      uri: quickRecording?.getURI?.(),
    });
    if (!quickRecording) {
      const message =
        transcriptionLanguage === 'da'
          ? 'Ingen aktiv optagelse at stoppe'
          : 'No active recording to stop';
      setStatusMessage(message);
      setTranscriptionPhase('error');
      setTranscriptionError(message);
      addLogEntry(message);
      return;
    }

    setTranscriptionPhase('stopping');

    try {
      const recordingUri = quickRecording.getURI();
      console.log('[RecorderScreen] Stopping recording...', { recordingUri });
      await quickRecording.stopAndUnloadAsync();
      const resolvedUri = quickRecording.getURI();
      console.log('[RecorderScreen] Recording stopped', { recordingUri, resolvedUri });
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
      setTranscriptionPhase('uploading');
      setTranscriptionError(null);
      setIsRecording(false);
      setQuickRecording(null);
      setLastRecordingUri(resolvedUri ?? recordingUri ?? null);
      const finalUri = resolvedUri ?? recordingUri;
      if (finalUri) {
        console.log('[RecorderScreen] Invoking transcription', { uri: finalUri });
        await startTranscription(transcriptionLanguage, quickAgenda, finalUri);
      } else {
        setProgressStep('error');
        const message =
          transcriptionLanguage === 'da'
            ? 'Kunne ikke finde lydfilen efter optagelsen'
            : 'Could not access the recording file';
        setStatusMessage(message);
        addLogEntry(message);
        setTranscriptionPhase('error');
        setTranscriptionError(message);
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
      setTranscriptionPhase('error');
      setTranscriptionError(detail);
      addLogEntry(
        transcriptionLanguage === 'da'
          ? `Fejl: Optagelsen kunne ikke stoppes. ${detail}`
          : `Error: Unable to stop recording. ${detail}`
      );
    } finally {
      setIsRecording(false);
      setQuickRecording(null);
      console.log('[RecorderScreen] Stop & Transcribe handler finished', {
        transcriptionPhase: transcriptionPhaseRef.current,
      });
    }
  };

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  const playLatestRecording = async () => {
    try {
      if (!lastRecordingUri) {
        setStatusMessage(
          transcriptionLanguage === 'da'
            ? 'Ingen optagelse klar til afspilning'
            : 'No recording ready to play',
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: false,
      });

      if (playbackSound.current) {
        const status = await playbackSound.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await playbackSound.current.pauseAsync();
            setIsPlaying(false);
            return;
          }
          await playbackSound.current.setPositionAsync(0);
          await playbackSound.current.playAsync();
          setIsPlaying(true);
          return;
        }

        await playbackSound.current.unloadAsync();
        playbackSound.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: lastRecordingUri },
        { shouldPlay: true },
        handlePlaybackStatus,
      );

      playbackSound.current = sound;
      setIsPlaying(true);
      setStatusMessage(
        transcriptionLanguage === 'da' ? 'Afspiller seneste optagelse' : 'Playing latest recording',
      );
    } catch (error) {
      console.error('Failed to play recording', error);
      const detail = describeError(error);
      setStatusMessage(
        transcriptionLanguage === 'da'
          ? `Kunne ikke afspille optagelsen: ${detail}`
          : `Unable to play the recording: ${detail}`,
      );
      addLogEntry(detail);
      setIsPlaying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Header title="Optag møder enkelt" subtitle="Start optagelse eller spring direkte til lyd." />

        <SectionCard title="1. Planlagt møde" actionLabel="Med dagsorden">
          <Text style={styles.helper}>Gem dagsorden og optag – så følger teksten punkterne.</Text>
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
              Lyd gemmes lokalt og transskriberes automatisk.
            </Text>
          </View>
        </SectionCard>

        <SectionCard title="2. Hurtig optagelse" actionLabel="Start nu">
          <Text style={styles.helper}>Skriv kort hvad der skal med og optag med det samme.</Text>
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
          <View style={styles.buttonRow}>
            <ActionButton
              label={isRecording ? 'Stop optagelse' : 'Start optagelse'}
              tone="primary"
              onPress={isRecording ? stopQuickRecording : startQuickRecording}
            />
            <ActionButton
              label={isPlaying ? 'Pause lyd' : 'Afspil lyd'}
              tone="secondary"
              onPress={playLatestRecording}
              disabled={!lastRecordingUri || isRecording}
            />
          </View>
          <View style={styles.transcriptBox}>
            <View style={styles.statusRow}>
              <Pill label={isRecording ? 'Live' : 'Klar'} tone={isRecording ? 'accent' : 'default'} />
              {isRecording && <Text style={styles.liveTime}>{formatDuration(recordingDuration)}</Text>}
            </View>
            <Text style={styles.meta}>
              {isRecording
                ? 'Optager nu. Tilføj noter undervejs.'
                : isTranscribing
                  ? 'Transskriberer lyd...'
                  : transcript
                    ? transcriptionLanguage === 'da'
                      ? 'Seneste optagelse er klar til afspilning.'
                      : 'Latest recording ready to play.'
                    : 'Klar til næste optagelse.'}
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
            {transcriptionPhase === 'error' && transcriptionError ? (
              <View style={styles.errorRow}>
                <Text style={styles.errorMessage}>{transcriptionError}</Text>
                <Text style={styles.retryLink} onPress={resetTranscriptionUi}>
                  {transcriptionLanguage === 'da' ? 'Prøv igen' : 'Try again'}
                </Text>
              </View>
            ) : null}
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
            <Text style={styles.debugLabel}>
              {`[debug] Transcription phase: ${transcriptionPhase}`}
              {transcriptionError ? ` — ${transcriptionError}` : ''}
            </Text>
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
            {transcriptionPhase === 'done' && transcript ? (
              <Text style={styles.transcriptText}>{transcript}</Text>
            ) : transcriptionPhase === 'error' && transcriptionError ? (
              <Text style={styles.transcriptError}>{transcriptionError}</Text>
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  errorMessage: {
    color: colors.accent,
    fontWeight: '600',
  },
  retryLink: {
    color: colors.textSecondary,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
  debugLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
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
  transcriptError: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  transcriptPlaceholder: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
