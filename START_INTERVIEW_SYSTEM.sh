#!/bin/bash

echo "🚀 Starting Interview System with Claude..."
echo ""

# Kill any existing processes
echo "Cleaning up old processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
ps aux | grep "bot.py" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
sleep 2

# Clear logs
echo "" > /Users/vipulpawar/Desktop/sounds/backend/server.log

# Start backend
echo "Starting backend on port 8000..."
cd /Users/vipulpawar/Desktop/sounds/backend
source ../.venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
sleep 3

# Start frontend
echo "Starting frontend on port 3000..."
cd /Users/vipulpawar/Desktop/sounds/dashboard
npm run dev &
FRONTEND_PID=$!
sleep 5

echo ""
echo "✅ System started!"
echo ""
echo "📋 Configuration:"
echo "   Backend: http://localhost:8000 (PID: $BACKEND_PID)"
echo "   Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo "   LLM: Anthropic Claude (claude-3-5-sonnet-20241022)"
echo "   TTS: Cartesia"
echo "   STT: Deepgram"
echo ""
echo "🎯 Open http://localhost:3000 in your browser"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Logs: tail -f /Users/vipulpawar/Desktop/sounds/backend/server.log"
