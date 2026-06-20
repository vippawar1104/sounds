# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.12
ARG NODE_VERSION=20

FROM python:${PYTHON_VERSION}-slim AS python-base

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    ffmpeg \
    libportaudio2 \
  && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
  && ln -s /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

FROM python-base AS backend-build

COPY pyproject.toml uv.lock ./
COPY backend/ ./backend/
COPY examples/voice_agents/interview_agent.py ./examples/voice_agents/interview_agent.py
COPY livekit-agents/ ./livekit-agents/
COPY livekit-plugins/ ./livekit-plugins/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install fastapi==0.104.1 uvicorn[standard]==0.34.0

ENV INTERVIEW_DB_PATH=/data/interview.db
RUN mkdir -p /data

EXPOSE 8000
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"

FROM python:${PYTHON_VERSION}-slim AS backend-runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libportaudio2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-build /opt/venv /opt/venv
COPY backend/ ./backend/
COPY examples/voice_agents/interview_agent.py ./examples/voice_agents/interview_agent.py

ENV INTERVIEW_DB_PATH=/data/interview.db
RUN mkdir -p /data

EXPOSE 8000
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"

FROM node:${NODE_VERSION}-bookworm-slim AS frontend-build

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY dashboard/ ./

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build

EXPOSE 3000
CMD sh -c "npm run start -- -H 0.0.0.0 -p ${PORT:-3000}"
