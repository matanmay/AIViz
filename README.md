# AIViz — Human-In-The-Loop AI Assistant

A research-grade AI chat interface designed for **Human-In-The-Loop (HITL) experiments**. Built with React and Supabase, this platform records all participant interactions for academic analysis while keeping the underlying AI model hidden from participants (blind study protocol).

---

## 📋 Overview

This application serves as the experimental interface for a study on human interaction with AI language models. It provides a clean, distraction-free chat environment where:

- Participants interact with an AI assistant through a standard chat interface
- All prompts, responses, and interaction events are logged to a Supabase database
- The AI model identity is hidden from participants (blind study)
- Access is restricted to pre-registered participants only (no self-registration)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key (Gemini)

### Installation

```bash
# Clone the repository
git clone https://github.com/matanmay/AIViz.git
cd AIViz

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Supabase
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> ⚠️ **Never commit `.env` to version control.** It is listed in `.gitignore`.

### Database Setup

Run the schema in your Supabase project:

1. Open **Supabase Dashboard → SQL Editor → New Query**
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**

This creates the `teams`, `chats`, `messages`, `experiment_logs`, and
`submitted_diagrams` tables, along with the `chat-attachments` Storage bucket
and supporting indexes and RLS policies.

### Run Locally

```bash
npm start
# Open http://localhost:3000
```

---

## 👥 Participant Management

Participants are represented by records in the `teams` table and are added
manually by the researcher — there is **no self-registration**. Each team has a
name, application-layer password, study story, and designated model.
---

## 📊 Data Collection

Each prompt/response interaction is stored as one row in `messages`. The
`experiment_logs` table stores additional telemetry events with a flexible
`event_type` and JSONB `event_data` payload. Events currently used by the
application include:

| Event | Description |
|-------|-------------|
| `prompt_sent` | Every prompt sent by the participant, including drafting duration (ms) |
| `response_received` | AI response, latency (ms), token count, and model ID |
| `content_copied` | When a participant copies a message or code block |
| `regenerate_requested` | When a participant retries/regenerates a response |
| `chat_switched` | Navigation between sessions |
| `tab_blur` / `tab_focus` | When the participant switches away from the browser tab |
| `user_logged_in` / `user_logged_out` | Session start and end |

Messages can also store 1–5 feedback ratings, comments, attachment metadata,
and PlantUML edit tracking. Final conceptual diagrams are stored in
`submitted_diagrams`, including the diagram type and PlantUML source.

### Exporting Data

From the Supabase SQL Editor:

```sql
-- Export all experiment logs
SELECT * FROM experiment_logs ORDER BY created_at ASC;

-- Export all messages with team and chat details
SELECT m.*, c.team_name, c.title AS chat_title
FROM messages m
JOIN chats c ON m.chat_id = c.id
ORDER BY m.created_at ASC;

-- Export submitted final diagrams
SELECT * FROM submitted_diagrams ORDER BY created_at ASC;
```

---

## 🔒 Blind Study Protocol

- The AI model name is **never displayed** in the UI
- The designated model is stored in `teams.model`; telemetry may also include
  model information in `experiment_logs.event_data`
- Participants see only **"AI Assistant"** as the sender name
- The Settings panel has been removed from the participant-facing UI

---

## 🗄️ Database Schema

```
teams              — Team credentials, study story, designated model, timestamps
chats              — Conversation sessions (id TEXT, team_name, title, timestamps)
messages           — Prompt/response interactions, feedback, attachments, timestamps
experiment_logs    — Telemetry (team_name, chat_id, event_type, event_data JSONB)
submitted_diagrams — Final diagrams (team_name, chat_id, type, PlantUML code)
```

All tables use **Row Level Security (RLS)**. The current policies allow all
operations (`USING (true)` / `WITH CHECK (true)`); authentication and team
access control are handled in the application layer. The `chat-attachments`
Storage bucket is public and has an equivalent public access policy.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (functional components + hooks) |
| Styling | Vanilla CSS (dark/light mode) |
| AI Provider | Google Gemini via OpenAI Compatibility API |
| Auth & Database | Supabase (PostgreSQL + Auth) |
| HTTP Client | Axios |
| Icons | Lucide React |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatWindow.jsx      # Main chat viewport
│   ├── LoginScreen.jsx     # Participant login gate
│   ├── Message.jsx         # Message bubble (user/assistant)
│   ├── MessageInput.jsx    # Input with drafting timer
│   └── Sidebar.jsx         # Session list and controls
├── services/
│   ├── api.js              # Gemini API integration
│   ├── supabase.js         # Auth + DB sync
│   └── telemetry.js        # Interaction event tracking
└── App.jsx                 # Root component + state management

supabase/
└── schema.sql              # Database schema + RLS policies
```

---

## 📝 Notes for Researchers

- Deleting a chat cascades to its messages; its telemetry remains unless
  explicitly deleted because `experiment_logs.chat_id` is not a foreign key
- Deleting a team cascades to its chats, messages, telemetry, and submitted
  diagrams
- The `event_data` JSONB field in `experiment_logs` contains event-specific
  context, including model information when recorded
- Uploaded chat attachments are stored in the public `chat-attachments` bucket

---

## License

For academic research use only.
