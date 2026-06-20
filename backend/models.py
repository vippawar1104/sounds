from sqlalchemy import Column, Integer, String, Text, Float, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    role = Column(String)
    system_instruction = Column(Text)

    # ── Interview-specific fields ──────────────────────────────────────────────
    job_title = Column(String, nullable=True)          # Role being interviewed for
    company_name = Column(String, nullable=True)       # Company context
    interview_type = Column(String, default="technical")  # technical | behavioral | hr
    difficulty = Column(String, default="mid")         # junior | mid | senior
    topics = Column(JSON, nullable=True)               # ["DSA", "System Design", ...]
    max_questions = Column(Integer, default=10)        # How many questions to ask

    # ── Models & Settings ──────────────────────────────────────────────────────
    language = Column(String, default="en")
    stt_model = Column(String, default="deepgram")
    tts_model = Column(String, default="cartesia")
    llm_model = Column(String, default="llama-3.1-70b-versatile")

    # ── Parameters ────────────────────────────────────────────────────────────
    llm_temperature = Column(Float, default=0.7)
    llm_max_tokens = Column(Integer, default=500)
    vad_sensitivity = Column(Float, default=0.5)

    # ── Voice Settings ────────────────────────────────────────────────────────
    voice_id = Column(String)
    voice_settings = Column(JSON)

    # ── RAG ───────────────────────────────────────────────────────────────────
    knowledge_base_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    filename = Column(String)
    file_path = Column(String)
    vector_ids = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    """Tracks every interview session for history / analytics."""
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    room_name = Column(String, unique=True, index=True)
    candidate_name = Column(String, nullable=True)
    status = Column(String, default="active")   # active | completed | abandoned
    duration_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
