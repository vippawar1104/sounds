#!/bin/bash
set -e

echo "🔧 Setting up Pipecat bot environment..."

cd /Users/vipulpawar/projects/pipecat-outbound

echo "📦 Removing old venv..."
rm -rf venv

echo "🐍 Creating fresh venv..."
python3 -m venv venv

echo "✅ Activating venv..."
source venv/bin/activate

echo "📥 Installing pipecat-ai with all required services..."
pip install --upgrade pip
pip install 'pipecat-ai[livekit,deepgram,cartesia,groq]' python-dotenv

echo "✅ Pipecat environment ready!"
echo ""
echo "To test the bot manually:"
echo "  cd /Users/vipulpawar/projects/pipecat-outbound"
echo "  source venv/bin/activate"
echo "  python bot.py"
