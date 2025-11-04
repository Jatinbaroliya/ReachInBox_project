# Onebox – Unified, Searchable, AI‑Assisted Email Inbox

Onebox pulls messages from IMAP inboxes, lets you search them instantly, auto‑classifies with AI, and suggests context‑aware replies — all wrapped in a fresh, minimal, dark UI.

## What you get
- **Unified inbox**: read emails from multiple accounts in one place
- **Fast search**: subject, body, and sender queries backed by Elasticsearch (optional)
- **Auto labels**: AI tags like Interested, Meeting Booked, Not Interested, Spam, OOO
- **Smart replies**: generate suggested responses for any email
- **Signals out**: optional Slack + webhook notifications for high‑intent leads
- **Live updates**: new mail appears in real time via Socket.io
- **No‑deps demo**: run locally without any external services in dummy mode

## Tech overview
- **Backend**: Node.js, Express, TypeScript, Mongoose
- **AI**: OpenAI (optional; mocked in dummy mode)
- **Search**: Elasticsearch (optional)
- **Realtime**: Socket.io
- **Frontend**: React + Vite + TypeScript

## Layout & UX
- Left rail navigation with a compact brand area
- Top bar with context title
- Three‑pane workspace: list on the left, details on the right
- New dark theme, chip‑based category filter, card‑style email rows

## Project structure
```
backend/
  src/
    controllers/
    middleware/
    models/
    routes/
    services/
    mock/dummyData.ts
    config/runtime.ts
    server.ts
frontend/
  src/
  vite.config.ts
```

## Prerequisites
- Node.js 18+
- npm 9+

Elasticsearch, MongoDB and OpenAI are optional during local development thanks to dummy mode.

## Quick start (dummy mode: zero config)
Dummy mode enables automatically when `MONGODB_URI` is not set.

1) Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

2) Start the API (dummy mode)
```bash
cd backend
npm run dev
```
You should see logs similar to:
```
Running in DUMMY MODE: using mock accounts, skipping MongoDB/Elasticsearch/IMAP
```

3) Start the web app
```bash
cd ../frontend
npm run dev
```
Visit `http://localhost:5173`.

### Helpful endpoints (dummy mode)
- Health: `GET http://localhost:5000/api/health`
- Emails: `GET http://localhost:5000/api/emails?limit=100&category=Interested`
- Search: `GET http://localhost:5000/api/emails/search?q=budget`
- Email by id: `GET http://localhost:5000/api/emails/1`
- Suggested reply: `GET http://localhost:5000/api/emails/1/suggested-reply`
- Accounts: `GET http://localhost:5000/api/accounts`

## Full setup (real services)
Create `backend/.env`:
```
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/onebox

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# IMAP accounts (comma-separated; values align by index)
IMAP_ACCOUNTS=demo@acme.com,sales@acme.com
IMAP_PASSWORDS=pass1,pass2
IMAP_HOSTS=imap.gmail.com,imap.gmail.com
IMAP_PORTS=993,993

# Integrations (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EXTERNAL_WEBHOOK_URL=https://your-app.com/webhooks/email
```

Then run the backend (and optionally start MongoDB/Elasticsearch — Docker examples below):
```bash
# docker run -p 9200:9200 -e discovery.type=single-node docker.elastic.co/elasticsearch/elasticsearch:8.15.0
# docker run -p 27017:27017 mongo:6

cd backend
npm run dev
```

## How dummy mode behaves
- `backend/src/config/runtime.ts` toggles `isDummyMode` when `MONGODB_URI` is missing
- Controllers serve `mock/dummyData.ts` with in‑memory filtering/search
- AI and RAG services short‑circuit to deterministic outputs without an API key
- Elasticsearch service no‑ops in dummy mode

## Scripts
Backend (`backend/package.json`)
- `npm run dev` – start backend in watch mode
- `npm run build` – TypeScript build
- `npm start` – run compiled server

Frontend (`frontend/package.json`)
- `npm run dev` – Vite dev server
- `npm run build` – production build
- `npm run preview` – preview built app

## Deploying to Vercel (frontend only)
- This repo includes a `vercel.json` that tells Vercel to build the app from `frontend/` using a static build.
- Set an environment variable in Vercel: `VITE_API_BASE` pointing to your running backend (e.g., `https://your-backend.example.com/api`).
- Optional: set `VITE_SOCKET_URL` if you run a Socket.io server. If not set, the app will work without realtime and won’t error.
- Then click Deploy. Vercel will run `npm install && npm run build` in `frontend/` and serve `dist/`.

## Troubleshooting
- Can’t connect to DB/ES/IMAP? Run in dummy mode or provide valid credentials.
- No OpenAI key? The app still runs; AI paths return mocked outputs.

## License
MIT