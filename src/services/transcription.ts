export type TranscriptionEvent =
  | { type: 'status'; message?: string }
  | { type: 'progress'; progress?: number; step?: 'uploading' | 'transcribing' | 'completed' }
  | { type: 'partial'; text?: string; progress?: number; message?: string }
  | { type: 'final'; text?: string; message?: string }
  | { type: 'error'; message?: string }
  | { type: 'closed' };

export type TranscriptionResult =
  | { ok: true; text: string }
  | { ok: false; code: string; message: string; status?: number; rawBodySnippet?: string };

export type TranscriptionOptions = {
  audioUri: string;
  language: 'da' | 'en';
  agenda?: string;
  onEvent: (event: TranscriptionEvent) => void;
  apiBaseUrl?: string;
  onDevice?: boolean;
  cancelSignal?: AbortSignal;
};

const DEFAULT_API_BASE = process.env.EXPO_PUBLIC_TRANSCRIPTION_API;
const USE_ON_DEVICE = process.env.EXPO_PUBLIC_WHISPER_ON_DEVICE === 'true';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

const toWebSocketUrl = (httpUrl: string) => {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

type WhisperAbortReason = 'timeout' | 'cancelled';

export const createWhisperAbortManager = (
  abortController: AbortController,
  timeoutMs: number,
  onTimeoutResult: (elapsedMs: number) => TranscriptionResult,
) => {
  const startedAt = Date.now();
  let reason: WhisperAbortReason | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const requestAbort = (nextReason: WhisperAbortReason) => {
    if (reason) return reason;

    reason = nextReason;
    const elapsedMs = Date.now() - startedAt;
    console.warn('[Transcription] Whisper abort requested', { reason, elapsedMs });
    abortController.abort();

    return reason;
  };

  const timeoutPromise = new Promise<TranscriptionResult>((resolve) => {
    timeoutId = setTimeout(() => {
      requestAbort('timeout');
      resolve(onTimeoutResult(Date.now() - startedAt));
    }, timeoutMs);
  });

  const clearTimeoutIfNeeded = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return {
    timeoutPromise,
    requestAbort,
    clearTimeoutIfNeeded,
    getAbortReason: () => reason,
  };
};

export async function transcribeAudio({
  audioUri,
  language,
  agenda,
  onEvent,
  apiBaseUrl = DEFAULT_API_BASE,
  onDevice = USE_ON_DEVICE,
  cancelSignal,
}: TranscriptionOptions): Promise<() => void> {
  console.log('[Transcription] Starting transcription helper', {
    audioUri,
    language,
    hasAgenda: !!agenda,
    apiBaseUrl,
    onDevice,
  });
  const abortController = new AbortController();
  console.log('[Transcription] AbortController created for transcription helper');
  let socket: WebSocket | null = null;
  let closed = false;
  let requestAbort: ((reason: WhisperAbortReason) => WhisperAbortReason | null) | null = null;

  const useOnDeviceWhisper = onDevice;
  const useDirectWhisper = !apiBaseUrl && !useOnDeviceWhisper;

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

  const toSnippet = (value: unknown, length = 200) => {
    if (!value) return undefined;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.slice(0, length);
  };

  const emit = (event: TranscriptionEvent) => {
    if (closed) return;
    onEvent(event);
  };

  const transcribeOnDevice = async () => {
    emit({
      type: 'status',
      message:
        language === 'da'
          ? 'Indlæser Whisper-modellen på enheden'
          : 'Loading Whisper model on device',
    });
    updateProgress('uploading');

    const { pipeline } = await import('@xenova/transformers');
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const transcriber = await withTimeout(
      pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        quantized: true,
      }),
      45_000,
      language === 'da'
        ? 'Tidsudløb under indlæsning af Whisper-modellen på enheden. Deaktiver on-device mode for at bruge serveren i stedet.'
        : 'Timed out while loading the Whisper model on-device. Disable on-device mode to fall back to the server.',
    );

    emit({
      type: 'status',
      message:
        language === 'da'
          ? 'Whisper kører på enheden. Starter transskription'
          : 'Running Whisper on-device. Starting transcription',
    });
    updateProgress('transcribing');

    const response = await fetch(audioUri);
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: 'audio/m4a' });

    const result = await transcriber(blob, {
      language,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const text = result?.text as string | undefined;
    if (!text) {
      throw new Error('Whisper on-device did not produce text');
    }

    emit({
      type: 'final',
      text,
      message:
        language === 'da'
          ? 'Transskription fuldført på enheden'
          : 'Transcription completed on-device',
    });
    emit({ type: 'progress', step: 'completed', progress: 100 });
  };

  const updateProgress = (step: 'uploading' | 'transcribing' | 'completed') => {
    const stepProgress: Record<typeof step, number> = {
      uploading: 10,
      transcribing: 50,
      completed: 100,
    };
    emit({ type: 'progress', step, progress: stepProgress[step] });
  };

  const transcribeWithOpenAI = async (): Promise<TranscriptionResult> => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      const result: TranscriptionResult = {
        ok: false,
        code: 'missing_api_key',
        message: 'Missing EXPO_PUBLIC_OPENAI_API_KEY for direct Whisper transcription',
      };
      console.error('[Transcription] Direct Whisper configuration error', result);
      return result;
    }

    const formData = new FormData();
    formData.append('file', audioFile as unknown as Blob);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    if (agenda) {
      formData.append('prompt', agenda);
    }

    const whisperRequestConfig = {
      endpoint: OPENAI_TRANSCRIPTIONS_URL,
      method: 'POST',
      model: 'whisper-1',
      language,
      hasAgenda: !!agenda,
      uri: audioUri,
    } as const;

    emit({
      type: 'status',
      message:
        language === 'da'
          ? 'Sender lyd direkte til Whisper (ingen backend)'
          : 'Sending audio directly to Whisper (no backend)',
    });
    emit({ type: 'progress', step: 'uploading', progress: 10 });
    const timeoutMs = 60_000;
    console.log('[Transcription] AbortController prepared for Whisper request', { timeoutMs });
    console.log('[Transcription] Whisper request starting', whisperRequestConfig);
    const abortManager = createWhisperAbortManager(abortController, timeoutMs, (elapsedMs) => {
      console.warn('[Transcription] Whisper request timed out', { timeoutMs, elapsedMs });
      return {
        ok: false,
        code: 'timeout',
        message: 'Transcription request timed out',
      } satisfies TranscriptionResult;
    });
    requestAbort = abortManager.requestAbort;
    const cancelListener = () => abortManager.requestAbort('cancelled');

    if (cancelSignal?.aborted) {
      cancelListener();
    } else if (cancelSignal) {
      cancelSignal.addEventListener('abort', cancelListener);
    }

    const fetchPromise = (async (): Promise<TranscriptionResult> => {
      try {
        const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
          signal: abortController.signal,
        }).catch((error) => {
          throw new Error(describeNetworkError(error));
        });

        emit({ type: 'progress', step: 'transcribing', progress: 50 });

        console.log('[Transcription] Whisper HTTP completed', {
          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const snippet = toSnippet(body);
          console.error('[Transcription] Whisper HTTP error', {
            status: response.status,
            bodySnippet: snippet,
          });
          const result: TranscriptionResult = {
            ok: false,
            code: 'http_error',
            message: `Whisper responded with status ${response.status}`,
            status: response.status,
            rawBodySnippet: snippet,
          };
          emit({ type: 'error', message: result.message });
          return result;
        }

        const payloadText = await response.text();
        const snippet = toSnippet(payloadText);
        let payload: unknown;
        try {
          payload = JSON.parse(payloadText);
        } catch (parseError) {
          console.error('[Transcription] Unable to parse Whisper response JSON', parseError);
        }

        const text = (payload as { text?: string } | undefined)?.text;
        if (!text) {
          const result: TranscriptionResult = {
            ok: false,
            code: 'invalid_response',
            message: 'Transcription response did not include text',
            rawBodySnippet: snippet,
          };
          console.error('[Transcription] Whisper response missing text', result);
          emit({ type: 'error', message: result.message });
          return result;
        }

        const result: TranscriptionResult = { ok: true, text };
        emit({
          type: 'final',
          text,
          message:
            language === 'da'
              ? 'Transskription fuldført via Whisper'
              : 'Transcription completed via Whisper',
        });
        emit({ type: 'progress', step: 'completed', progress: 100 });
        console.log('[Transcription] Whisper HTTP success', {
          status: response.status,
          bodySnippet: snippet,
        });
        return result;
      } catch (error) {
        const asError = error as Error;
        const abortReason =
          abortManager.getAbortReason() ??
          (abortController.signal.aborted || asError?.name?.toLowerCase().includes('abort')
            ? 'cancelled'
            : null);
        const isAborted = abortReason !== null;
        const result: TranscriptionResult = isAborted
          ? {
              ok: false,
              code: abortReason === 'timeout' ? 'timeout' : 'aborted',
              message:
                abortReason === 'timeout'
                  ? 'Transcription request timed out'
                  : 'Transcription request was cancelled',
              rawBodySnippet: toSnippet(error),
            }
          : {
              ok: false,
              code: 'unknown_error',
              message: 'Transcription failed unexpectedly',
              rawBodySnippet: toSnippet(error),
            };
        if (isAborted) {
          console.warn('[Transcription] Whisper request aborted', error);
        } else {
          console.error('[Transcription] Whisper request failed', error);
        }
        emit({ type: 'error', message: result.message });
        return result;
      } finally {
        if (cancelSignal && cancelListener) {
          cancelSignal.removeEventListener('abort', cancelListener);
        }
        abortManager.clearTimeoutIfNeeded();
      }
    })();

    const result = await Promise.race([fetchPromise, abortManager.timeoutPromise]);
    console.log('[Transcription] Helper finished', {
      ok: result.ok,
      code: result.ok ? 'success' : result.code,
      hasText: !!(result as { text?: string }).text,
    });
    return result;
  };

  const uploadAudio = async () => {
    if (!apiBaseUrl) {
      throw new Error('Transcription API base URL is missing');
    }

    emit({
      type: 'status',
      message:
        language === 'da'
          ? "Uploader lyd til transskriptions-API'et"
          : 'Uploading audio to transcription API',
    });
    updateProgress('uploading');

    const formData = new FormData();
    formData.append('file', audioFile as unknown as Blob);
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

    emit({
      type: 'status',
      message:
        language === 'da'
          ? 'Upload fuldført. Forbinder til transskriptionsstream...'
          : 'Upload finished. Connecting to transcription stream...',
    });
    updateProgress('transcribing');

    return payload.id as string;
  };

  const connectWebSocket = (id: string) => {
    if (!apiBaseUrl) {
      throw new Error('Transcription API base URL is missing');
    }

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

  if (useOnDeviceWhisper) {
    console.log('[Transcription] Using on-device Whisper flow');
    transcribeOnDevice()
      .then(() => emit({ type: 'closed' }))
      .catch((error) => {
        console.error('[Transcription] On-device whisper failed', error);
        emit({ type: 'error', message: describeNetworkError(error) });
        emit({ type: 'closed' });
      });

    return () => {
      closed = true;
      if (!requestAbort) {
        abortController.abort();
        return;
      }
      requestAbort('cancelled');
    };
  }

  if (useDirectWhisper) {
    console.log('[Transcription] Using direct Whisper API flow');
    transcribeWithOpenAI()
      .then((result) => {
        if (!result.ok) {
          emit({ type: 'error', message: result.message });
        }
        emit({ type: 'closed' });
      })
      .catch((error) => {
        console.error('[Transcription] Direct Whisper API failed', error);
        emit({ type: 'error', message: describeNetworkError(error) });
        emit({ type: 'closed' });
      });

    return () => {
      closed = true;
      if (!requestAbort) {
        abortController.abort();
        return;
      }
      requestAbort('cancelled');
    };
  }

  const transcriptionId = await uploadAudio();
  console.log('[Transcription] Upload completed, connecting to websocket', { transcriptionId });
  emit({ type: 'status', message: 'Transcription upload complete' });
  connectWebSocket(transcriptionId);

  return () => {
    closed = true;
    if (!requestAbort) {
      abortController.abort();
      socket?.close();
      return;
    }
    requestAbort('cancelled');
    socket?.close();
  };
}
