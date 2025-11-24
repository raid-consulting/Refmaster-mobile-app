export type TranscriptionEvent =
  | { type: 'status'; message?: string }
  | { type: 'progress'; progress?: number; step?: 'uploading' | 'transcribing' | 'completed' }
  | { type: 'partial'; text?: string; progress?: number; message?: string }
  | { type: 'final'; text?: string; message?: string }
  | { type: 'error'; message?: string }
  | { type: 'closed' };

export type TranscriptionOptions = {
  audioUri: string;
  language: 'da' | 'en';
  agenda?: string;
  onEvent: (event: TranscriptionEvent) => void;
  apiBaseUrl?: string;
};

const DEFAULT_API_BASE = process.env.EXPO_PUBLIC_TRANSCRIPTION_API;
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const FORCE_BACKEND = process.env.EXPO_PUBLIC_FORCE_BACKEND === 'true';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

const toWebSocketUrl = (httpUrl: string) => {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

export async function transcribeAudio({
  audioUri,
  language,
  agenda,
  onEvent,
  apiBaseUrl = DEFAULT_API_BASE,
}: TranscriptionOptions): Promise<() => void> {
  const abortController = new AbortController();
  let socket: WebSocket | null = null;
  let closed = false;

  const apiBase = apiBaseUrl?.trim();
  const hasApiBase = Boolean(apiBase);
  const hasOpenAiKey = Boolean(OPENAI_API_KEY);
  const preferDirectWhisper = hasOpenAiKey && (!hasApiBase || !FORCE_BACKEND);

  const audioFile: { uri: string; name: string; type: string } = {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  };

  const describeNetworkError = (error: unknown) => {
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      return `Network request failed. Check your connection or that the transcription API (${apiBaseUrl}) is reachable.`;
    }

    if (error instanceof Error) return error.message;
    return String(error);
  };

  const emit = (event: TranscriptionEvent) => {
    if (closed) return;
    onEvent(event);
  };

  const transcribeWithOpenAI = async () => {
    if (!OPENAI_API_KEY) {
      throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY for direct Whisper transcription');
    }

    const formData = new FormData();
    formData.append('file', audioFile as unknown as Blob);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    if (agenda) {
      formData.append('prompt', agenda);
    }

    emit({
      type: 'status',
      message:
        language === 'da'
          ? 'Sender lyd direkte til Whisper (ingen backend)'
          : 'Sending audio directly to Whisper (no backend)',
    });
    emit({ type: 'progress', step: 'uploading', progress: 10 });

    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
      signal: abortController.signal,
    }).catch((error) => {
      throw new Error(describeNetworkError(error));
    });

    emit({ type: 'progress', step: 'transcribing', progress: 50 });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      const fallback = `Whisper request failed (status ${response.status})`;
      throw new Error(message || fallback);
    }

    const payload = await response.json();
    const text = payload?.text as string | undefined;
    if (!text) {
      throw new Error('Transcription response did not include text');
    }

    emit({
      type: 'final',
      text,
      message:
        language === 'da'
          ? 'Transskription fuldført via Whisper'
          : 'Transcription completed via Whisper',
    });
    emit({ type: 'progress', step: 'completed', progress: 100 });
  };

  const uploadAudio = async () => {
    if (!apiBase) {
      throw new Error('Transcription API base URL is missing');
    }

    const formData = new FormData();
    formData.append('file', audioFile as unknown as Blob);
    formData.append('provider', 'whisper');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    if (agenda) {
      formData.append('agenda', agenda);
    }

    const response = await fetch(`${apiBase}/transcriptions`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    }).catch((error) => {
      throw new Error(describeNetworkError(error));
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      const fallback = `Failed to upload audio for transcription (status ${response.status})`;
      throw new Error(message || fallback);
    }

    const payload = await response.json();
    if (!payload?.id) {
      throw new Error('Transcription request did not return an id');
    }

    return payload.id as string;
  };

  const connectWebSocket = (id: string) => {
    if (!apiBase) {
      throw new Error('Transcription API base URL is missing');
    }

    const streamUrl = `${toWebSocketUrl(apiBase)}/transcriptions/${id}/stream`;
    socket = new WebSocket(streamUrl);

    socket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data as string);
        if (data?.type) {
          emit(data as TranscriptionEvent);
        }
      } catch (error) {
        console.warn('Unable to parse transcription event', error);
        emit({ type: 'status', message: String(message.data) });
      }
    };

    socket.onerror = () => {
      emit({ type: 'error', message: 'Transcription stream error' });
    };

    socket.onclose = () => {
      emit({ type: 'closed' });
    };
  };

  const startDirectTranscription = () => {
    transcribeWithOpenAI()
      .then(() => emit({ type: 'closed' }))
      .catch((error) => {
        emit({ type: 'error', message: describeNetworkError(error) });
        emit({ type: 'closed' });
      });
  };

  const startBackendTranscription = async () => {
    const transcriptionId = await uploadAudio();
    emit({ type: 'status', message: 'Transcription upload complete' });
    connectWebSocket(transcriptionId);
  };

  const startPreferredFlow = () => {
    if (preferDirectWhisper) {
      startDirectTranscription();
      return;
    }

    if (!hasApiBase) {
      emit({
        type: 'error',
        message:
          language === 'da'
            ? 'Ingen transskriptionsopsætning fundet. Tilføj en OpenAI API-nøgle.'
            : 'No transcription setup found. Add an OpenAI API key to use Whisper directly.',
      });
      emit({ type: 'closed' });
      return;
    }

    startBackendTranscription().catch((error) => {
      if (hasOpenAiKey && !FORCE_BACKEND) {
        emit({
          type: 'status',
          message:
            language === 'da'
              ? 'Backend utilgængelig, skifter til direkte Whisper-transskription'
              : 'Backend unavailable, falling back to direct Whisper transcription',
        });
        startDirectTranscription();
        return;
      }

      emit({ type: 'error', message: describeNetworkError(error) });
      emit({ type: 'closed' });
    });
  };

  startPreferredFlow();

  return () => {
    closed = true;
    abortController.abort();
    socket?.close();
  };
}
