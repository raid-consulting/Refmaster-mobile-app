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

const DEFAULT_API_BASE = process.env.EXPO_PUBLIC_TRANSCRIPTION_API || 'https://api.example.com';

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

  const emit = (event: TranscriptionEvent) => {
    if (closed) return;
    onEvent(event);
  };

  const uploadAudio = async () => {
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      name: 'recording.m4a',
      type: 'audio/m4a',
    } as any);
    formData.append('provider', 'whisper');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    if (agenda) {
      formData.append('agenda', agenda);
    }

    const response = await fetch(`${apiBaseUrl}/transcriptions`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Failed to upload audio for transcription');
    }

    const payload = await response.json();
    if (!payload?.id) {
      throw new Error('Transcription request did not return an id');
    }

    return payload.id as string;
  };

  const connectWebSocket = (id: string) => {
    const streamUrl = `${toWebSocketUrl(apiBaseUrl)}/transcriptions/${id}/stream`;
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

  const transcriptionId = await uploadAudio();
  emit({ type: 'status', message: 'Transcription upload complete' });
  connectWebSocket(transcriptionId);

  return () => {
    closed = true;
    abortController.abort();
    socket?.close();
  };
}
