#!/bin/bash
set -e

echo "🔄 Switching to Google Gemini..."
echo ""

# Step 1: Kill all old bot processes
echo "1️⃣ Killing old bot processes..."
pkill -9 -f "bot.py" || true
sleep 2

# Step 2: Install Google Gemini in pipecat venv
echo "2️⃣ Installing Google Gemini SDK..."
cd /Users/vipulpawar/projects/pipecat-outbound
source venv/bin/activate
pip install -q google-generativeai

# Step 3: Update bot.py to use Gemini
echo "3️⃣ Updating bot.py to use Gemini..."
python3 /Users/vipulpawar/Desktop/sounds/backend/update_bot_gemini.py

# Step 4: Clear logs
echo "4️⃣ Clearing logs..."
echo "" > /Users/vipulpawar/Desktop/sounds/backend/server.log

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Configuration:"
echo "   LLM Provider: Google Gemini"
echo "   Model: gemini-2.0-flash-exp"
echo "   API Key: AIzaSy...Zki4"
echo ""
echo "🚀 Backend will auto-reload. Test at http://localhost:3000"
