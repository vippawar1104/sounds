#!/bin/bash
set -e

echo "📦 Installing Pipecat with Google support..."

cd /Users/vipulpawar/projects/pipecat-outbound
source venv/bin/activate

# Install pipecat with google support
pip install 'pipecat-ai[google]'

# Kill old bots
pkill -9 -f "bot.py" || true

echo "✅ Installation complete!"
