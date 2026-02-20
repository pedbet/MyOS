# MyOS — Life OS PWA (v2 Specification)

> Working title: **MyOS** (a personal “Life OS” without using that exact name)

## 1. Overview

**MyOS** is a minimalist, elegant, offline-first personal system with **Today as the center**.  
It unifies functionality typically spread across multiple paid apps (tasks, habits, prayers, journaling, periodic check-ins) into one cohesive, personalized workflow.

Designed for **daily use**, low friction, fast capture, and long-term continuity.

---

## 2. Core Principles

- **Today-first**: Everything meaningful surfaces on Today.
- **Offline-first**: Full functionality without network.
- **Eventual sync**: Cloud sync is helpful, not required.
- **Minimalist but powerful**: Fewer concepts, carefully designed.
- **Safe by default**: Undo, soft deletes, no accidental loss.
- **Personal, not social**: Exactly two allowed users.

---

## 3. Platform & Architecture (Locked)

### Frontend
- **PWA**, installable on iOS
- Hosted on **GitHub Pages**
- Public repo
- Works under subpath: `https://<user>.github.io/<repo>/`
- Offline storage via **IndexedDB**
- Service Worker caches app shell (not DB data)

### Backend
- **Supabase**
  - Postgres
  - Google OAuth
  - Row Level Security (RLS)
- No custom servers required

### Auth Model
- **Google Login**
- **Exactly two allowed Google accounts**
- Enforced via:
  1) Supabase Auth restrictions (preferred: Auth Hook)  
  2) RLS allowlisting (mandatory)

### Keys
- Supabase **URL + anon key**
  - Entered on first app launch
  - Stored locally (IndexedDB)
  - Not committed to repo
- Service role key is **never** used client-side

---

## 4. Navigation & Information Architecture

### Primary Sections
1. **Today** (home)
2. Check-ins
3. Tasks
4. Habits
5. Prayers
6. Journal
7. Search (global)
8. Settings

---

## 5. Today Screen (Canonical Order)

Default section order:
1. **Check-ins**
2. **Tasks**
3. **Habits**
4. **Prayers**
5. **Journal**

### Today Behavior
- Completed tasks hidden by default
- “Completed today” visible via toggle or secondary view
- Everything actionable from Today without extra navigation

---

## 6. Functional Domains

### 6.1 Check-ins

**Purpose:** Repeatable activities you want to do periodically without rigid deadlines.

**Examples:** “Call Grandma”, “Check in with mentor”, “Review finances”

#### Frequency Model (IMPORTANT)
Do **not** store frequency as “days”. Human cadence needs calendar-aware units (e.g., “1 month” is not always 30 days).

Store durations as **value + unit**:
- `value` = integer
- `unit` ∈ `{ day, week, month, year }`

This applies to `frequency`, `yellow_threshold`, `red_threshold`.

#### Fields
- `id`
- `title`
- `frequency_value` (int)
- `frequency_unit` (enum: day/week/month/year)
- `yellow_value` (int)
- `yellow_unit` (enum: day/week/month/year)
- `red_value` (int)
- `red_unit` (enum: day/week/month/year)
- `first_due_at` (timestamp; defaults to now)
- `last_checkin_at` (timestamp nullable)
- `labels[]`
- `created_at`
- `updated_at`
- `deleted_at` (soft delete)

#### Status Calculation (calendar-aware)
Define **anchor**:
- If `last_checkin_at` exists → anchor = `last_checkin_at`
- Else → anchor = `first_due_at`

Compute thresholds by adding durations to the anchor (calendar math):
- `yellow_at = anchor + frequency + yellow_threshold`
- `red_at = anchor + frequency + red_threshold`

Then:
- GREEN if `now < yellow_at`
- YELLOW if `yellow_at <= now < red_at`
- RED if `now >= red_at`

#### Behavior
- “Check-in” button sets `last_checkin_at = now`
- Item remains until deleted
- Default sort:
  1. RED
  2. YELLOW
  3. greatest time since anchor first
- Filter by labels and status

---

### 6.2 Tasks

**Purpose:** Standard tasks with optional due dates and aging awareness.

#### Fields
- `id`
- `title`
- `notes`
- `status` (`OPEN | DONE`)
- `created_at`
- `completed_at`
- `due_at` (nullable)
- `labels[]`
- `updated_at`
- `deleted_at` (soft delete)

#### Behavior
- Tasks may have **no due date**
- UI shows **days open** = floor((now - created_at)/day) for open tasks
- Completing sets `completed_at = now`
- Completed tasks hidden by default on Today

#### Default Sorting (OPEN tasks)
1. Overdue tasks first (`due_at < now`)
2. Then oldest created first (`created_at asc`)

---

### 6.3 Habits

**Purpose:** Daily behavior tracking with reflection.

#### Fields
- `id`
- `title`
- `description`
- `labels[]`
- `created_at`
- `updated_at`
- `archived_at`
- `deleted_at`

#### Habit Log
- `id`
- `habit_id`
- `date` (local date, YYYY-MM-DD)
- `status` (`SUCCESS | FAIL | NA`)
- `created_at`
- `updated_at`
- `deleted_at`

#### Rules
- Exactly **one status per habit per day**
- Users may edit habit logs **up to 7 days in the past**
- Enforce with UI + validation

---

### 6.4 Prayers

**Purpose:** Track prayer texts and frequency.

#### Fields
- `id`
- `title`
- `text`
- `labels[]`
- `created_at`
- `updated_at`
- `deleted_at`

#### Prayer Log
- `id`
- `prayer_id`
- `date` (local date, YYYY-MM-DD)
- `count` (int)
- `created_at`
- `updated_at`
- `deleted_at`

#### Rules
- Multiple logs per day allowed
- Recommended implementation: one row per (prayer_id, date) with `count` increment on log
- History view by prayer and by date

---

### 6.5 Journal

**Purpose:** Daily journaling / reflection.

#### Fields
- `id`
- `date` (local date, YYYY-MM-DD) UNIQUE
- `title`
- `body`
- `created_at`
- `updated_at`
- `deleted_at`

#### Rules
- **One journal entry per day**
- Today shows “Today’s Journal”
- Past entries editable

---

## 7. Global Capabilities

### Labels
- Shared across all domains
- Filter/search everywhere
- Manage in Settings (rename/merge/delete)

### Global Search
- Single search bar
- Searches titles, text, labels
- Results grouped by domain
- Keyboard-friendly / command palette friendly

---

## 8. Action History & Undo

### Requirements
- Support undo for destructive actions (at minimum delete/restore)
- Prefer non-destructive actions by default

### Implementation
- All deletes are **soft deletes** using `deleted_at`
- Maintain `action_log` locally:
  - entity type
  - entity id
  - action type
  - timestamp
  - before snapshot
  - after snapshot

Undo applies inverse operation using snapshots.

Optional: Trash screen (future).

---

## 9. Offline + Sync Model

### Offline
- Full CRUD works offline
- IndexedDB is source of truth
- App usable with zero network

### Sync
- Eventual consistency
- Last write wins using `updated_at`
- Soft deletes propagate using `deleted_at`

### Sync Triggers
- App launch
- Network reconnect
- Periodic debounced push
- Manual “Sync now”

### UX
- Show last sync time and sync errors
- Do not block usage on sync errors

---

## 10. Supabase Security & Schema Guidance

### Auth
- Google OAuth enabled
- Redirect URLs configured for GitHub Pages origin/subpath
- Exactly 2 users allowed

### Allowlist Enforcement (REQUIRED)
Preferred:
- Supabase **Before User Created Auth Hook** that rejects any email not in allowlist
Mandatory (even if hook exists):
- RLS allowlist checks on every table

### Allowlist Table
- `allowed_users`
  - `email` (text primary key)
  - optional `created_at`

RLS checks use `auth.email()` membership in `allowed_users`.

### RLS Requirements
- RLS enabled on all tables
- No public policies
- Policies allow SELECT/INSERT/UPDATE/DELETE only when allowlisted
- Never ship the service role key

### Tables (suggested)
- `checkins`
- `tasks`
- `habits`
- `habit_logs`
- `prayers`
- `prayer_logs`
- `journal_entries`
- `action_logs` (optional remote)
- `labels` (optional normalized; v1 may store labels as text arrays)

---

## 11. Deployment

- Static build deployed to GitHub Pages
- HTTPS required for PWA + OAuth
- Service worker caches shell assets
- Data stored in IndexedDB; sync mirrors to Supabase

---

## 12. Agent Instructions (Critical)

For agentic coding LLMs (Claude Code / Windsurf):

- **Do not change architecture**: PWA + GitHub Pages + IndexedDB + Supabase
- Implement the domains exactly as defined
- Use calendar-aware duration math for check-ins (value+unit)
- Implement soft delete + undo scaffolding early
- Keep UI minimalist and Today-centric
- Prefer explicit simple code and straightforward state management
- If ambiguous, choose simplest option and document in `OPEN_QUESTIONS.md`

---

## 13. Future Ideas (Out of Scope v1)

- Weekly/monthly review workflows
- Advanced recurrence rules for tasks/events
- Push notifications
- Analytics dashboards
- AI summaries or suggestions
- Additional users / collaboration
