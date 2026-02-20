# MyOS

A minimalist, elegant, offline-first personal system with **Today as the center**.

## Overview

MyOS unifies functionality typically spread across multiple paid apps (tasks, habits, prayers, journaling, periodic check-ins) into one cohesive, personalized workflow.

## Features

- **Today-first**: Everything meaningful surfaces on Today
- **Offline-first**: Full functionality without network
- **Eventual sync**: Cloud sync is helpful, not required
- **Minimalist but powerful**: Fewer concepts, carefully designed
- **Safe by default**: Undo, soft deletes, no accidental loss
- **Personal, not social**: Exactly two allowed users

## Core Domains

1. **Check-ins** - Repeatable activities with calendar-aware frequency
2. **Tasks** - Standard tasks with optional due dates and aging
3. **Habits** - Daily behavior tracking with reflection
4. **Prayers** - Track prayer texts and frequency
5. **Journal** - Daily journaling and reflection

## Technology Stack

- **Frontend**: PWA, installable on iOS
- **Hosting**: GitHub Pages
- **Storage**: IndexedDB (offline) + Supabase (sync)
- **Auth**: Google OAuth (exactly 2 users allowed)

## Development

This is a progressive web app built with vanilla JavaScript. No build process required.

### Local Development

1. Clone the repository
2. Serve the files with a local web server (e.g., `python -m http.server`)
3. Open `http://localhost:8000` in your browser

### Deployment

The app is designed to be deployed to GitHub Pages. The service worker handles caching and offline functionality.

## Architecture

- **Offline-first**: IndexedDB is the source of truth
- **Eventual sync**: Supabase provides cloud backup and sync
- **Calendar-aware**: Duration calculations use proper calendar math
- **Action logging**: All changes are logged for undo functionality

## License

Personal use only.
