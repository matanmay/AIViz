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

This creates three tables: `chats`, `messages`, and `experiment_logs`.

### Run Locally

```bash
npm start
# Open http://localhost:3000
```

---

## 👥 Participant Management

Participants are added manually by the researcher — there is **no self-registration**.
---

## 📊 Data Collection

The following interaction events are automatically logged to `experiment_logs` in Supabase:

| Event | Description |
|-------|-------------|
| `prompt_sent` | Every message sent by the participant, including drafting duration (ms) |
| `response_received` | AI response, latency (ms), token count, and hidden model ID |
| `content_copied` | When a participant copies a message or code block |
| `regenerate_requested` | When a participant retries/regenerates a response |
| `chat_switched` | Navigation between sessions |
| `tab_blur` / `tab_focus` | When the participant switches away from the browser tab |
| `user_logged_in` / `user_logged_out` | Session start and end |

### Exporting Data

From the Supabase SQL Editor:

```sql
-- Export all experiment logs
SELECT * FROM experiment_logs ORDER BY created_at ASC;

-- Export all messages with participant email
SELECT m.*, c.user_id, e.user_email
FROM messages m
JOIN chats c ON m.chat_id = c.id
JOIN experiment_logs e ON e.user_id = c.user_id
ORDER BY m.created_at ASC;
```

---

## 🔒 Blind Study Protocol

- The AI model name is **never displayed** in the UI
- Model information is stored exclusively in `experiment_logs.event_data` under a researcher-only field
- Participants see only **"AI Assistant"** as the sender name
- The Settings panel has been removed from the participant-facing UI

---

## 🗄️ Database Schema

```
chats              — Conversation sessions (id TEXT, user_id, title, timestamps)
messages           — Individual messages (id TEXT, chat_id, role, content, tokens)
experiment_logs    — Full telemetry (user_id, event_type, event_data JSONB, timestamps)
```

All tables use **Row Level Security (RLS)** — participants can only access their own data.

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

- Chat deletion by participants **does not delete data from the database** — all records are permanently retained for analysis
- If a participant clears their history, the data remains in Supabase under their `user_id`
- The `event_data` JSONB field in `experiment_logs` contains the full context for each event including the hidden model identifier

---

## License

For academic research use only.
