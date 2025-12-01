import type { TranscriptionResult } from './transcription';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const assert = require('node:assert');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createWhisperAbortManager } = require('./transcription');

async function testTimeoutAborts() {
  const abortController = new AbortController();
  const abortManager = createWhisperAbortManager(abortController, 20, (): TranscriptionResult => ({
    ok: false,
    code: 'timeout',
    message: 'too slow',
  }));

  const result = await abortManager.timeoutPromise;
  assert.strictEqual(result.ok, false);
  assert.strictEqual((result as Extract<TranscriptionResult, { ok: false }>).code, 'timeout');
  assert.strictEqual(abortManager.getAbortReason(), 'timeout');
  assert.strictEqual(abortController.signal.aborted, true);
}

async function testManualCancel() {
  const abortController = new AbortController();
  const abortManager = createWhisperAbortManager(abortController, 50, (): TranscriptionResult => ({
    ok: false,
    code: 'timeout',
    message: 'timeout',
  }));

  abortManager.requestAbort('cancelled');
  abortManager.clearTimeoutIfNeeded();

  assert.strictEqual(abortManager.getAbortReason(), 'cancelled');
  assert.strictEqual(abortController.signal.aborted, true);
}

(async () => {
  await testTimeoutAborts();
  await testManualCancel();
  console.log('transcription abort manager tests passed');
})();
