# ✅ AI Interview System - READY TO USE

## 🎯 Current Configuration

### LLM (Language Model)
- **Provider**: Anthropic Claude
- **Model**: `claude-3-5-haiku-20241022` (Fast & Efficient)
- **API Key**: Configured ✅

### TTS (Text-to-Speech)
- **Provider**: Cartesia
- **Voice**: British Lady (configurable per agent)
- **API Key**: Configured ✅

### STT (Speech-to-Text)
- **Provider**: Deepgram
- **API Key**: Configured ✅

### Transport
- **Provider**: LiveKit
- **URL**: wss://sound-jeyr1n4k.livekit.cloud
- **API Keys**: Configured ✅

---

## 🚀 How to Use

### 1. Access the Application
Open in your browser: **http://localhost:3000**

### 2. Create or Select an Agent
- Go to "Library" or "Create Agent"
- Configure:
  - **Name**: Agent's name (e.g., "Alex")
  - **Role**: Agent's role (e.g., "Senior Interviewer")
  - **Job Title**: Position being interviewed for
  - **Company**: Company name
  - **Interview Type**: Technical / Behavioral / HR
  - **Difficulty**: Junior / Mid / Senior
  - **Max Questions**: Number of questions (e.g., 10)
  - **Voice**: Select from available voices

### 3. Start Interview
- Click "Start Interview" on any agent
- **Allow microphone permissions** when prompted
- Wait for "Agent connected" status

### 4. Interview Flow
1. **Bot speaks first**: Greets you and asks you to introduce yourself
2. **You speak**: Your response is captured via Deepgram STT
3. **Transcript updates**: Shows your speech in real-time
4. **Bot responds**: Claude Haiku generates response based on:
   - Your agent configuration (job title, difficulty, topics)
   - Your previous answers
   - Interview context
5. **Bot speaks**: Cartesia TTS converts response to voice
6. **Repeat**: Continues until max_questions reached
7. **Bot ends**: Calls `end_interview` tool and says goodbye

---

## 📊 How It Works

### Pipeline Flow
```
User speaks
  ↓
Deepgram STT (speech → text)
  ↓
Transcript Publisher (captures text, triggers LLM)
  ↓
Claude Haiku (generates response based on agent config + conversation)
  ↓
Cartesia TTS (text → speech)
  ↓
LiveKit (delivers audio to user)
```

### Agent Configuration → Response
The bot's responses are tailored based on:
- **Job Title**: Asks relevant questions for the role
- **Interview Type**: Technical/Behavioral/HR style questions
- **Difficulty**: Adjusts question complexity
- **Topics**: Focuses on specified topics
- **Max Questions**: Stops after reaching limit
- **System Instruction**: Custom prompt (if provided)

---

## 🔧 Monitoring

### View Bot Logs
```bash
tail -f /Users/vipulpawar/Desktop/sounds/backend/server.log
```

### Check Running Services
- Backend: http://localhost:8000/agents
- Frontend: http://localhost:3000

---

## 🐛 Troubleshooting

### Bot Not Speaking?
1. Kill old bot processes:
   ```bash
   ps aux | grep "bot.py" | grep -v grep | awk '{print $2}' | xargs kill -9
   ```

2. Clear logs:
   ```bash
   echo "" > /Users/vipulpawar/Desktop/sounds/backend/server.log
   ```

3. Start new interview

### No Audio?
- Check browser microphone permissions
- Ensure speakers/headphones are working
- Check browser console for errors

### Transcript Not Showing?
- Check LiveKit connection status
- Verify "Agent connected" appears
- Check server logs for errors

---

## 📝 Example Agent Configuration

```json
{
  "name": "Alex",
  "role": "Senior Technical Interviewer",
  "job_title": "Full Stack Engineer",
  "company_name": "Google",
  "interview_type": "technical",
  "difficulty": "senior",
  "topics": ["React", "Node.js", "System Design"],
  "max_questions": 8,
  "voice_id": "79a125e8-cd45-4c13-8a67-188112f4dd22"
}
```

**Result**: Bot will conduct a senior-level technical interview for a Full Stack Engineer position at Google, focusing on React, Node.js, and System Design, asking 8 questions total.

---

## ✅ System Status

- ✅ Backend: Running on port 8000
- ✅ Frontend: Running on port 3000
- ✅ Claude Haiku: Configured
- ✅ Cartesia TTS: Configured
- ✅ Deepgram STT: Configured
- ✅ LiveKit: Configured
- ✅ All API Keys: Valid

**🎉 System is ready! Go to http://localhost:3000 and start an interview!**
