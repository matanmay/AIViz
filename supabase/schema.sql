-- ============================================================================
-- Supabase Schema for Human-In-The-Loop Conceptual Modeling Experiment
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to re-run: uses IF NOT EXISTS, IF EXISTS guards and ON CONFLICT handling
-- ============================================================================

-- 0. Teams table (stores group/user credentials and designated LLM model)
CREATE TABLE IF NOT EXISTS teams (
    team_name TEXT PRIMARY KEY,
    password  TEXT NOT NULL,
    story TEXT,
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
    feedback_comment TEXT,
    feedback_at TIMESTAMP WITH TIME ZONE,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_data TEXT,
    is_plantuml_edited BOOLEAN DEFAULT false,
    original_plantuml_code TEXT,
    edited_plantuml_code TEXT,
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

-- 11. Migration: add PlantUML code edit tracking columns to messages table (safe to re-run)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_plantuml_edited BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS original_plantuml_code TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_plantuml_code TEXT;

-- 12. Table for storing the full prompt sent to the LLM on every interaction
--     full_prompt is a JSONB array of { role, content } objects:
--     [ { role: 'system', content: '...' }, { role: 'user', content: '...' }, ... ]
CREATE TABLE IF NOT EXISTS llm_requests (
    id          TEXT PRIMARY KEY,
    chat_id     TEXT REFERENCES chats(id) ON DELETE CASCADE,
    team_name   TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    message_id  TEXT,                          -- links to messages.id (user turn)
    model       TEXT NOT NULL,
    full_prompt JSONB NOT NULL DEFAULT '[]'::jsonb,
    response    TEXT,                          -- raw LLM response text
    response_at TIMESTAMP WITH TIME ZONE,      -- timestamp when response was received
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_requests_chat    ON llm_requests(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_team    ON llm_requests(team_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_message ON llm_requests(message_id);

ALTER TABLE llm_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on llm_requests" ON llm_requests;
CREATE POLICY "Allow all on llm_requests"
    ON llm_requests FOR ALL
    USING (true)
    WITH CHECK (true);

-- Migration: add response columns to llm_requests if table already exists (safe to re-run)
ALTER TABLE llm_requests ADD COLUMN IF NOT EXISTS response    TEXT;
ALTER TABLE llm_requests ADD COLUMN IF NOT EXISTS response_at TIMESTAMP WITH TIME ZONE;

-- 13. Table for tracking prompt template usage, parameters, prompt and LLM response
CREATE TABLE IF NOT EXISTS template_usages (
    id             TEXT PRIMARY KEY,
    team_name      TEXT REFERENCES teams(team_name) ON DELETE CASCADE,
    chat_id        TEXT REFERENCES chats(id) ON DELETE CASCADE,
    message_id     TEXT,                                  -- links to messages.id / interaction row
    template_id    TEXT NOT NULL,                         -- e.g. 'create-model', 'update-model'
    template_name  TEXT NOT NULL,                         -- e.g. 'Create Model'
    parameters     JSONB NOT NULL DEFAULT '{}'::jsonb,    -- filled placeholder values (<model>, <desc>, etc.)
    prompt         TEXT NOT NULL,                         -- final prompt string sent to the LLM
    response       TEXT,                                  -- LLM response text
    response_at    TIMESTAMP WITH TIME ZONE,              -- timestamp when response was received
    latency_ms     INTEGER,                               -- response latency in milliseconds
    model          TEXT,                                  -- LLM model used for the response
    execution_type TEXT DEFAULT 'execute',                -- 'execute' (direct run) or 'insert' (inserted to input then sent)
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_usages_team     ON template_usages(team_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usages_chat     ON template_usages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usages_template ON template_usages(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usages_message  ON template_usages(message_id);

ALTER TABLE template_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on template_usages" ON template_usages;
CREATE POLICY "Allow all on template_usages"
    ON template_usages FOR ALL
    USING (true)
    WITH CHECK (true);

-- 14. Migration: add template tracking columns to existing messages table (safe to re-run)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_params JSONB;

-- 15. DB-Level Constraint: Enforce maximum 3 image attachments per team/user
CREATE OR REPLACE FUNCTION check_team_image_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_image_count INTEGER;
BEGIN
    -- Only check if this row contains an attachment
    IF (NEW.attachment_url IS NOT NULL OR NEW.attachment_name IS NOT NULL OR NEW.attachment_data IS NOT NULL) THEN
        -- Count existing messages with attachments for this team (excluding the current row if updating)
        SELECT COUNT(*)
        INTO current_image_count
        FROM messages
        WHERE team_name = NEW.team_name
          AND (attachment_url IS NOT NULL OR attachment_name IS NOT NULL OR attachment_data IS NOT NULL)
          AND id <> NEW.id;

        IF current_image_count >= 3 THEN
            RAISE EXCEPTION 'Image upload limit reached: Team/User "%" already has % image attachments (maximum 3 allowed).',
                NEW.team_name, current_image_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_team_image_limit ON messages;
CREATE TRIGGER trg_check_team_image_limit
    BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION check_team_image_limit();

-- Helper function to fetch exact user/team image count
CREATE OR REPLACE FUNCTION get_user_image_count(p_team_name TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM messages
        WHERE team_name = p_team_name
          AND (attachment_url IS NOT NULL OR attachment_name IS NOT NULL OR attachment_data IS NOT NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


