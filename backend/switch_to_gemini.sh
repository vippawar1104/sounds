#!/bin/bash
set -e

echo "🔄 Switching to Google Gemini..."

# Install Google Gemini in pipecat venv
cd /Users/vipulpawar/projects/pipecat-outbound
source venv/bin/activate
pip install google-generativeai

# Kill all old bot processes
pkill -9 -f "bot.py" || true

echo "✅ Ready! Now update bot.py to use Gemini"
