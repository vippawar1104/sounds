#!/bin/bash
set -e

echo "🔄 Switching to Anthropic Claude..."

# Kill all old bot processes
pkill -9 -f "bot.py" || true
sleep 1

# Install Anthropic in pipecat venv
cd /Users/vipulpawar/projects/pipecat-outbound
source venv/bin/activate
pip install -q 'pipecat-ai[anthropic]'

# Clear logs
echo "" > /Users/vipulpawar/Desktop/sounds/backend/server.log

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Configuration:"
echo "   LLM Provider: Anthropic Claude"
echo "   Model: claude-3-5-sonnet-20241022"
echo "   API Key: sk-ant-api03-vLx...PwAA"
echo ""
echo "🚀 Test at http://localhost:3000"
