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

## Implementation Plan
See [docs/implementation-plan.md](docs/implementation-plan.md) for the step-by-step delivery roadmap covering audio capture, transcription, and agenda alignment.
