#!/bin/bash

echo "🔍 Sounds Interview System - Status Check"
echo "=========================================="
echo ""

# Check Frontend
echo "📱 Frontend (Port 3000):"
if lsof -ti :3000 > /dev/null 2>&1; then
    echo "   ✅ Running"
    echo "   🌐 http://localhost:3000"
else
    echo "   ❌ Not running"
    echo "   💡 Start with: cd dashboard && npm run dev"
fi
echo ""

# Check Backend
echo "🔧 Backend (Port 8000):"
if lsof -ti :8000 > /dev/null 2>&1; then
    echo "   ✅ Running"
    echo "   🌐 http://localhost:8000/docs"
else
    echo "   ❌ Not running"
    echo "   💡 Start with: cd backend && source ../.venv/bin/activate && uvicorn main:app --reload --port 8000"
fi
echo ""

# Check Bot Processes
echo "🤖 Bot Processes:"
BOT_COUNT=$(ps aux | grep "bot.py" | grep -v grep | wc -l | tr -d ' ')
if [ "$BOT_COUNT" -eq "0" ]; then
    echo "   ✅ No old processes (clean)"
else
    echo "   ⚠️  $BOT_COUNT bot process(es) running"
    echo "   💡 Kill with: ps aux | grep 'bot.py' | grep -v grep | awk '{print \$2}' | xargs kill -9"
    echo ""
    echo "   Running bots:"
    ps aux | grep "bot.py" | grep -v grep | awk '{print "      PID " $2 " - " $11 " " $12 " " $13}'
fi
echo ""

# Check API Keys
echo "🔑 API Keys (Backend .env):"
if [ -f "backend/.env" ]; then
    if grep -q "ANTHROPIC_API_KEY=sk-ant" backend/.env; then
        echo "   ✅ Anthropic Claude"
    else
        echo "   ❌ Anthropic Claude - missing or invalid"
    fi
    
    if grep -q "DEEPGRAM_API_KEY=" backend/.env && [ -n "$(grep "DEEPGRAM_API_KEY=" backend/.env | cut -d'=' -f2)" ]; then
        echo "   ✅ Deepgram STT"
    else
        echo "   ❌ Deepgram STT - missing"
    fi
    
    if grep -q "CARTESIA_API_KEY=sk_car" backend/.env; then
        echo "   ✅ Cartesia TTS"
    else
        echo "   ❌ Cartesia TTS - missing or invalid"
    fi
    
    if grep -q "LIVEKIT_URL=wss://" backend/.env; then
        echo "   ✅ LiveKit"
    else
        echo "   ❌ LiveKit - missing or invalid"
    fi
else
    echo "   ❌ backend/.env not found"
fi
echo ""

# Check Database
echo "💾 Database:"
if [ -f "backend/sql_app.db" ]; then
    DB_SIZE=$(du -h backend/sql_app.db | awk '{print $1}')
    echo "   ✅ SQLite database exists ($DB_SIZE)"
else
    echo "   ⚠️  Database not found (will be created on first run)"
fi
echo ""

# Check Pipecat
echo "🎙️  Pipecat Bot:"
if [ -d "/Users/vipulpawar/projects/pipecat-outbound" ]; then
    echo "   ✅ Located at /Users/vipulpawar/projects/pipecat-outbound"
    if [ -d "/Users/vipulpawar/projects/pipecat-outbound/venv" ]; then
        echo "   ✅ Virtual environment exists"
    else
        echo "   ❌ Virtual environment missing"
    fi
else
    echo "   ❌ Pipecat directory not found"
fi
echo ""

echo "=========================================="
echo "✨ Text Input Feature: READY"
echo "📖 See TEST_TEXT_INPUT.md for testing guide"
echo ""
