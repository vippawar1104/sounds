# Sounds: AI Interview Agent

A voice-native AI interview platform built with Pipecat, LiveKit, and FastAPI. This project allows users to create custom AI interviewers with specific personas, knowledge bases, and high-quality voices.

## Features

- Voice Interaction: Real-time, low-latency voice conversations using LiveKit and Pipecat.
- Multiple TTS Providers: Integrated with Cartesia and ElevenLabs for natural human-like speech.
- Dynamic Personas: Create agents with specific roles, difficulty levels, and interview styles (Technical, Behavioral, HR).
- RAG Integration: Upload documents (PDF/TXT) to provide agents with specific knowledge bases or resumes.
- Interactive Dashboard: Next.js frontend for managing agents and conducting interviews.

## Project Structure

- /backend: FastAPI server managing the database, agent configurations, and session orchestration.
- /dashboard: Next.js frontend with the Agent Builder and Interview interface.
- /pipecat-outbound: The core voice bot implementation using the Pipecat framework.

## Tech Stack

- LLM: Anthropic Claude / Groq (Llama 3)
- STT: Deepgram
- TTS: ElevenLabs / Cartesia
- Transport: LiveKit
- Frontend: Next.js, Tailwind CSS, TypeScript
- Backend: Python, FastAPI, SQLAlchemy

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- LiveKit Cloud account (or self-hosted)
- API keys for: ElevenLabs, Deepgram, and Anthropic/Groq

### Installation

1. Clone the repository:
   git clone https://github.com/vippawar1104/sounds
   cd sounds

2. Set up the backend:
   cd backend
   pip install -r requirements.txt
   # Configure .env with your API keys

3. Set up the frontend:
   cd ../dashboard
   npm install
   npm run dev

4. Set up the bot:
   cd ../pipecat-outbound
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   # Configure .env with ElevenLabs and LiveKit keys

## License

MIT
