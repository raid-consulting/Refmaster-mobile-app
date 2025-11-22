# Refmaster-mobile-app
Mobile app to record and transcribe meetings.

## Contributing notes
- Pull request tooling in this repo rejects binary attachments (e.g., audio or video recordings). Check the `.gitignore` before
committing and avoid adding raw media files to version control. Share sample recordings through links or external storage instead of checking them into the repo.

## Getting started
This repository now includes an Expo/React Native skeleton focused on early cross-platform UI prototyping. No binary assets are checked in to keep PRs text-only.

1. Install dependencies (Node 18+ recommended):
   ```bash
   npm install
   ```
2. Launch the development server:
   ```bash
   npm run start
   ```
3. Switch between the Home, Recorder, and Review mock screens using the tab buttons at the bottom of the app.

### Transcription without a backend

For quick tests, the app calls OpenAI Whisper directly when an API key is available—no backend or additional configuration needed. Set the following variable before starting Expo:

- `EXPO_PUBLIC_OPENAI_API_KEY`: required for direct Whisper calls. The key will be used client-side, so prefer a restricted token when testing.

If you still want to use a self-hosted transcription service, set `EXPO_PUBLIC_TRANSCRIPTION_API` and optionally `EXPO_PUBLIC_FORCE_BACKEND=true` to disable the direct Whisper fallback.

## Implementation Plan
See [docs/implementation-plan.md](docs/implementation-plan.md) for the step-by-step delivery roadmap covering audio capture, transcription, and agenda alignment.
