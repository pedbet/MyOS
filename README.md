# MyOS — Personal Life OS

A minimalist, offline-first personal operating system. Unifies check-ins, tasks, habits, prayers, and journaling in one elegant PWA.

## Features

- **Today** — Central dashboard surfacing everything that needs attention
- **Check-ins** — Periodic activities with traffic-light status (green/yellow/red)  
- **Tasks** — Tasks with optional due dates and aging awareness
- **Habits** — Daily habit tracking with 7-day history editing
- **Prayers** — Track prayer texts and daily count
- **Journal** — One entry per day, auto-saved
- **Global Search** — Search across all domains
- **Offline-first** — Full CRUD works offline via IndexedDB
- **Sync** — Eventual consistency sync to Supabase

---

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. **Add your allowed email addresses** at the bottom of the schema:
   ```sql
   INSERT INTO allowed_users (email) VALUES
     ('your.email@gmail.com'),
     ('partner.email@gmail.com');
   ```
4. Enable **Google OAuth** in Authentication → Providers
5. Add your GitHub Pages URL to **Authentication → URL Configuration → Redirect URLs**:
   ```
   https://<username>.github.io/<repo>/
   ```

### 2. Deploy to GitHub Pages

1. Create a public GitHub repository
2. Copy all files to the repo root (or use a subfolder with the `start_url` adjusted in `manifest.json`)
3. Enable **GitHub Pages** in Settings → Pages → Source: `main` branch, root
4. Visit `https://<username>.github.io/<repo>/`

### 3. First Launch

On first launch, you'll be prompted to enter:
- **Supabase URL** — found in Project Settings → API
- **Supabase Anon Key** — found in Project Settings → API (the `anon public` key)

These are stored locally in IndexedDB only. They are never committed to the repo.

### 4. Install as PWA

On iOS Safari: **Share → Add to Home Screen**  
On Android Chrome: **Menu → Add to Home Screen**

---

## Architecture

```
Frontend:  PWA (vanilla JS, no build step required)
Storage:   IndexedDB (offline-first, source of truth)  
Sync:      Supabase Postgres (eventual consistency)
Auth:      Google OAuth via Supabase
Hosting:   GitHub Pages (static)
```

## File Structure

```
myos/
├── index.html              # App shell
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── supabase-schema.sql     # Database schema + RLS
├── css/
│   └── main.css            # All styles
├── js/
│   ├── app.js              # App controller / router
│   ├── db.js               # IndexedDB wrapper
│   ├── sync.js             # Supabase sync
│   ├── utils.js            # Shared utilities + UI helpers
│   ├── auth.js             # Auth module
│   ├── search.js           # Global search
│   └── sections/
│       ├── today.js        # Today dashboard
│       ├── checkins.js     # Check-ins
│       ├── tasks.js        # Tasks
│       ├── habits.js       # Habits
│       ├── prayers.js      # Prayers
│       ├── journal.js      # Journal
│       └── settings.js     # Settings
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Open Questions / Future

See spec section 13. Notable items deferred:
- Push notifications
- Weekly review screen
- Trash / restore UI
- Advanced task recurrence
