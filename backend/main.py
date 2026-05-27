import os
import uuid
import subprocess
from datetime import datetime
from typing import List, Optional
import httpx

import models
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db
from pydantic import BaseModel
from livekit import api
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

# Create / migrate tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="InterviewAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    role: str
    # Interview-specific
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    interview_type: str = "technical"   # technical | behavioral | hr
    difficulty: str = "mid"             # junior | mid | senior
    topics: Optional[List[str]] = None
    max_questions: int = 10
    # Persona — if empty we auto-generate from the fields above
    system_instruction: Optional[str] = None
    # Models
    language: str = "en"
    stt_model: str = "deepgram"
    tts_model: str = "cartesia"
    llm_model: str = "claude-3-5-haiku-20241022"
    llm_temperature: float = 0.7
    voice_id: str
    vad_sensitivity: float = 0.5


class SessionEnd(BaseModel):
    duration_seconds: Optional[int] = None


class ChatMessage(BaseModel):
    agent_id: int
    message: str
    conversation_history: Optional[List[dict]] = None  # [{"role": "user", "content": "..."}, ...]


# ── Helpers ───────────────────────────────────────────────────────────────────

def build_system_prompt(data: AgentCreate) -> str:
    """Auto-generate a rich interviewer system prompt from structured fields."""
    if data.system_instruction and data.system_instruction.strip():
        return data.system_instruction.strip()

    difficulty_map = {
        "junior": "entry-level (0–2 years experience)",
        "mid": "mid-level (2–5 years experience)",
        "senior": "senior-level (5+ years experience)",
    }
    type_map = {
        "technical": "technical coding and system design",
        "behavioral": "behavioral (STAR-method)",
        "hr": "HR screening and culture fit",
    }

    company_ctx = f" at {data.company_name}" if data.company_name else ""
    job_ctx = f" for the role of {data.job_title}" if data.job_title else ""
    topics_ctx = (
        f" Focus on these topics: {', '.join(data.topics)}."
        if data.topics
        else ""
    )

    return (
        f"You are {data.name}, a professional interviewer conducting a "
        f"{type_map.get(data.interview_type, data.interview_type)} interview"
        f"{job_ctx}{company_ctx}. "
        f"The candidate is applying for a {difficulty_map.get(data.difficulty, data.difficulty)} position."
        f"{topics_ctx} "
        f"Ask up to {data.max_questions} focused questions, one at a time. "
        f"Listen carefully to each answer before moving on. "
        f"Be professional, encouraging, and concise. "
        f"Start by greeting the candidate and asking them to introduce themselves."
    )


def generate_livekit_token(room_name: str, identity: str, name: Optional[str] = None) -> str:
    token = (
        api.AccessToken(
            os.getenv("LIVEKIT_API_KEY"),
            os.getenv("LIVEKIT_API_SECRET"),
        )
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_identity(identity)
    )
    if name:
        token.with_name(name)
    return token.to_jwt()


# ── Agent endpoints ───────────────────────────────────────────────────────────

@app.post("/agents", status_code=201)
async def create_agent(agent_data: AgentCreate, db: Session = Depends(get_db)):
    payload = agent_data.dict()
    payload["system_instruction"] = build_system_prompt(agent_data)
    db_agent = models.Agent(**payload)
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


@app.get("/agents")
async def list_agents(db: Session = Depends(get_db)):
    return db.query(models.Agent).order_by(models.Agent.created_at.desc()).all()


@app.get("/agents/{agent_id}")
async def get_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()


# ── Document endpoints ────────────────────────────────────────────────────────

@app.post("/agents/{agent_id}/documents")
async def upload_document(
    agent_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{agent_id}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        import rag_utils as _rag
        _rag.process_document(file_path, agent_id)
    except Exception as e:
        print(f"RAG indexing skipped: {e}")

    db_doc = models.Document(
        agent_id=agent_id,
        filename=file.filename,
        file_path=file_path,
        vector_ids=[],
    )
    db.add(db_doc)
    db.commit()
    return {"status": "uploaded and indexed", "filename": file.filename}


@app.get("/agents/{agent_id}/documents")
async def list_documents(agent_id: int, db: Session = Depends(get_db)):
    return db.query(models.Document).filter(models.Document.agent_id == agent_id).all()


# ── Interview session endpoints ───────────────────────────────────────────────

@app.post("/agents/{agent_id}/join-room")
async def join_room(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
    if not all([livekit_url, livekit_api_key, livekit_api_secret]):
        raise HTTPException(status_code=500, detail="LiveKit environment is not configured")

    room_name = f"interview-{agent_id}-{uuid.uuid4().hex[:8]}"
    bot_token = generate_livekit_token(room_name, f"bot_{agent_id}", name=agent.name)
    user_token = generate_livekit_token(room_name, "user")

    # Persist session record
    session = models.InterviewSession(agent_id=agent_id, room_name=room_name)
    db.add(session)
    db.commit()
    db.refresh(session)

    # Spawn pipecat bot
    env = os.environ.copy()
    env["LIVEKIT_URL"] = livekit_url
    env["LIVEKIT_TOKEN"] = bot_token
    env["LIVEKIT_ROOM_NAME"] = room_name
    env["AGENT_SYSTEM_PROMPT"] = agent.system_instruction
    env["AGENT_VOICE_ID"] = agent.voice_id
    env["AGENT_LANGUAGE"] = agent.language
    env["AGENT_ID"] = str(agent_id)
    env["AGENT_STT_PROVIDER"] = agent.stt_model
    env["AGENT_TTS_PROVIDER"] = agent.tts_model
    env["AGENT_LLM_PROVIDER"] = "anthropic"  # Use Anthropic Claude
    
    # Ensure we use a valid Claude model
    model = agent.llm_model or "claude-haiku-4-5"
    if "llama" in model.lower() or "groq" in model.lower() or "gemini" in model.lower():
        model = "claude-haiku-4-5"
    env["AGENT_LLM_MODEL"] = model
    
    env["AGENT_LLM_TEMPERATURE"] = str(agent.llm_temperature)
    env["AGENT_VAD_SENSITIVITY"] = str(agent.vad_sensitivity)

    # Use the pipecat venv Python from workspace
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bot_script = os.path.join(base_dir, "pipecat-outbound", "bot.py")
    venv_python = os.path.join(base_dir, "pipecat-outbound", "venv", "bin", "python3")
    
    env["PYTHONUNBUFFERED"] = "1"
    bot_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "server.log"))
    with open(bot_log_path, "a", buffering=1) as bot_log:
        subprocess.Popen(
            [venv_python, bot_script],
            env=env,
            cwd=os.path.dirname(bot_script),
            stdout=bot_log,
            stderr=subprocess.STDOUT,
        )

    return {
        "status": "bot joined",
        "session_id": session.id,
        "user_token": user_token,
        "room_name": room_name,
        "livekit_url": os.getenv("LIVEKIT_URL", ""),
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "job_title": agent.job_title,
            "company_name": agent.company_name,
            "interview_type": agent.interview_type,
            "difficulty": agent.difficulty,
        },
    }


@app.patch("/sessions/{session_id}/end")
async def end_session(
    session_id: int, body: SessionEnd, db: Session = Depends(get_db)
):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    session.duration_seconds = body.duration_seconds
    db.commit()
    return {"status": "completed"}


@app.get("/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    return (
        db.query(models.InterviewSession)
        .order_by(models.InterviewSession.created_at.desc())
        .limit(50)
        .all()
    )


@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_agents = db.query(models.Agent).count()
    total_sessions = db.query(models.InterviewSession).count()
    completed = db.query(models.InterviewSession).filter(
        models.InterviewSession.status == "completed"
    ).count()
    avg_duration = None
    durations = [
        s.duration_seconds
        for s in db.query(models.InterviewSession).filter(
            models.InterviewSession.duration_seconds.isnot(None)
        ).all()
    ]
    if durations:
        avg_duration = int(sum(durations) / len(durations))

    return {
        "total_agents": total_agents,
        "total_sessions": total_sessions,
        "completed_sessions": completed,
        "avg_duration_seconds": avg_duration,
    }


# ── Chat endpoint (direct Claude API call) ────────────────────────────────────

@app.post("/chat")
async def chat_with_agent(chat_data: ChatMessage, db: Session = Depends(get_db)):
    """
    Direct chat endpoint that calls Claude API and returns response.
    This bypasses the Pipecat bot for simple text-based conversations.
    """
    # Get agent configuration
    agent = db.query(models.Agent).filter(models.Agent.id == chat_data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get Claude API key
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_api_key:
        raise HTTPException(status_code=500, detail="Claude API key not configured")
    
    # Determine the model to use - force Claude models only
    model = agent.llm_model or "claude-haiku-4-5"
    
    # If the model is not a Claude model, use Claude Sonnet
    if "llama" in model.lower() or "groq" in model.lower() or "gemini" in model.lower():
        model = "claude-haiku-4-5"
    
    # Build conversation history
    messages = []
    
    # Add conversation history if provided
    if chat_data.conversation_history:
        messages.extend(chat_data.conversation_history)
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": chat_data.message
    })
    
    # Enhanced system instruction for clean formatting
    full_system_instruction = (
        f"{agent.system_instruction}\n\n"
        "IMPORTANT: Speak in a natural, human-like manner. "
        "DO NOT use any markdown formatting such as hashes (#), bolding (**), or italics (*). "
        "DO NOT use any emojis. "
        "Keep your responses concise and conversational (2-4 sentences max)."
    )
    
    # Call Claude API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 1024,
                    "temperature": agent.llm_temperature or 0.7,
                    "system": full_system_instruction,
                    "messages": messages,
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Claude API error: {error_detail}"
                )
            
            result = response.json()
            
            # Extract assistant's response
            assistant_message = ""
            if result.get("content") and len(result["content"]) > 0:
                assistant_message = result["content"][0].get("text", "")
            
            return {
                "response": assistant_message,
                "model": result.get("model"),
                "usage": result.get("usage"),
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Claude API timeout")
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
