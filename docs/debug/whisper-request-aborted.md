**Bug:** Direct Whisper transcription requests from the Recorder screen are always aborted.

**Context:** In the Refmaster mobile app (Expo/React Native), the Recorder screen records audio and calls a transcription helper that uses OpenAI Whisper via the direct HTTP API. The logs show:

* `[Transcription] AbortController created for transcription helper`
* `[Transcription] Using direct Whisper API flow`
* `[Transcription] Sending direct Whisper request { endpoint: "https://api.openai.com/v1/audio/transcriptions", ... }`
* `Whisper request aborted [Error: Aborted]`
* `Helper finished {"code":"aborted","message":"Transcription request was aborted","ok":false,...}`

The RecorderScreen logs up to `[RecorderScreen] Calling transcribeAudio` but never logs a successful result or clear error, and the UI remains stuck at 10% progress / `stopping`. This indicates the AbortController or timeout logic in the helper is incorrectly aborting requests, preventing Whisper from ever returning a transcript.

dc79ecf - Investigation 1
-------------------------

*Context (what changed in this commit).* Added a dedicated Whisper abort manager to log abort reasons with elapsed time, distinguish timeout vs. manual cancellation, and feed the reason back into the helper result. Also added a small regression test harness for the abort manager and wired package scripts to run it via Node's test runner + ts-node.

*Observations from logs and tests.* Helper previously only surfaced a generic `aborted` code when the AbortController fired, so a timeout-triggered abort was indistinguishable from an explicit cancellation. There were no logs indicating why the abort occurred or how long the request ran. New abort logging now emits `[Transcription] Whisper abort requested { reason, elapsedMs }` before aborting. The new unit tests show the manager marks timeout-triggered aborts as `timeout` and manual cancels as `cancelled`.

*Hypothesis and fix attempted.* The direct Whisper flow was likely hitting the timeout path, but because the abort reason was not preserved, the helper returned `{ ok: false, code: 'aborted' }`, leaving the UI stuck. By tracking the abort reason and returning `code: 'timeout'` when appropriate, we can avoid silent aborts and get clearer diagnostics. Longer-term this logging will confirm whether the timeout is too aggressive on device.

*Result (fixed, partially fixed, still failing).* Partially fixed: aborts now report their reason and elapsed time, and timeout-triggered aborts return `code: 'timeout'` instead of the generic `aborted`. Manual cancellation is also logged distinctly. A new regression test validates the abort manager behaviour. Manual simulator/device verification is still pending.
