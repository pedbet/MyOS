-- ============================================================
-- MyOS — Supabase Database Schema
-- Run this in the Supabase SQL editor to set up your database.
-- ============================================================

-- 1. ALLOWED USERS (allowlist enforcement)
CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADD YOUR EMAILS HERE:
-- INSERT INTO allowed_users (email) VALUES ('user1@gmail.com'), ('user2@gmail.com');

-- 2. LABELS
CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 3. CHECK-INS
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  frequency_value INTEGER NOT NULL DEFAULT 1,
  frequency_unit TEXT NOT NULL DEFAULT 'week',
  yellow_value INTEGER NOT NULL DEFAULT 1,
  yellow_unit TEXT NOT NULL DEFAULT 'day',
  red_value INTEGER NOT NULL DEFAULT 3,
  red_unit TEXT NOT NULL DEFAULT 'day',
  first_due_at TIMESTAMPTZ,
  last_checkin_at TIMESTAMPTZ,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 4. TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  due_at TIMESTAMPTZ,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 5. HABITS
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 6. HABIT LOGS
CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT REFERENCES habits(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 7. PRAYERS
CREATE TABLE IF NOT EXISTS prayers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 8. PRAYER LOGS
CREATE TABLE IF NOT EXISTS prayer_logs (
  id TEXT PRIMARY KEY,
  prayer_id TEXT REFERENCES prayers(id),
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 9. JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is in allowlist
CREATE OR REPLACE FUNCTION is_allowed_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_users WHERE email = auth.email()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies for each table
-- Labels
CREATE POLICY "allowed_users_labels" ON labels
  FOR ALL USING (is_allowed_user());

-- Check-ins
CREATE POLICY "allowed_users_checkins" ON checkins
  FOR ALL USING (is_allowed_user());

-- Tasks
CREATE POLICY "allowed_users_tasks" ON tasks
  FOR ALL USING (is_allowed_user());

-- Habits
CREATE POLICY "allowed_users_habits" ON habits
  FOR ALL USING (is_allowed_user());

-- Habit logs
CREATE POLICY "allowed_users_habit_logs" ON habit_logs
  FOR ALL USING (is_allowed_user());

-- Prayers
CREATE POLICY "allowed_users_prayers" ON prayers
  FOR ALL USING (is_allowed_user());

-- Prayer logs
CREATE POLICY "allowed_users_prayer_logs" ON prayer_logs
  FOR ALL USING (is_allowed_user());

-- Journal entries
CREATE POLICY "allowed_users_journal" ON journal_entries
  FOR ALL USING (is_allowed_user());

-- ============================================================
-- AUTH HOOK (optional but recommended)
-- Create a Before User Created hook in Supabase Auth settings
-- pointing to this function:
-- ============================================================
-- CREATE OR REPLACE FUNCTION auth.before_user_created(event jsonb)
-- RETURNS jsonb AS $$
-- DECLARE
--   email_addr text := event -> 'claims' ->> 'email';
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM public.allowed_users WHERE email = email_addr) THEN
--     RAISE EXCEPTION 'Email not authorized: %', email_addr;
--   END IF;
--   RETURN event;
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================
-- INSERT YOUR ALLOWED USERS (REQUIRED):
-- ============================================================
-- INSERT INTO allowed_users (email) VALUES
--   ('your.email@gmail.com'),
--   ('other.email@gmail.com');
