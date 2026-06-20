"""
Interview Platform Backend API
Runs on port 8000. Provides agent CRUD, session management, LiveKit room creation,
and stats for the dashboard.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("interview-backend")

# ---------------------------------------------------------------------------
# Lazy imports for optional heavy deps
# ---------------------------------------------------------------------------
try:
    from livekit import api as livekit_api  # type: ignore[import-untyped]

    _livekit_available = True
except ImportError:
    _livekit_available = False
    logger.warning("livekit.api not available – room creation will be mocked")

# ---------------------------------------------------------------------------
# Database (SQLite via aiosqlite + a tiny sync wrapper for simplicity)
# ---------------------------------------------------------------------------
import sqlite3

DB_PATH = Path(os.getenv("INTERVIEW_DB_PATH", Path(__file__).with_name("interview.db")))

DDL = """
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    job_title TEXT,
    company_name TEXT,
    interview_type TEXT NOT NULL DEFAULT 'technical',
    difficulty TEXT NOT NULL DEFAULT 'mid',
    topics TEXT NOT NULL DEFAULT '[]',
    max_questions INTEGER NOT NULL DEFAULT 10,
    system_instruction TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    tts_model TEXT NOT NULL DEFAULT 'elevenlabs',
    voice_id TEXT NOT NULL DEFAULT '',
    stt_model TEXT NOT NULL DEFAULT 'elevenlabs',
    llm_model TEXT NOT NULL DEFAULT 'claude-haiku',
    llm_temperature REAL NOT NULL DEFAULT 0.3,
    vad_sensitivity REAL NOT NULL DEFAULT 0.5,
    tone TEXT NOT NULL DEFAULT 'balanced',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_name TEXT NOT NULL UNIQUE,
    agent_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'connecting',
    duration_seconds INTEGER,
    candidate_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS transcript_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'live',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.executescript(DDL)
    logger.info("Database initialised at %s", DB_PATH)


# ---------------------------------------------------------------------------
# LiveKit helpers
# ---------------------------------------------------------------------------
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")


async def create_room_and_token(room_name: str, agent_metadata: dict[str, Any]) -> tuple[str, str]:
    """Create a LiveKit room and return (room_name, user_token)."""
    if not _livekit_available or not LIVEKIT_URL:
        # Fallback: return a dummy token so the dashboard can still test
        logger.warning("LiveKit unavailable – returning mock token")
        return room_name, "mock_token"

    lk = livekit_api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )

    try:
        # Create the room with agent metadata encoded in room metadata
        await lk.room.create_room(
            livekit_api.CreateRoomRequest(
                name=room_name,
                metadata=json.dumps(agent_metadata),
            )
        )

        # Issue a participant token for the human candidate
        token = (
            livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity("user")
            .with_name("Candidate")
            .with_grants(
                livekit_api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
            .to_jwt()
        )
        return room_name, token
    finally:
        await lk.aclose()


def dispatch_agent_worker(room_name: str, agent: dict[str, Any]) -> None:
    """
    Spawn the interview agent worker as a background subprocess.
    The agent picks up configuration from environment variables.
    """
    agent_script = REPO_ROOT / "examples" / "voice_agents" / "interview_agent.py"

    env = os.environ.copy()
    env.update(
        {
            "AGENT_JOB_TITLE": agent.get("job_title") or "Software Engineer",
            "AGENT_COMPANY_NAME": agent.get("company_name") or "the company",
            "AGENT_INTERVIEW_TYPE": agent.get("interview_type") or "technical",
            "AGENT_DIFFICULTY": agent.get("difficulty") or "mid",
            "AGENT_MAX_QUESTIONS": str(agent.get("max_questions") or 10),
            "AGENT_VOICE_ID": agent.get("voice_id") or "",
            "AGENT_SYSTEM_PROMPT": agent.get("system_instruction") or "",
        }
    )

    try:
        # Use Python from virtual environment
        python_path = REPO_ROOT / ".venv" / "bin" / "python"
        if not python_path.exists():
            python_path = sys.executable
        else:
            python_path = str(python_path)
        
        # Log to file for debugging
        log_dir = os.path.join(REPO_ROOT, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"agent_{room_name}.log")
        
        with open(log_file, "w") as f:
            process = subprocess.Popen(
                [
                    python_path,
                    str(agent_script),
                    "connect",
                    "--room",
                    room_name,
                    "--participant-identity",
                    "agent",
                ],
                env=env,
                cwd=str(REPO_ROOT),
                start_new_session=True,
                stdout=f,
                stderr=subprocess.STDOUT,
            )
        logger.info("Dispatched agent worker for room %s (PID: %d, log: %s)", room_name, process.pid, log_file)
    except Exception as exc:
        logger.error("Failed to dispatch agent worker: %s", exc)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Interview Platform API", version="1.0.0", lifespan=lifespan)

# Read allowed origins from env var (comma-separated). Defaults to "*" for
# local dev; set ALLOWED_ORIGINS to your Railway frontend URL in production.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class AgentCreate(BaseModel):
    name: str
    role: str = ""
    job_title: str | None = None
    company_name: str | None = None
    interview_type: str = "technical"
    difficulty: str = "mid"
    topics: list[str] = []
    max_questions: int = 10
    system_instruction: str | None = None
    language: str = "en"
    tts_model: str = "elevenlabs"
    voice_id: str = ""
    stt_model: str = "elevenlabs"
    llm_model: str = "claude-haiku"
    llm_temperature: float = 0.3
    vad_sensitivity: float = 0.5
    tone: str = "balanced"


class AgentUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    interview_type: str | None = None
    difficulty: str | None = None
    topics: list[str] | None = None
    max_questions: int | None = None
    system_instruction: str | None = None
    language: str | None = None
    tts_model: str | None = None
    voice_id: str | None = None
    stt_model: str | None = None
    llm_model: str | None = None
    llm_temperature: float | None = None
    vad_sensitivity: float | None = None
    tone: str | None = None


class SessionEndRequest(BaseModel):
    duration_seconds: int | None = None


class ChatRequest(BaseModel):
    agent_id: int
    message: str


class TranscriptCreate(BaseModel):
    speaker: str
    text: str
    source: str = "live"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def row_to_agent(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    try:
        d["topics"] = json.loads(d.get("topics") or "[]")
    except (json.JSONDecodeError, TypeError):
        d["topics"] = []
    return d


def row_to_session(row: sqlite3.Row, agent: dict[str, Any] | None = None) -> dict[str, Any]:
    d = dict(row)
    if agent:
        d["agent_name"] = agent.get("name")
        d["agent"] = agent
    return d


# ---------------------------------------------------------------------------
# Routes – Agents
# ---------------------------------------------------------------------------
@app.post("/agents", status_code=201)
def create_agent(body: AgentCreate) -> dict[str, Any]:
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO agents (name, role, job_title, company_name, interview_type,
                difficulty, topics, max_questions, system_instruction, language,
                tts_model, voice_id, stt_model, llm_model, llm_temperature,
                vad_sensitivity, tone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                body.name,
                body.role,
                body.job_title,
                body.company_name,
                body.interview_type,
                body.difficulty,
                json.dumps(body.topics),
                body.max_questions,
                body.system_instruction,
                body.language,
                body.tts_model,
                body.voice_id,
                body.stt_model,
                body.llm_model,
                body.llm_temperature,
                body.vad_sensitivity,
                body.tone,
            ),
        )
        conn.commit()
        agent_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    return row_to_agent(row)


@app.get("/agents")
def list_agents() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM agents ORDER BY created_at DESC").fetchall()
    return [row_to_agent(r) for r in rows]


@app.get("/agents/{agent_id}")
def get_agent(agent_id: int) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    return row_to_agent(row)


@app.patch("/agents/{agent_id}")
def update_agent(agent_id: int, body: AgentUpdate) -> dict[str, Any]:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "topics" in updates:
        updates["topics"] = json.dumps(updates["topics"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [agent_id]

    with get_db() as conn:
        conn.execute(f"UPDATE agents SET {set_clause} WHERE id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    return row_to_agent(row)


@app.delete("/agents/{agent_id}", status_code=204, response_class=Response)
def delete_agent(agent_id: int) -> Response:
    with get_db() as conn:
        conn.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Routes – Sessions
# ---------------------------------------------------------------------------
@app.post("/agents/{agent_id}/join-room")
async def join_room(agent_id: int) -> dict[str, Any]:
    """Create a LiveKit room, dispatch the agent worker, and return the user token."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = row_to_agent(row)
    room_name = f"interview_{uuid.uuid4().hex[:12]}"

    agent_metadata = {
        "job_title": agent.get("job_title") or "",
        "company_name": agent.get("company_name") or "",
        "interview_type": agent.get("interview_type") or "technical",
        "difficulty": agent.get("difficulty") or "mid",
        "voice_id": agent.get("voice_id") or "",
        "system_instruction": agent.get("system_instruction") or "",
    }

    room_name, user_token = await create_room_and_token(room_name, agent_metadata)

    # Persist the session
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO sessions (room_name, agent_id, status) VALUES (?, ?, 'connecting')",
            (room_name, agent_id),
        )
        conn.commit()
        session_id = cursor.lastrowid

    # Dispatch the agent worker
    dispatch_agent_worker(room_name, agent)

    return {
        "room_name": room_name,
        "user_token": user_token,
        "livekit_url": LIVEKIT_URL,
        "agent": agent,
        "session_id": session_id,
    }


@app.get("/sessions")
def list_sessions() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT s.*, a.name as agent_name FROM sessions s LEFT JOIN agents a ON s.agent_id = a.id ORDER BY s.created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/sessions/{session_id}")
def get_session(session_id: int) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT s.*, a.name as agent_name FROM sessions s LEFT JOIN agents a ON s.agent_id = a.id WHERE s.id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)


@app.patch("/sessions/{session_id}/end")
def end_session(session_id: int, body: SessionEndRequest) -> dict[str, Any]:
    with get_db() as conn:
        conn.execute(
            "UPDATE sessions SET status = 'completed', duration_seconds = ? WHERE id = ?",
            (body.duration_seconds, session_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)


@app.post("/sessions/{session_id}/start")
def start_session(session_id: int) -> dict[str, Any]:
    with get_db() as conn:
        conn.execute(
            "UPDATE sessions SET status = 'active' WHERE id = ?",
            (session_id,),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)


@app.get("/sessions/{session_id}/transcript")
def get_transcript(session_id: int) -> list[dict[str, Any]]:
    with get_db() as conn:
        session_row = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        rows = conn.execute(
            """
            SELECT id, session_id, speaker, text, source, created_at
            FROM transcript_entries
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/sessions/{session_id}/transcript", status_code=201)
def append_transcript(session_id: int, body: TranscriptCreate) -> dict[str, Any]:
    speaker = body.speaker.strip()
    text = body.text.strip()
    source = body.source.strip() or "live"
    if not speaker or not text:
        raise HTTPException(status_code=400, detail="speaker and text are required")

    with get_db() as conn:
        session_row = conn.execute("SELECT id FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        cursor = conn.execute(
            """
            INSERT INTO transcript_entries (session_id, speaker, text, source)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, speaker, text, source),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, session_id, speaker, text, source, created_at
            FROM transcript_entries
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


@app.get("/sessions/{session_id}/evaluation")
def get_evaluation(session_id: int) -> dict[str, Any]:
    return {"session_id": session_id, "summary": None, "score": None}


# ---------------------------------------------------------------------------
# Routes – Stats
# ---------------------------------------------------------------------------
@app.get("/stats")
def get_stats() -> dict[str, Any]:
    with get_db() as conn:
        total_agents = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
        total_sessions = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        completed = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE status = 'completed'"
        ).fetchone()[0]
        active = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE status IN ('active', 'connecting')"
        ).fetchone()[0]
        avg_row = conn.execute(
            "SELECT AVG(duration_seconds) FROM sessions WHERE duration_seconds IS NOT NULL"
        ).fetchone()
        avg_duration = avg_row[0] if avg_row and avg_row[0] else None

    return {
        "total_agents": total_agents,
        "total_sessions": total_sessions,
        "completed_sessions": completed,
        "active_sessions": active,
        "avg_duration_seconds": avg_duration,
    }


# ---------------------------------------------------------------------------
# Routes – LiveKit token (for direct token requests)
# ---------------------------------------------------------------------------
@app.post("/livekit/token")
async def get_livekit_token(room: str, identity: str = "user") -> dict[str, Any]:
    if not _livekit_available or not LIVEKIT_URL:
        return {"token": "mock_token", "url": LIVEKIT_URL}

    lk = livekit_api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )
    try:
        token = (
            livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(identity)
            .with_name(identity)
            .with_grants(
                livekit_api.VideoGrants(
                    room_join=True,
                    room=room,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
            .to_jwt()
        )
        return {"token": token, "url": LIVEKIT_URL}
    finally:
        await lk.aclose()


# ---------------------------------------------------------------------------
# Routes – Chat fallback (text input from the interview room)
# ---------------------------------------------------------------------------
@app.post("/chat")
async def chat(body: ChatRequest) -> StreamingResponse:
    """
    Minimal text-only chat fallback.
    In production this would call the LLM directly; for now it echoes a
    helpful message telling the user to speak instead.
    """

    async def stream():
        msg = (
            "Voice input is the primary interface for this interview. "
            "Please unmute your microphone and speak your answer. "
            "The agent will respond via ElevenLabs voice synthesis."
        )
        for word in msg.split():
            yield word + " "
            time.sleep(0.04)

    return StreamingResponse(stream(), media_type="text/plain")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
