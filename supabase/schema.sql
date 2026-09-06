-- ============================================================================
-- Supabase Schema for Human-In-The-Loop Conceptual Modeling Experiment
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to re-run: uses IF NOT EXISTS, IF EXISTS guards and ON CONFLICT handling
-- ============================================================================

-- 0. Teams table (stores group/user credentials and designated LLM model)
CREATE TABLE IF NOT EXISTS teams (
    team_name TEXT PRIMARY KEY,
    password  TEXT NOT NULL,
    model     TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration: Add model column to teams if it does not exist
ALTER TABLE teams ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite';

-- Clean up any redundant users table if previously created
DROP TABLE IF EXISTS users CASCADE;

-- 1. Create chats / conversation sessions table
--    NOTE: id is TEXT to support JS-generated chat-<timestamp> IDs
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    team_name TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create messages / interaction logs table
--    One row per interaction: stores the user prompt and assistant response together.
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    team_name TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    prompt_at TIMESTAMP WITH TIME ZONE NOT NULL,
    response TEXT,
    response_at TIMESTAMP WITH TIME ZONE,
    tokens INTEGER,
    status TEXT DEFAULT 'completed',
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create comprehensive experiment telemetry logs table
CREATE TABLE IF NOT EXISTS experiment_logs (
    id TEXT PRIMARY KEY,
    team_name TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    chat_id TEXT,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create indexes for fast retrieval and researcher export
CREATE INDEX IF NOT EXISTS idx_teams_team_name ON teams(team_name);
CREATE INDEX IF NOT EXISTS idx_chats_team_name ON chats(team_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_team_name ON messages(team_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_team ON experiment_logs(team_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_event ON experiment_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_chat ON experiment_logs(chat_id, created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_logs ENABLE ROW LEVEL SECURITY;

-- 6. Open RLS policies (authentication is handled in application layer)
DROP POLICY IF EXISTS "Allow all on teams" ON teams;
CREATE POLICY "Allow all on teams"
    ON teams FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on chats" ON chats;
CREATE POLICY "Allow all on chats"
    ON chats FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all on messages"
    ON messages FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on experiment_logs" ON experiment_logs;
CREATE POLICY "Allow all on experiment_logs"
    ON experiment_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- 7. Migration: add feedback columns to existing messages table (safe to re-run)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_comment TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE;

-- 8. Migration: add attachment columns to messages table (safe to re-run)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_data TEXT;

-- 9. Storage Bucket for uploaded diagrams / chat attachments (safe to re-run)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public all on chat-attachments" ON storage.objects;
CREATE POLICY "Allow public all on chat-attachments"
    ON storage.objects FOR ALL
    TO public
    USING (bucket_id = 'chat-attachments')
    WITH CHECK (bucket_id = 'chat-attachments');

-- 10. Table for student submitted final conceptual diagrams
CREATE TABLE IF NOT EXISTS submitted_diagrams (
    id TEXT PRIMARY KEY,
    team_name TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,
    session_title TEXT,
    diagram_type TEXT NOT NULL,
    plantuml_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submitted_diagrams_team ON submitted_diagrams(team_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submitted_diagrams_type ON submitted_diagrams(diagram_type);

ALTER TABLE submitted_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on submitted_diagrams" ON submitted_diagrams;
CREATE POLICY "Allow all on submitted_diagrams"
    ON submitted_diagrams FOR ALL
    USING (true)
    WITH CHECK (true);
