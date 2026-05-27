import asyncio
import json
import os
import sys
import logging
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── Pipecat 1.2.1 imports ─────────────────────────────────────────────────────

from pipecat.frames.frames import (
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
)

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask

from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.aggregators.llm_context import LLMContext

from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.llm_service import FunctionCallParams

# Tool schema API (pipecat 1.2.1)
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.adapters.schemas.function_schema import FunctionSchema

from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

# RAG (optional)
sys.path.append(str(Path(__file__).resolve().parent.parent / "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("bot")


# ── Lazy-load RAG utils ────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_rag_utils():
    try:
        import rag_utils
        return rag_utils
    except ImportError:
        logger.warning("rag_utils not found – RAG disabled.")
        return None


# ── Transcript publisher ───────────────────────────────────────────────────────
# Sits in the pipeline between the LLM and TTS; captures assistant text and
# publishes it to the frontend via LiveKit data messages.

class TranscriptPublisher(FrameProcessor):
    """
    Intercepts LLM text frames and user STT frames and publishes them to the
    LiveKit room as JSON data messages so the frontend can display a live
    transcript.

    Also forwards user transcription frames to add them to LLM context and
    trigger the LLM.
    """

    def __init__(self, transport: LiveKitTransport, context: LLMContext, task_ref: list):
        super().__init__(name="TranscriptPublisher")
        self._transport = transport
        self._context = context
        self._task_ref = task_ref          # mutable list so we can set it after task creation
        self._assistant_chunks: list[str] = []

    # ── helpers ────────────────────────────────────────────────────────────────

    async def _publish(self, speaker: str, text: str):
        """Send a transcript data message to all participants in the room."""
        payload = json.dumps(
            {"type": "transcript", "speaker": speaker, "text": text},
            ensure_ascii=False,
        )
        # pipecat 1.2.1: send_message(str, participant_id=None)
        await self._transport.send_message(payload)

    async def _trigger_llm(self):
        """Push LLMContextFrame into the pipeline to make the LLM respond."""
        task = self._task_ref[0] if self._task_ref else None
        if task:
            await task.queue_frame(LLMContextFrame(context=self._context))
        else:
            logger.warning("_trigger_llm called before task was set")

    # ── frame processing ───────────────────────────────────────────────────────

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        # ── User speech (STT output) ──
        if isinstance(frame, InterimTranscriptionFrame):
            text = frame.text.strip()
            if text:
                await self._publish("user", text)

        elif isinstance(frame, TranscriptionFrame):
            text = frame.text.strip()
            if text:
                await self._publish("user", text)
                # Add to context and trigger LLM only on final utterances
                if frame.finalized:
                    self._context.add_message({"role": "user", "content": text})
                    await self._trigger_llm()

        # ── Assistant speech (LLM output) ──
        elif isinstance(frame, LLMFullResponseStartFrame):
            self._assistant_chunks = []

        elif isinstance(frame, LLMTextFrame):
            text = frame.text
            if text:
                self._assistant_chunks.append(text)

        elif isinstance(frame, LLMFullResponseEndFrame):
            full_text = "".join(self._assistant_chunks).strip()
            self._assistant_chunks = []
            if full_text:
                self._context.add_message({"role": "assistant", "content": full_text})
                await self._publish("assistant", full_text)

        await self.push_frame(frame, direction)


# ── Service factories ──────────────────────────────────────────────────────────

def create_stt(provider: str, language: str) -> DeepgramSTTService:
    if provider == "deepgram":
        return DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            # Deepgram 1.2.1 no longer has a `language` positional param;
            # pass it via live_options if needed.
        )
    logger.warning("Unsupported STT provider %s; falling back to Deepgram", provider)
    return DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))


def create_tts(provider: str, voice_id: str):
    if provider == "cartesia":
        return CartesiaTTSService(
            api_key=os.getenv("CARTESIA_API_KEY"),
            voice_id=voice_id,
        )
    if provider == "elevenlabs":
        return ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=voice_id,
        )
    logger.warning("Unsupported TTS provider %s; falling back to Cartesia", provider)
    return CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        voice_id=voice_id,
    )


def create_llm(provider: str, model: str) -> GroqLLMService:
    return GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model=model if provider == "groq" else "llama-3.3-70b-versatile",
    )


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    # ── Read config from environment (injected by backend) ──────────────────
    livekit_url   = os.getenv("LIVEKIT_URL")
    livekit_token = os.getenv("LIVEKIT_TOKEN")
    room_name     = os.getenv("LIVEKIT_ROOM_NAME")

    system_prompt    = os.getenv("AGENT_SYSTEM_PROMPT", "You are a helpful assistant.")
    voice_id         = os.getenv("AGENT_VOICE_ID", "79a125e8-cd45-4c13-8a67-188112f4dd22")
    language         = os.getenv("AGENT_LANGUAGE", "en")
    agent_id         = int(os.getenv("AGENT_ID", "0"))
    stt_provider     = os.getenv("AGENT_STT_PROVIDER", "deepgram")
    tts_provider     = os.getenv("AGENT_TTS_PROVIDER", "cartesia")
    llm_provider     = os.getenv("AGENT_LLM_PROVIDER", "groq")
    llm_model        = os.getenv("AGENT_LLM_MODEL", "llama-3.3-70b-versatile")

    if not all([livekit_url, livekit_token, room_name]):
        logger.error("Missing LiveKit configuration (LIVEKIT_URL / LIVEKIT_TOKEN / LIVEKIT_ROOM_NAME)")
        return

    logger.info("Starting bot for room %s", room_name)

    # ── Transport ────────────────────────────────────────────────────────────
    transport = LiveKitTransport(
        url=livekit_url,
        token=livekit_token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            # video_in_enabled / video_out_enabled not needed for voice interview
        ),
    )

    # ── AI services ──────────────────────────────────────────────────────────
    stt = create_stt(stt_provider, language)
    tts = create_tts(tts_provider, voice_id)
    llm = create_llm(llm_provider, llm_model)

    # ── Tool: search_knowledge_base ──────────────────────────────────────────
    async def handle_search_knowledge_base(params: FunctionCallParams):
        query = params.arguments.get("query", "")
        rag = _load_rag_utils()
        if not rag:
            result = "Knowledge base unavailable."
        else:
            logger.info("RAG query: %s", query)
            result = rag.query_knowledge_base(query, agent_id)
        await params.result_callback(result)

    # ── Tool: end_interview ───────────────────────────────────────────────────
    async def handle_end_interview(params: FunctionCallParams):
        logger.info("end_interview called — scheduling shutdown")
        await params.result_callback("Interview concluded. Goodbye!")
        # Give TTS time to finish, then exit
        async def _shutdown():
            await asyncio.sleep(8)
            sys.exit(0)
        asyncio.create_task(_shutdown())

    # Register function handlers (pipecat 1.2.1: just name + handler)
    llm.register_function("search_knowledge_base", handle_search_knowledge_base)
    llm.register_function("end_interview", handle_end_interview)

    # ── LLM context ──────────────────────────────────────────────────────────
    tools = ToolsSchema(
        standard_tools=[
            FunctionSchema(
                name="search_knowledge_base",
                description="Look up information from the agent's knowledge base.",
                properties={
                    "query": {
                        "type": "string",
                        "description": "The question or topic to search for.",
                    }
                },
                required=["query"],
            ),
            FunctionSchema(
                name="end_interview",
                description=(
                    "Call this ONLY after you have finished asking all your questions and the "
                    "candidate has answered the last one. This ends the interview session."
                ),
                properties={},
                required=[],
            ),
        ]
    )

    full_system_prompt = (
        f"{system_prompt}\n\n"
        "You have access to a knowledge base — use 'search_knowledge_base' when you need "
        "information that was not in your training data.\n"
        "When you have finished ALL your interview questions and the candidate has answered "
        "the last one, call 'end_interview' to gracefully close the session.\n"
        "Keep every response concise and conversational (2-4 sentences max)."
    )

    context = LLMContext(
        messages=[{"role": "system", "content": full_system_prompt}]
    )
    context.set_tools(tools)

    # ── task_ref: a mutable box so TranscriptPublisher can queue frames ───────
    task_ref: list = []

    # ── Transcript publisher ──────────────────────────────────────────────────
    transcript_publisher = TranscriptPublisher(transport, context, task_ref)

    # ── Pipeline ──────────────────────────────────────────────────────────────
    #
    # Flow:
    #   LiveKit audio-in
    #     → Deepgram STT (audio → text)
    #     → TranscriptPublisher (captures user text, triggers LLM, captures assistant text)
    #     → Groq LLM (LLMContextFrame → text tokens)
    #     → Cartesia/ElevenLabs TTS (text → audio)
    #     → LiveKit audio-out
    #
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            transcript_publisher,
            llm,
            tts,
            transport.output(),
        ]
    )

    task = PipelineTask(
        pipeline,
        PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
        ),
    )

    # Give TranscriptPublisher a reference to the task so it can queue frames
    task_ref.append(task)

    # ── Greeting flag — send only once ───────────────────────────────────────
    greeting_sent = False

    async def send_greeting():
        nonlocal greeting_sent
        if greeting_sent:
            return
        greeting_sent = True
        logger.info("Sending greeting")
        # Inject a hidden user turn so the LLM generates the opening message
        context.add_message(
            {
                "role": "user",
                "content": (
                    "The candidate has just joined the room. "
                    "Greet them warmly, introduce yourself by name and role, "
                    "and ask them to introduce themselves."
                ),
            }
        )
        # queue_frame pushes directly into the running pipeline
        await task.queue_frame(LLMContextFrame(context=context))

    # ── Event: bot has connected to the LiveKit room ─────────────────────────
    # on_connected fires with signature: handler(transport_instance)
    @transport.event_handler("on_connected")
    async def on_connected(transport_instance):
        logger.info("Bot connected to LiveKit room %s", room_name)
        # If a participant is already present (race condition), greet immediately
        try:
            participants = transport_instance.get_participants()
            if participants:
                logger.info("Participant already in room — greeting immediately")
                await send_greeting()
        except Exception:
            pass

    # ── Event: a participant joined the room ─────────────────────────────────
    # on_participant_connected fires with signature: handler(transport_instance, participant_id)
    @transport.event_handler("on_participant_connected")
    async def on_participant_connected(transport_instance, participant_id: str):
        logger.info("Participant joined: %s", participant_id)
        await send_greeting()

    # ── Run ───────────────────────────────────────────────────────────────────
    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    asyncio.run(main())
