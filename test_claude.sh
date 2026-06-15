#!/bin/bash
set -e

echo "🧪 Testing Claude Integration..."
echo ""

# Step 1: Kill ALL bot processes
echo "1️⃣ Killing all bot processes..."
pkill -9 -f "bot.py" 2>/dev/null || true
pkill -9 Python 2>/dev/null || true
sleep 2

# Step 2: Verify bot.py configuration
echo "2️⃣ Verifying bot.py configuration..."
if grep -q "claude-3-5-sonnet-20241022" /Users/vipulpawar/projects/pipecat-outbound/bot.py; then
    echo "   ✅ Bot configured for Claude"
else
    echo "   ❌ Bot NOT configured for Claude"
    exit 1
fi

# Step 3: Clear logs
echo "3️⃣ Clearing logs..."
echo "" > /Users/vipulpawar/Desktop/sounds/backend/server.log

# Step 4: Test spawn
echo "4️⃣ Spawning test bot..."
curl -s -X POST http://localhost:8000/agents/2/join-room > /tmp/spawn_result.json
ROOM=$(python3 -c "import json; print(json.load(open('/tmp/spawn_result.json'))['room_name'])")
echo "   Room: $ROOM"

# Step 5: Wait and check logs
echo "5️⃣ Waiting for bot to connect..."
sleep 5

# Step 6: Check for errors
echo "6️⃣ Checking for errors..."
if grep -q "404\|llama-3.1" /Users/vipulpawar/Desktop/sounds/backend/server.log; then
    echo "   ❌ ERROR: Bot is using wrong model!"
    tail -50 /Users/vipulpawar/Desktop/sounds/backend/server.log | grep -E "ERROR|404|llama"
    exit 1
elif grep -q "AnthropicLLMService#0" /Users/vipulpawar/Desktop/sounds/backend/server.log; then
    echo "   ✅ Bot is using Claude!"
    if grep -q "greeting" /Users/vipulpawar/Desktop/sounds/backend/server.log; then
        echo "   ✅ Greeting sent!"
    else
        echo "   ⚠️  No greeting detected (no participant joined)"
    fi
else
    echo "   ❌ Bot not started properly"
    tail -30 /Users/vipulpawar/Desktop/sounds/backend/server.log
    exit 1
fi

echo ""
echo "✅ Test complete! Bot is ready."
echo "🚀 Go to http://localhost:3000 and start an interview"
