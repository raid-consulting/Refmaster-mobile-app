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

For quick tests, the app can call OpenAI Whisper directly without running your own API. Configure the following environment variables when starting Expo:

- `EXPO_PUBLIC_OPENAI_API_KEY`: required for direct Whisper calls. The key will be used client-side, so prefer a restricted token when testing.
- `EXPO_PUBLIC_TRANSCRIPTION_API` (optional): set this to point to your backend when you want to switch back to server-hosted transcriptions.
- `EXPO_PUBLIC_WHISPER_ON_DEVICE` (optional): set to `true` to run Whisper on-device via a lightweight model for offline-friendly experiments.

### Troubleshooting transcription progress

- If the progress bar stays around 10%, double-check that either `EXPO_PUBLIC_TRANSCRIPTION_API` is reachable or that you have configured direct Whisper usage with `EXPO_PUBLIC_OPENAI_API_KEY` (or enabled on-device transcription with `EXPO_PUBLIC_WHISPER_ON_DEVICE=true`).
- When using your own backend, ensure it supports WebSocket streaming on the same base URL supplied in `EXPO_PUBLIC_TRANSCRIPTION_API`.

### Troubleshooting `TypeError: fetch failed` when running `npm start`

Expo downloads metadata about native module versions when it boots. If your network blocks outbound requests or requires a proxy, this lookup can fail with a `TypeError: fetch failed` stack trace before Metro finishes starting. Common fixes:

1. Make sure you can reach `https://exp.host` and `https://registry.npmjs.org` from the machine running `npm start`. VPNs, firewalls, or corporate proxies sometimes block these domains.
2. If you need a proxy, set `HTTP_PROXY`, `HTTPS_PROXY`, and (optionally) `NO_PROXY` in your shell before running Expo so the CLI can fetch dependency info.
3. When you do not have network access, start Expo in offline mode to bypass the metadata fetch:
   ```bash
   EXPO_OFFLINE=1 npm start
   ```
   This keeps Metro running using your locally installed packages.
4. After adding environment variables like `EXPO_PUBLIC_WHISPER_ON_DEVICE=true`, restart `npm start` so the values are picked up by the bundler.

## Implementation Plan
See [docs/implementation-plan.md](docs/implementation-plan.md) for the step-by-step delivery roadmap covering audio capture, transcription, and agenda alignment.
