-- ============================================================================
-- Supabase Schema for Human-In-The-Loop Conceptual Modeling Experiment
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to re-run: uses IF NOT EXISTS and IF EXISTS guards
-- ============================================================================

-- 1. Create chats / conversation sessions table
--    NOTE: id is TEXT to support both UUID and JS-generated chat-<timestamp> IDs
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create messages / interaction logs table
--    NOTE: id is TEXT to support msg-<timestamp> IDs generated in JS
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'error')),
    content TEXT NOT NULL,
    tokens INTEGER,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create comprehensive experiment telemetry logs table
CREATE TABLE IF NOT EXISTS experiment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    chat_id TEXT,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create indexes for fast retrieval and researcher export
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_user ON experiment_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_event ON experiment_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_chat ON experiment_logs(chat_id, created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_logs ENABLE ROW LEVEL SECURITY;

-- 6. Row Level Security Policies
DROP POLICY IF EXISTS "Users can manage their chats" ON chats;
CREATE POLICY "Users can manage their chats"
    ON chats FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their messages" ON messages;
CREATE POLICY "Users can manage their messages"
    ON messages FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert experiment logs" ON experiment_logs;
CREATE POLICY "Users can insert experiment logs"
    ON experiment_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can select their experiment logs" ON experiment_logs;
CREATE POLICY "Users can select their experiment logs"
    ON experiment_logs FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);
