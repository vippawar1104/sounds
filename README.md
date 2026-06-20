# Sounds

Sounds is an AI interview platform for creating custom voice interview agents and running
LiveKit interview sessions from a web dashboard.

The repository combines:

- a FastAPI backend for agent CRUD, session orchestration, LiveKit token generation, transcripts,
  and basic evaluation endpoints
- a Next.js dashboard for creating agents, browsing the library, and joining interview rooms
- a LiveKit voice agent built on the local `livekit-agents` workspace and provider plugins
- bundled LiveKit Agents and plugin source packages for local SDK development

## Features

- Create interview agents with a role, company, difficulty, interview type, topics, voice, and
  custom system instructions.
- Start LiveKit rooms from the dashboard and dispatch an interview worker automatically.
- Run real-time voice interviews with ElevenLabs speech, Anthropic Claude, Silero VAD, and LiveKit.
- Capture session metadata and transcript entries in SQLite.
- Use the local LiveKit Agents framework and plugin packages directly from the workspace.

## Repository Layout

```text
backend/                         FastAPI app and SQLite persistence
dashboard/                       Next.js dashboard
examples/voice_agents/           Runnable LiveKit voice agents
livekit-agents/                  Local LiveKit Agents framework package
livekit-plugins/                 Local provider plugin packages
pipecat-outbound/                Legacy/experimental Pipecat outbound bot
tests/                           LiveKit Agents test suite
```

The active interview worker is `examples/voice_agents/interview_agent.py`. The backend dispatches
that worker when a user starts a room from the dashboard.

## Requirements

- Python 3.12+
- Node.js 20+
- uv
- LiveKit Cloud project or a self-hosted LiveKit server
- API keys for the providers you use

Minimum provider keys for the current LiveKit interview flow:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
ELEVEN_API_KEY=your_elevenlabs_api_key
```

`ELEVENLABS_API_KEY` is also accepted by the interview agent. Optional values include
`ANTHROPIC_MODEL`, `CLAUDE_MODEL`, `ELEVEN_VOICE_ID`, and `INTERVIEW_DB_PATH`.

## Local Setup

Install Python dependencies from the repository root:

```bash
make install
```

Install dashboard dependencies:

```bash
cd dashboard
npm install
```

Create a root `.env` file with the LiveKit and provider variables listed above.

## Run Locally

Start the backend from the repository root:

```bash
uv run uvicorn backend.main:app --reload --port 8000
```

Start the dashboard in another terminal:

```bash
cd dashboard
npm run dev
```

Open `http://localhost:3000`, create or select an interview agent, and start an interview. The API
runs on `http://localhost:8000`.

The backend stores data in `backend/interview.db` by default. Set `INTERVIEW_DB_PATH` to use a
different SQLite database path.

## Docker

Run the backend and dashboard together:

```bash
docker compose up --build
```

Docker uses:

- backend: `http://localhost:8000`
- dashboard: `http://localhost:3000`
- SQLite volume: `backend-data`

Set the same environment variables in your shell or a Docker Compose `.env` file before starting.

## Railway Deployment

Deploy the app as two Railway services:

1. Backend service
   - Root directory: repo root
   - Dockerfile: `Dockerfile.backend`
   - Required env vars: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ANTHROPIC_API_KEY`,
     `ELEVEN_API_KEY` or `ELEVENLABS_API_KEY`
2. Frontend service
   - Root directory: `dashboard/`
   - Dockerfile: `Dockerfile`
   - Required env vars: `BACKEND_URL=<public backend URL>`

Then set the backend CORS env var to allow the frontend origin:

```bash
ALLOWED_ORIGINS=<public frontend URL>
```

The frontend proxies requests through `/api/backend`. The Next.js rewrite reads `BACKEND_URL` during
the Docker build, so redeploy the frontend after changing the backend URL.

## API Overview

Common backend endpoints:

- `GET /health`
- `GET /agents`
- `POST /agents`
- `PATCH /agents/{agent_id}`
- `DELETE /agents/{agent_id}`
- `POST /agents/{agent_id}/join-room`
- `GET /sessions`
- `GET /sessions/{session_id}/transcript`
- `POST /sessions/{session_id}/transcript`
- `GET /stats`

Interactive API docs are available at `http://localhost:8000/docs` while the backend is running.

## Development Commands

```bash
make format          # Format Python code with ruff
make lint            # Run ruff checks
make type-check      # Run mypy checks
make check           # Run format-check, lint, and type-check
uv run pytest        # Run tests
```

Dashboard commands:

```bash
cd dashboard
npm run lint
npm run build
```

## Notes

- `pipecat-outbound/` is kept in the repository, but the current dashboard flow uses the LiveKit
  worker in `examples/voice_agents/interview_agent.py`.
- If LiveKit dependencies or `LIVEKIT_URL` are unavailable, the backend can return mock room data
  for UI testing, but real calls require valid LiveKit credentials.
- Agent worker logs are written under `logs/` when the backend dispatches an interview worker.

## License

This repository includes LiveKit Agents source and examples. See `LICENSE` and `NOTICE` for the
included licensing information.
