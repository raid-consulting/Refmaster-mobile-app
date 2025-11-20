# Meeting Recorder & Agenda Alignment: Implementation Plan

This plan outlines a step-by-step approach for delivering a mobile app that records meetings, transcribes audio (Danish/English), and aligns transcript segments to agenda points.

## 1) Foundations
- **Define requirements:** Confirm target platforms (iOS/Android), offline needs, data retention, security/compliance (e.g., GDPR), and supported agenda formats (manual entry, calendar import, templates).
- **Select tech stack:** Decide on cross-platform framework (e.g., React Native/Expo or Flutter) and native modules for audio, background permissions, and file access.
- **Service decisions:** Choose transcription provider(s) that support Danish and English (e.g., on-device models for privacy vs. cloud APIs for accuracy). Document pricing, rate limits, and latency expectations.
- **Data model sketch:** Draft entities for `Meeting`, `AgendaItem`, `RecordingSegment`, `TranscriptSegment`, and `Alignment` relationships.

## 2) Audio Capture
- **Permissions flow:** Implement microphone permissions with graceful fallbacks and user education screens.
- **Recording controls:** Add start/pause/resume/stop with visual meters, elapsed time, and file size indicators. Store raw audio (WAV/FLAC for quality) with metadata linking to the meeting and agenda.
- **Resilience:** Auto-save checkpoints to avoid data loss on app termination; handle phone calls/interruptions; enforce max duration or storage limits.
- **Background/lock screen:** Support continued recording with OS-compliant background modes and notification controls where allowed.

## 3) Transcription Pipeline
- **Chunking strategy:** Split long recordings into chunks with overlap to avoid boundary word loss; normalize audio levels before sending to the model/API.
- **Language handling:** Auto-detect vs. user-selected language (Danish/English). Capture confidence scores per word/segment.
- **Hybrid options:** Allow on-device transcription for privacy-sensitive sessions and cloud mode for higher accuracy/speed. Queue uploads with retry/backoff and offline caching.
- **Metadata:** Store timestamps, speaker labels (if diarization available), and word-level timing when provided.

## 4) Agenda Alignment
- **Agenda ingestion:** Let users create/import agendas before recording (title, description, expected duration/order). Persist version used for the meeting.
- **Alignment heuristic (MVP):**
  - Preprocess agenda titles/descriptions and transcript segments (lowercase, tokenize, remove stopwords).
  - Use vector similarity (e.g., sentence embeddings) or keyword overlap to match transcript chunks to agenda points.
  - Apply chronological constraints (agenda order) with a sliding window to avoid jumps.
- **Enhanced alignment:**
  - Integrate LLM reranker for low-confidence matches.
  - Use timing hints (expected durations) to bias alignment.
  - Allow manual correction UI with drag/drop and confidence indicators.
- **Outputs:** Store `Alignment` objects mapping transcript ranges to agenda items, with confidence scores and reasons for matches.

## 5) UI/UX Flows
- **Home/meetings list:** Create screens for scheduled/past meetings with agenda previews and recording status.
- **Recorder screen:** Prominent controls, wave visualization, agenda sidebar to show progress and currently matched item.
- **Live transcription (if supported):** Stream partial transcripts; display current agenda guess with confidence badges.
- **Review screen:** After recording, show transcript aligned to agenda, allow edits, export (PDF/markdown/email), and regenerate alignment after edits.

## 6) Data & Storage
- **Local storage:** Use secure storage for tokens/keys; store audio and transcripts in app sandbox with encryption at rest when available.
- **Sync:** Plan backend API for meeting metadata and transcripts; include pagination, conflict resolution, and incremental updates.
- **Privacy/consent:** Provide consent prompts, data deletion, and redaction tools (e.g., for names or sensitive phrases).

## 7) Quality & Observability
- **Testing:** Unit test alignment logic with sample agendas/transcripts; add integration tests for recording/transcription flows using mocks.
- **Analytics:** Capture anonymized performance metrics (latency, alignment accuracy) and error reporting (crashes, API failures).
- **Benchmarking:** Track WER for Danish/English on representative audio; measure alignment precision/recall.

## 8) Delivery Roadmap (incremental)
1. Skeleton app setup, navigation, theme, and state management.
2. Audio permissions and basic recording with file persistence.
3. Upload/transcription pipeline (choose provider) with progress UI.
4. Agenda creation/import and storage.
5. MVP agenda alignment heuristic and review screen with manual corrections.
6. Live transcription + live agenda alignment (if feasible).
7. Backend sync, authentication, and export/sharing features.
8. Performance, offline robustness, privacy tooling, and polishing.

## 9) Operational Checklist
- Document API keys/config in `.env` templates; guard secrets.
- Add CI for lint/tests and fastlane/Gradle workflows for builds.
- Prepare store metadata (privacy labels, microphone usage description, data handling summary).

Use this plan as a living document and update it as features and constraints evolve.
