"""
Interview Agent — ElevenLabs STT + TTS, Claude LLM
=========================================================
- STT: ElevenLabs Scribe (streaming, free-tier compatible)
- TTS: ElevenLabs with configurable voice_id
- LLM: Claude Haiku
- VAD: Silero

Configuration is loaded from:
  1. Environment variables set by backend/main.py when dispatching the worker
  2. LiveKit room metadata (JSON) as a fallback
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import AsyncGenerator, AsyncIterable

import httpx
from dotenv import load_dotenv
from anthropic import Anthropic as AnthropicClient

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AgentTask,
    JobContext,
    cli,
)
from livekit.agents.llm import function_tool
from livekit.agents.types import TimedString
from livekit.agents.voice.agent import ModelSettings
from livekit.plugins import anthropic, elevenlabs, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

logger = logging.getLogger("InterviewAgent")
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Provider defaults. Environment variables may override these, but the worker
# validates them against the configured provider keys before starting the call.
# ---------------------------------------------------------------------------
DEFAULT_CLAUDE_MODEL = os.getenv("ANTHROPIC_MODEL") or os.getenv(
    "CLAUDE_MODEL", "claude-haiku-4-5-20251001"
)
FALLBACK_ELEVEN_VOICE_ID = "XrExE9yKIg1WjnnlVkGX"
DEFAULT_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", FALLBACK_ELEVEN_VOICE_ID)


def resolve_anthropic_model(api_key: str, requested_model: str) -> str:
    if not api_key:
        return requested_model

    try:
        models = AnthropicClient(api_key=api_key).models.list(limit=50)
        model_ids = [model.id for model in models.data]
    except Exception as exc:
        logger.warning("Could not list Anthropic models, using configured model: %s", exc)
        return requested_model

    if requested_model in model_ids:
        return requested_model

    for candidate in ("claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-sonnet-4-20250514"):
        if candidate in model_ids:
            logger.warning(
                "Anthropic model %s is unavailable for this key; using %s",
                requested_model,
                candidate,
            )
            return candidate

    if model_ids:
        logger.warning(
            "Anthropic model %s is unavailable for this key; using %s",
            requested_model,
            model_ids[0],
        )
        return model_ids[0]

    return requested_model


def resolve_elevenlabs_voice_id(api_key: str, requested_voice_id: str) -> str:
    candidates: list[str] = []
    for candidate in (requested_voice_id, os.getenv("ELEVEN_VOICE_ID", ""), FALLBACK_ELEVEN_VOICE_ID):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    if not api_key:
        return candidates[0]

    try:
        response = httpx.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": api_key},
            timeout=10,
        )
        response.raise_for_status()
        voices = response.json().get("voices", [])
    except Exception as exc:
        logger.warning("Could not list ElevenLabs voices, using configured voice: %s", exc)
        return candidates[0]

    voice_ids = {voice.get("voice_id") for voice in voices}
    for candidate in candidates:
        if candidate in voice_ids:
            if candidate != requested_voice_id:
                logger.warning(
                    "ElevenLabs voice %s is unavailable for this key; using %s",
                    requested_voice_id,
                    candidate,
                )
            return candidate

    if voices:
        fallback = voices[0].get("voice_id")
        if fallback:
            logger.warning(
                "ElevenLabs voice %s is unavailable for this key; using %s",
                requested_voice_id,
                fallback,
            )
            return fallback

    return candidates[0]


# ---------------------------------------------------------------------------
# Transcript publishing helpers
# ---------------------------------------------------------------------------
async def publish_transcript(room: rtc.Room, speaker: str, text: str, is_final: bool) -> None:
    """Publish transcript messages over the LiveKit data channel to the frontend."""
    payload = json.dumps(
        {
            "type": "transcript",
            "speaker": speaker,
            "text": text,
            "is_partial": not is_final,
        }
    )
    try:
        await room.local_participant.publish_data(payload.encode(), reliable=True)
    except Exception as exc:
        logger.warning("Failed to publish transcript: %s", exc)


# ---------------------------------------------------------------------------
# AgentTask — drives the interview conversation
# ---------------------------------------------------------------------------
class InterviewTask(AgentTask):
    def __init__(
        self,
        job_title: str,
        company_name: str,
        interview_type: str,
        difficulty: str,
        max_questions: int,
        instructions: str | None = None,
    ) -> None:
        if not instructions:
            instructions = (
                f"You are an expert interviewer conducting a {difficulty} {interview_type} "
                f"interview for a {job_title} position at {company_name}. "
                "Evaluate the candidate's fit for this role. "
                "Be professional, encouraging but rigorous. "
                "Ask one question at a time. Use a natural conversational tone — "
                "never bullet points or numbered lists. "
                f"Ask no more than {max_questions} questions total. "
                "When you have enough information to evaluate the candidate, "
                "or the candidate ends the conversation, call end_interview()."
            )
        super().__init__(instructions=instructions)
        self.job_title = job_title
        self.company_name = company_name
        self.interview_type = interview_type
        self.difficulty = difficulty

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=(
                f"Welcome the candidate warmly to their {self.difficulty} {self.interview_type} "
                f"interview for the {self.job_title} role at {self.company_name}. "
                "Introduce yourself briefly and open with a friendly first question."
            )
        )

    @function_tool()
    async def end_interview(self) -> None:
        """Call this when the interview is complete to wrap up and close the session."""
        await self.session.generate_reply(
            instructions=(
                "The interview is now complete. Thank the candidate warmly for their time, "
                "give them a brief summary of how it went, and let them know the next steps. "
                "Then say goodbye and conclude the call."
            )
        )
        await asyncio.sleep(6)
        self.session.shutdown()


# ---------------------------------------------------------------------------
# Agent — wires InterviewTask and intercepts transcription for the frontend
# ---------------------------------------------------------------------------
class InterviewAgent(Agent):
    def __init__(
        self,
        job_title: str,
        company_name: str,
        interview_type: str,
        difficulty: str,
        max_questions: int,
        room: rtc.Room,
        instructions: str | None = None,
    ) -> None:
        self.job_title = job_title
        self.company_name = company_name
        self.interview_type = interview_type
        self.difficulty = difficulty
        self.max_questions = max_questions
        self.room = room
        self.system_instructions = instructions
        super().__init__(
            instructions=instructions
            or (
                f"You are a professional interviewer for {company_name} conducting a "
                f"{interview_type} interview for a {job_title} role."
            )
        )

    async def on_enter(self) -> AgentTask:
        return InterviewTask(
            job_title=self.job_title,
            company_name=self.company_name,
            interview_type=self.interview_type,
            difficulty=self.difficulty,
            max_questions=self.max_questions,
            instructions=self.system_instructions,
        )

    async def transcription_node(
        self,
        text: AsyncIterable[str | TimedString],
        model_settings: ModelSettings,
    ) -> AsyncGenerator[str | TimedString, None]:
        """Forward assistant transcript chunks to the frontend data channel."""
        full_text = ""
        async for chunk in text:
            content = str(chunk)
            if content.strip():
                full_text += content
                await publish_transcript(self.room, "assistant", content, is_final=False)
            yield chunk

        if full_text.strip():
            await publish_transcript(self.room, "assistant", full_text, is_final=True)


# ---------------------------------------------------------------------------
# AgentServer entrypoint
# ---------------------------------------------------------------------------
server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    # ------------------------------------------------------------------
    # Load config — env vars take priority, room metadata is the fallback
    # ------------------------------------------------------------------
    job_title = os.getenv("AGENT_JOB_TITLE", "Software Engineer")
    company_name = os.getenv("AGENT_COMPANY_NAME", "the company")
    interview_type = os.getenv("AGENT_INTERVIEW_TYPE", "technical")
    difficulty = os.getenv("AGENT_DIFFICULTY", "mid")
    max_questions = int(os.getenv("AGENT_MAX_QUESTIONS", "10"))
    voice_id = os.getenv("AGENT_VOICE_ID", "") or DEFAULT_VOICE_ID
    system_prompt = os.getenv("AGENT_SYSTEM_PROMPT", "")

    if ctx.room.metadata:
        try:
            meta = json.loads(ctx.room.metadata)
            job_title = meta.get("job_title") or job_title
            company_name = meta.get("company_name") or company_name
            interview_type = meta.get("interview_type") or interview_type
            difficulty = meta.get("difficulty") or difficulty
            voice_id = meta.get("voice_id") or voice_id
            system_prompt = meta.get("system_instruction") or system_prompt
        except (json.JSONDecodeError, AttributeError):
            pass

    logger.info(
        "Starting interview: job=%s company=%s type=%s difficulty=%s voice=%s",
        job_title, company_name, interview_type, difficulty, voice_id,
    )

    # ------------------------------------------------------------------
    # Build the session — ElevenLabs for STT/TTS, Claude for LLM
    # ------------------------------------------------------------------
    elevenlabs_api_key = os.getenv("ELEVEN_API_KEY") or os.getenv("ELEVENLABS_API_KEY", "")
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
    claude_model = resolve_anthropic_model(anthropic_api_key, DEFAULT_CLAUDE_MODEL)
    voice_id = resolve_elevenlabs_voice_id(elevenlabs_api_key, voice_id)

    session = AgentSession(
        llm=anthropic.LLM(
            model=claude_model,
            api_key=anthropic_api_key,
        ),
        stt=elevenlabs.STT(api_key=elevenlabs_api_key, model_id="scribe_v1"),
        tts=elevenlabs.TTS(
            voice_id=voice_id,
            model="eleven_flash_v2_5",
            api_key=elevenlabs_api_key,
        ),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
        preemptive_generation=True,
    )

    # Forward user speech transcript to the frontend
    @session.on("user_input_transcribed")
    def on_user_transcript(ev: object) -> None:
        transcript = getattr(ev, "transcript", "")
        is_final = getattr(ev, "is_final", True)
        if transcript.strip():
            asyncio.create_task(
                publish_transcript(ctx.room, "user", transcript, is_final)
            )

    # Handle text input from the data channel
    async def handle_text_input(packet: rtc.DataPacket) -> None:
        try:
            if not packet.data.strip().startswith(b"{"):
                return
            data = json.loads(packet.data.decode())
            if data.get("type") == "text_input" and data.get("text"):
                text = str(data["text"]).strip()
                if not text:
                    return
                await session.interrupt()
                session.generate_reply(user_input=text)
        except Exception as exc:
            logger.warning("Failed to handle text input: %s", exc)

    ctx.room.on("data_received", lambda packet: asyncio.create_task(handle_text_input(packet)))

    await session.start(
        agent=InterviewAgent(
            job_title=job_title,
            company_name=company_name,
            interview_type=interview_type,
            difficulty=difficulty,
            max_questions=max_questions,
            room=ctx.room,
            instructions=system_prompt or None,
        ),
        room=ctx.room,
    )


if __name__ == "__main__":
    cli.run_app(server)
