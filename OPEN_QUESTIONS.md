# OPEN_QUESTIONS.md

Decisions made where spec was ambiguous, per agent instructions.

## Decided

| Question | Decision |
|---|---|
| Supabase key storage | IndexedDB `config` store. Never in localStorage or repo. |
| Label storage | Inline text arrays on each record (v1). Normalized `labels` table syncs names only. |
| Journal unique constraint | Enforced client-side. Supabase `UNIQUE` on `date` column. |
| Check-in "anchor" when no last_checkin_at | Uses `first_due_at`, falls back to `created_at`. |
| Yellow/red thresholds meaning | Added to `due_at` (= anchor + frequency), not to anchor directly, per spec: `yellow_at = anchor + frequency + yellow_threshold`. |
| Habit log "toggle off" | Clicking same status again soft-deletes the log (sets `deleted_at`). |
| Prayer log implementation | One row per (prayer_id, date), `count` incremented on each tap. |
| Auth hook | Schema SQL includes the hook template as a comment. Manual wiring in Supabase required. |
| PWA icons | Simple "M" serif monogram on dark background. |
| No build step | Vanilla JS, no bundler required. All modules are plain `<script>` tags. |

## Known Limitations / Future Work

- **No push notifications** (out of scope v1)
- **No trash UI** — soft deletes work, undo available for 5 seconds, no dedicated restore screen
- **No advanced recurrence** for tasks
- **Action log** stored locally only, not synced to Supabase (privacy; optional per spec)
- **Two-user enforcement**: RLS + allowlist table enforces this. Auth hook template provided but must be manually connected in Supabase dashboard.
