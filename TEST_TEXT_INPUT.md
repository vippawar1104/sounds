# 🎯 Text Input Feature - Testing Guide

## ✅ System Status

- **Frontend**: Running on http://localhost:3000
- **Backend**: Running on http://localhost:8000
- **Bot**: Ready to spawn (Claude Haiku + Cartesia TTS + Deepgram STT)
- **Text Input**: Fully implemented and ready to test

---

## 🧪 How to Test Text Input

### Step 1: Open the Application
1. Open your browser: http://localhost:3000
2. You should see the Sounds dashboard

### Step 2: Start an Interview
1. Click **"Library"** in the sidebar
2. Select any agent (or create a new one if needed)
3. Click **"Start Interview"** button
4. Wait for the interview room to load

### Step 3: Wait for Bot Connection
- Look for **"Agent connected"** status (green indicator)
- The bot should greet you with voice after connecting
- If bot doesn't connect, check backend logs

### Step 4: Test Text Input
1. **Find the text input field** at the bottom of the screen
   - It says: "Type your message here (or speak)..."
2. **Type a message**, for example:
   - "Hello, my name is John"
   - "I have 5 years of experience in Python"
   - "Can you tell me about the role?"
3. **Send the message** by:
   - Pressing **Enter** key, OR
   - Clicking the **Send** button

### Step 5: Verify It Works
✅ **Your message should**:
- Appear in the transcript immediately (right side, blue bubble)
- Show your name as "You"
- Include timestamp

✅ **Bot should**:
- Receive your message (check backend logs if needed)
- Process it through Claude Haiku LLM
- Respond with **voice** (you'll hear it through speakers)
- Response appears in transcript (left side, green bubble)

### Step 6: Test Voice Input (Optional)
- Click the microphone button to unmute
- Speak naturally
- Your speech should be transcribed and appear in transcript
- Bot responds the same way as with text

---

## 🎤 Two Ways to Communicate

| Method | How It Works | Bot Response |
|--------|--------------|--------------|
| **Text** | Type in input field → Press Enter/Send | Voice (TTS) |
| **Voice** | Speak into microphone → STT transcribes | Voice (TTS) |

Both methods work identically - the bot processes them the same way!

---

## 🔍 What to Look For

### ✅ Success Indicators
- Text appears in transcript immediately after sending
- Bot responds within 2-5 seconds
- You hear the bot's voice response
- Bot's response appears in transcript
- Conversation flows naturally

### ❌ Troubleshooting

**If text doesn't appear in transcript:**
- Check browser console for errors (F12)
- Verify LiveKit connection is active

**If bot doesn't respond:**
- Check backend logs: `tail -f /Users/vipulpawar/Desktop/sounds/backend/server.log`
- Look for "Received text input: ..." message
- Verify Claude API key is valid

**If you don't hear bot's voice:**
- Check speaker volume
- Verify Cartesia API key is valid
- Check browser audio permissions

**If bot process crashes:**
- Kill old processes: `ps aux | grep "bot.py" | grep -v grep | awk '{print $2}' | xargs kill -9`
- Start a new interview

---

## 🐛 Debugging Commands

### Check Backend Logs
```bash
tail -f /Users/vipulpawar/Desktop/sounds/backend/server.log
```

### Check Running Processes
```bash
# Frontend
lsof -ti :3000

# Backend
lsof -ti :8000

# Bot processes
ps aux | grep "bot.py" | grep -v grep
```

### Kill Old Bot Processes
```bash
ps aux | grep "bot.py" | grep -v grep | awk '{print $2}' | xargs kill -9
```

### Restart Frontend (if needed)
```bash
cd /Users/vipulpawar/Desktop/sounds/dashboard
lsof -ti :3000 | xargs kill -9
npm run dev
```

### Restart Backend (if needed)
```bash
cd /Users/vipulpawar/Desktop/sounds/backend
source ../.venv/bin/activate
uvicorn main:app --reload --port 8000
```

---

## 📝 Example Test Conversation

**You (text)**: "Hello, I'm ready for the interview"
**Bot (voice)**: "Hello! Welcome to the interview. I'm [Agent Name], and I'll be conducting your interview today. Could you please start by introducing yourself?"

**You (text)**: "My name is John and I have 5 years of experience in software development"
**Bot (voice)**: "Great to meet you, John! That's impressive experience. Can you tell me about a challenging project you've worked on recently?"

**You (voice)**: [Speak your answer]
**Bot (voice)**: [Responds to your answer]

---

## 🎯 Feature Highlights

### What Makes This Special
1. **Dual Input**: Switch between typing and speaking seamlessly
2. **Live Transcript**: See everything in real-time
3. **Voice Responses**: Bot always responds with natural voice
4. **Context Aware**: Bot remembers the conversation
5. **Professional UI**: Clean, dark theme matching Cartesia style

### Technical Implementation
- **Frontend**: React + LiveKit Components
- **Transport**: LiveKit WebRTC + Data Channel
- **STT**: Deepgram Nova 2
- **LLM**: Anthropic Claude 3.5 Haiku
- **TTS**: Cartesia (ultra-low latency)
- **Bot Framework**: Pipecat 1.2.1

---

## 🚀 Next Steps

After testing, you can:
1. Create more agents with different configurations
2. Upload documents for RAG-powered interviews
3. Adjust agent personality and difficulty
4. Review interview sessions in the dashboard
5. Export transcripts (future feature)

---

## ⚠️ Known Issues

1. **iCloud Desktop Slowness**: Dashboard is on Desktop which syncs to iCloud
   - **Solution**: Move to `/Users/vipulpawar/projects/sounds-dashboard/`
   - This will prevent node_modules corruption

2. **Old Bot Processes**: Bots don't auto-terminate
   - **Solution**: Kill manually before each test
   - Command: `ps aux | grep "bot.py" | grep -v grep | awk '{print $2}' | xargs kill -9`

3. **Cache Corruption**: `.next` cache can get corrupted on iCloud
   - **Solution**: Run `./fix_frontend.sh` when errors occur

---

## 📞 Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review backend logs
3. Verify all API keys are valid
4. Ensure no old bot processes are running

**System is ready for testing! 🎉**
