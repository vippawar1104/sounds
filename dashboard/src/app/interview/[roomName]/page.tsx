"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { RoomEvent } from "livekit-client";

interface AgentInfo {
  id: number;
  name: string;
  role: string;
  job_title?: string;
  company_name?: string;
  interview_type?: string;
  difficulty?: string;
}

interface SessionData {
  token: string;
  livekitUrl: string;
  agent: AgentInfo;
  sessionId?: number;
}

interface TranscriptEntry {
  speaker: string;
  text: string;
  time: string;
}

function parseTranscriptMessage(value: unknown): { speaker?: string; text: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "transcript" || typeof message.text !== "string") return null;
  return {
    speaker: typeof message.speaker === "string" ? message.speaker : undefined,
    text: message.text,
  };
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  technical:  { label: "Technical",    color: "#a78bfa" },
  behavioral: { label: "Behavioral",   color: "#fb923c" },
  hr:         { label: "HR Screening", color: "#4ade80" },
};
const DIFF_LABEL: Record<string, string> = {
  junior: "Junior", mid: "Mid-level", senior: "Senior",
};

// ─── Inner room UI ────────────────────────────────────────────────────────────
function InterviewRoom({ agent, onLeave }: {
  agent: AgentInfo; onLeave: (duration: number) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [botConnected, setBotConnected] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{role: string; content: string}[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((d) => { durationRef.current = d + 1; return d + 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    const botPresent = participants.some((p) => p.identity !== "user" && p.identity !== localParticipant?.identity);
    setBotConnected(botPresent);
  }, [participants, localParticipant]);

  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant: { identity: string } | undefined) => {
      try {
        const msg = parseTranscriptMessage(JSON.parse(new TextDecoder().decode(payload)));
        if (msg) {
          const text = msg.text.trim();
          if (!text) return;
          const speaker: string = msg.speaker === "user"
            ? "You"
            : msg.speaker === "assistant"
              ? agent.name
              : (msg.speaker ?? (participant?.identity === "user" ? "You" : agent.name));
          const now = new Date();
          const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          setTranscript((prev) => [...prev, {
            speaker,
            text,
            time,
          }]);
        }
      } catch { /* not a transcript message */ }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, agent.name]);

  const toggleMic = useCallback(async () => {
    await localParticipant?.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  }, [localParticipant, isMuted]);

  const handleEnd = useCallback(() => onLeave(durationRef.current), [onLeave]);

  const handleSendText = useCallback(async () => {
    if (!textInput.trim()) return;
    
    const text = textInput.trim();
    setTextInput("");
    setIsLoading(true);
    
    // Add to transcript immediately
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setTranscript((prev) => [...prev, {
      speaker: "You",
      text,
      time,
    }]);
    
    // Update conversation history with user message
    const newHistory = [...conversationHistory, { role: "user", content: text }];
    setConversationHistory(newHistory);
    
    try {
      // Call the /chat endpoint to get Claude's response
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
          message: text,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to get response");
      }
      
      const data = await response.json();
      const assistantResponse = data.response;
      
      // Add assistant response to transcript
      const responseTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setTranscript((prev) => [...prev, {
        speaker: agent.name,
        text: assistantResponse,
        time: responseTime,
      }]);
      
      // Update conversation history with assistant response
      setConversationHistory([...newHistory, { role: "assistant", content: assistantResponse }]);
      
      // Optional: Use browser's text-to-speech
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(assistantResponse);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      console.error("Error getting response:", error);
      // Add error message to transcript
      setTranscript((prev) => [...prev, {
        speaker: "System",
        text: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, agent.id, agent.name, conversationHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const initials = agent.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const typeInfo = TYPE_LABEL[agent.interview_type ?? "technical"] ?? TYPE_LABEL.technical;

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden font-sans">
      <RoomAudioRenderer />

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 h-[52px] border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center font-bold text-[11px] text-primary-foreground">S</div>
          <span className="font-semibold text-sm">Sounds</span>
          <span className="text-[#2a2a2a]">·</span>
          <span className="text-[12px] text-muted-foreground font-mono">{agent.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Live</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 text-[12px] font-mono font-semibold text-muted-foreground min-w-[56px] text-center">
            {fmt(duration)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-[272px] border-r border-border flex flex-col bg-background p-5 gap-4 flex-shrink-0 overflow-y-auto">

          {/* Agent avatar */}
          <div className="rounded-2xl border border-border bg-[#0d0d0d] p-5 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary">
                {initials}
              </div>
              <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${botConnected ? "bg-primary" : "bg-yellow-500"}`} />
            </div>
            <div>
              <div className="font-bold text-sm">{agent.name}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">{agent.role}</div>
            </div>
            <div className={`w-full py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 border ${
              botConnected 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${botConnected ? "bg-primary" : "bg-yellow-500"}`} />
              {botConnected ? "Agent connected" : "Waiting for agent…"}
            </div>
          </div>

          {/* Interview info */}
          <div className="rounded-xl border border-border bg-[#0d0d0d] p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#4b4b4b] mb-3">Interview Info</div>
            <div className="flex flex-col gap-2">
              {agent.job_title && (
                <div className="flex gap-2 text-[11px]">
                  <span className="text-muted-foreground w-14 shrink-0">Role</span>
                  <span className="font-medium">{agent.job_title}</span>
                </div>
              )}
              {agent.company_name && (
                <div className="flex gap-2 text-[11px]">
                  <span className="text-muted-foreground w-14 shrink-0">Company</span>
                  <span className="font-medium">{agent.company_name}</span>
                </div>
              )}
              <div className="flex gap-2 text-[11px]">
                <span className="text-muted-foreground w-14 shrink-0">Type</span>
                <span className="font-medium" style={{ color: typeInfo.color }}>{typeInfo.label}</span>
              </div>
              {agent.difficulty && (
                <div className="flex gap-2 text-[11px]">
                  <span className="text-muted-foreground w-14 shrink-0">Level</span>
                  <span className="font-medium">{DIFF_LABEL[agent.difficulty] ?? agent.difficulty}</span>
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#4b4b4b] mb-2">Participants ({participants.length})</div>
            <div className="flex flex-col gap-1">
              {participants.map((p) => (
                <div key={p.identity} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {p.identity === "user" ? "U" : initials}
                  </div>
                  <span className="text-[12px] font-medium">{p.identity === "user" ? "You" : agent.name}</span>
                  {p.isSpeaking && (
                    <span className="ml-auto flex gap-0.5 items-end">
                      {[1, 2, 3].map((i) => (
                        <span key={i} className="w-0.5 bg-primary rounded-full" style={{ height: `${6 + i * 3}px` }} />
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="mt-auto rounded-xl border border-border bg-[#0d0d0d] p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#4b4b4b] mb-2">Tips</div>
            <ul className="text-[12px] text-muted-foreground flex flex-col gap-1.5 list-none">
              <li>• Speak clearly at a natural pace</li>
              <li>• Wait for the agent to finish</li>
              <li>• Mute if background noise</li>
            </ul>
          </div>
        </aside>

        {/* Transcript */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-8 h-[52px] border-b border-border flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm">Live Transcript</span>
            <span className="text-[12px] text-muted-foreground">{transcript.length} messages</span>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-8 flex flex-col gap-4">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Transcript will appear here</p>
                  <p className="text-[12px] mt-1 text-muted-foreground">Start speaking to begin the interview</p>
                </div>
              </div>
            ) : (
              transcript.map((entry, i) => (
                <div key={i} className={`flex gap-3 ${entry.speaker === "You" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold ${
                    entry.speaker === "You" ? "bg-blue-500/20 text-blue-400" : "bg-primary/20 text-primary"
                  }`}>
                    {entry.speaker === "You" ? "U" : initials}
                  </div>
                  <div className={`max-w-[70%] flex flex-col gap-1 ${entry.speaker === "You" ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-muted-foreground">{entry.speaker}</span>
                      <span className="text-[12px] text-[#3a3a3a]">{entry.time}</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      entry.speaker === "You" 
                        ? "bg-primary/15 text-foreground rounded-tr-none" 
                        : "bg-muted/50 text-foreground rounded-tl-none"
                    }`}>
                      {entry.text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Controls */}
          <footer className="border-t border-border px-8 py-4 flex flex-col gap-3 bg-background shrink-0">
            {/* Text input row */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here (or speak)..."
                className="flex-1 px-4 py-2.5 rounded-full bg-muted/50 border border-border text-sm text-black placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleSendText}
                disabled={!textInput.trim() || isLoading}
                className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </>
                )}
              </button>
            </div>
            
            {/* Audio controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground w-[120px]">
                <span className={`w-2 h-2 rounded-full ${isMuted ? "bg-red-400" : "bg-primary"}`} />
                {isMuted ? "Mic off" : "Mic on"}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleMic} title={isMuted ? "Unmute" : "Mute"}
                  className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
                    isMuted 
                      ? "bg-red-500/20 border-red-500/40 text-red-400" 
                      : "bg-muted/50 border-border text-foreground hover:bg-muted/80"
                  }`}>
                  {isMuted ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
                <button onClick={handleEnd}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 text-white text-sm font-bold cursor-pointer hover:bg-red-600 transition-colors">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                  </svg>
                  End Interview
                </button>
              </div>
              <div className="w-[120px]" />
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const roomName = params.roomName as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`interview_${roomName}`);
    if (!raw) { setError("Session not found. Please start an interview from the Agents page."); return; }
    try { setSession(JSON.parse(raw)); } catch { setError("Invalid session data."); }
  }, [roomName]);

  const handleLeave = useCallback(async (duration: number) => {
    const raw = sessionStorage.getItem(`interview_${roomName}`);
    if (raw) {
      try {
        const s: SessionData = JSON.parse(raw);
        if (s.sessionId) {
          await fetch(`http://localhost:8000/sessions/${s.sessionId}/end`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_seconds: duration }),
          });
        }
      } catch { /* non-critical */ }
    }
    sessionStorage.removeItem(`interview_${roomName}`);
    setLeft(true);
    router.push("/library");
  }, [roomName, router]);

  const centerStyle: React.CSSProperties = {
    minHeight: "100vh", background: "#0a0a0a", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", color: "#f5f5f5",
  };

  if (left) return (
    <div style={centerStyle}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <svg width="24" height="24" fill="none" stroke="currentColor" className="text-primary" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold">Interview ended</p>
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-[400px] text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg width="28" height="28" fill="none" stroke="#f87171" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="font-bold text-lg">Session Error</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={() => router.push("/library")}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold cursor-pointer border-none hover:opacity-90 transition-opacity">
          Back to Agents
        </button>
      </div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
        </svg>
        <p className="text-sm">Loading session…</p>
      </div>
    </div>
  );

  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.livekitUrl}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => handleLeave(0)}
      style={{ height: "100vh" }}
    >
      <InterviewRoom agent={session.agent} onLeave={handleLeave} />
    </LiveKitRoom>
  );
}
